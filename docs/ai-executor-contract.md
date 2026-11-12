# 共通 AI 実行 API との非同期契約 v1

このリポジトリは計画書の A1〜A3（問題側）を実装する。C1（Claude を呼ぶ共通実行 API）と B 系統（チャット）は独立したサービスで、このリポジトリでは実装しない。問題側のテストはこの契約のモックを使用する。

## 依頼

問題側の Queue consumer が、設定済みの HTTPS エンドポイント `AI_EXECUTOR_URL`（例: `https://ai-api.example.com/v1/requests`）を呼ぶ。現在の認証は `Authorization: Bearer <AI_EXECUTOR_API_KEY>`。このキーは共通 AI API が呼び出し元ごとに発行し、Claude 自体の API キーとは分ける。Worker Secrets だけに保存し、ブラウザ・ジョブ本文・D1・ログには含めない。

認証処理は `worker/ai-executor-auth.js`、HTTP 送信は `worker/ai-executor.js` に分離している。標準設定は `AI_EXECUTOR_TRANSPORT=https`, `AI_EXECUTOR_AUTH=api-key`。認証方式を変えても以下の依頼本文・requestId・callback・出題／採点処理を変更する必要はない。

同じ Cloudflare アカウント内の非公開 Worker を使う場合は、明示的に `AI_EXECUTOR_TRANSPORT=service-binding`, `AI_EXECUTOR_AUTH=service-binding` を設定し、`AI_EXECUTOR` Service binding を追加する。この場合は共通 API を公開 route なしにし、binding の実行元を許可した Worker に限定する。

```json
{
  "requestId": "1c81aa62-6f38-4a25-830b-dfbcc6f1042f",
  "operation": "answers.grade",
  "profile": "quiz-written-v1",
  "input": {
    "instructions": "保存済みの採点基準と出典だけを使って…",
    "revision": { "repository": "owner/questions", "commit": "40文字のSHA", "path": "questions/spec/example.json" },
    "references": [],
    "sourceMaterials": { "reference-id": "固定した版から取得した出典本文" },
    "questions": [{ "id": "question-id", "type": "written", "prompt": "…", "points": 2, "answer": "利用者の回答", "solution": { "explanation": "…", "rubric": [] } }]
  },
  "maxOutputTokens": 8000,
  "callback": { "url": "https://quiz.example.com/api/ai/results", "token": "ジョブ専用の認証トークン" }
}
```

操作は `questions.generate` と `answers.grade`。作問の `input` は `instructions`, `questionCount`, `context`, `material` を持つ。`context` には仕様・PR の固定版と、取得した各出典の本文 `references[].excerpt` が含まれる。

共通 API は**推論が完了する前に**永続的に依頼を受け付け、`202` を返す。問題側は受付の HTTP 通信だけを20秒でタイムアウトさせる。長い Claude 呼び出しをこの接続や `waitUntil` の寿命に依存させない。共通 API 側でも Queues / Workflows などにより実行を継続する。

再配信・通信切断があり得るため、共通 API は **呼び出し元 + requestId による冪等な受付**を必須とする。同じ依頼を繰り返しても課金対象の推論を増やさず、同じジョブを返す。問題側の D1 排他だけでは、外部サービスで受付済みか不明な状態を判定できない。

共通 API は呼び出し元別に許可操作・モデル・入力サイズ・トークン数・頻度・利用量を制限し、Claude キーと利用ログを自分の環境で管理する。API キーの更新や認証方式の変更時も、同じ論理的な呼び出し元 ID に対応付け、受付済み requestId の再実行を避ける。`profile` は共通 API 側で承認済みのモデル・設定へ解決し、利用者入力の任意モデルを実行しない。問題側の利用者認証と利用上限はこの Worker が担当する。

## 認証アダプタの差し替え

現在は API キー認証を実装する。OAuth + DPoP の実装は利用側が用意し、`createExecutorAuth(env)` の返すアダプタを差し替える。出題・採点・Queue の処理や依頼本文を変更する必要はない。

アダプタの契約は `fetch(request, send) -> Promise<Response>` のみ。

- `request` には確定済みの URL・HTTP method・JSON 本文・タイムアウトの signal が設定されている。
- `send(request)` が選択した HTTPS または Service binding の送信処理。アダプタは自分の認証実装を通して通信し、応答を返す。
- 認証固有の状態管理や応答処理は、差し替え先のアダプタが担当する。クイズ側は OAuth の token 管理、DPoP proof、nonce 処理を実装しない。
- 通常の送信では HTTP redirect を追跡しない。ジョブの再試行と requestId による冪等性は、従来どおり Queue と共通 API が担当する。
- 未登録の認証方式はエラーにし、API キーや匿名認証へフォールバックしない。callback のジョブ専用トークン認証は独立した契約として扱う。

## 結果の受信

実行後、共通 API から `callback.url` へ新しい HTTP リクエストを送る。

```http
POST /api/ai/results
Authorization: Bearer <callback.token>
Content-Type: application/json
```

```json
{
  "requestId": "1c81aa62-6f38-4a25-830b-dfbcc6f1042f",
  "operation": "answers.grade",
  "status": "completed",
  "output": {
    "grades": [{ "questionId": "question-id", "score": 2, "reason": "採点基準を満たす理由", "referenceIds": ["reference-id"] }]
  },
  "model": "実際に使用したClaudeモデルのID",
  "usage": { "inputTokens": 1200, "outputTokens": 300 }
}
```

作問結果の `output` は `title`, `questions`, `solutions`, `inconsistencies`。形式は `worker/contracts.js` と `questions/spec/rfc-7523.json` を参照する。仕様・参照先などのメタデータはサーバーが元の依頼から復元し、モデルの出力で置き換えない。

失敗時は同じ `requestId`, `operation` と `status: "failed"` を送る。エラーの生本文・秘密情報は送り返さない。

- トークンは問題側の `AI_CALLBACK_SECRET` と `requestId` による HMAC-SHA256 で生成する。共通 API は秘密鍵を知る必要がなく、渡されたジョブ専用トークンを保持して送信する。
- 結果はジョブの操作と照合し、採点の範囲・理由・出典 ID、作問形式を検証する。候補は必ず `draft` にする。
- 重複 callback、受付応答より先の callback に対応する。終端状態のジョブを再実行・上書きしない。
- 問題側が `5xx` を返した場合は callback を再送する。`200` は受領済み（不正な生成内容を失敗として保存した場合も含む）。`401` は認証エラー、`400` は契約違反。
- 共通 API は callback の宛先を許可済み問題サービスに限定し、任意の URL への SSRF を許さない。問題側は `APP_ORIGIN` の固定 URL を渡す。
- 結果受付のパスだけは Cloudflare Access の入口制限を Bypass し、このジョブ専用トークンで認証する。他の API の Access 認証は必須。結果受付へのリクエストで Access ヘッダーを偽装してもトークン検証は省略されない。

問題側では30分で未完了ジョブを失敗にする。Queue には3回の再試行と dead-letter Queue を設ける。D1 の outbox と Cron が enqueue 失敗・途中終了を回復する。共通 API の実行・結果配送の上限も、この期限と整合させる。
