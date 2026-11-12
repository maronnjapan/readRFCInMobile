# 共通 AI 実行 API との非同期契約 v1

このリポジトリは計画書の A1〜A3（問題側）を実装する。C1（Claude を呼ぶ共通実行 API）と B 系統（チャット）は独立したサービスで、このリポジトリでは実装しない。問題側のテストはこの契約のモックを使用する。

## 依頼

問題側の Queue consumer が Cloudflare Service binding `AI_EXECUTOR` で、共通 API の `POST /v1/requests` を呼ぶ。外部ブラウザからこの binding を利用する権限はない。共通 API は `workers_dev: false`・公開 route なしで配置し、許可した問題側・チャット側だけに binding を与える。公開 HTTP の Bearer キーで Claude を直接利用できる構成にはしない。

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

共通 API は呼び出し元別に許可操作・モデル・入力サイズ・トークン数・頻度・利用量を制限し、Claude キーと利用ログを自分の環境で管理する。`profile` は共通 API 側で承認済みのモデル・設定へ解決し、利用者入力の任意モデルを実行しない。問題側の利用者認証と利用上限はこの Worker が担当する。

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
