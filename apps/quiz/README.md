# 仕様理解クイズ

Cloudflare Workers Paid・Hono・D1・Queuesで動く問題アプリ。API、スマホ向け画面、作問ツール、問題データ、設定、テストをこのディレクトリで管理する。

## コードの入口

まず `worker/app.js` を読むと、公開APIと認証の適用範囲が分かる。`worker/index.js` はWorkersのfetch・queue・scheduledの接続だけを担当する。

| 配置 | 役割 |
| --- | --- |
| `worker/app.js` | Honoのルート登録、APIレスポンスヘッダー、エラー処理 |
| `worker/middleware.js` | Access認証、作問権限、同一オリジン確認、ID検証 |
| `worker/routes/` | 問題セット、回答、作問依頼、AI結果のHTTPハンドラー |
| `worker/services/` | 問題公開、即時採点、記述式採点依頼、AI結果保存 |
| `worker/jobs/` | QueueによるAI依頼とCronによる未完了ジョブの回復 |
| `worker/store.js` | D1からの問題・回答取得と出題データへの変換 |
| `worker/contracts.js` | 問題・回答・採点結果の検証とAI向け指示 |
| `worker/ai-executor*.js` | 共通AI APIへの接続と差し替え可能な認証 |
| `web/` | 1問ずつ回答するスマホ向け画面 |
| `shared/` | サーバー・画面・作問ツールで共有する定義 |
| `tools/authoring/` | 固定版の仕様・公開コードからの手動作問と公開 |
| `questions/` | 正解・採点基準・出典付きの問題ファイル |
| `specs/`, `mappings/`, `code-sources.yaml` | 対象仕様とコード参照の設定 |
| `migrations/` | D1マイグレーション |
| `test/`, `test-support/` | 単体テスト、Workers・D1・Queuesの統合テスト |
| `wrangler.jsonc`, `.dev.vars.example` | Workersの設定とローカル設定の例 |

HTTPハンドラーは入力を読み、サービスへ渡してJSONを返す。サービスはHonoのContextに依存しない。AI結果の受信ルートはジョブ専用トークンで認証し、利用者向けのAccess認証と分ける。

## 開発コマンド

リポジトリのルートで一度 `npm ci` を実行する。依存はnpm workspacesとルートのlockfileで管理する。その後はこのディレクトリで作業できる。

```sh
cd apps/quiz
npm test
npm run check:workers
cp .dev.vars.example .dev.vars   # 接続先と認証情報を設定する
npm run db:migrate:local
npm run dev
```

`npm run build` は `apps/quiz/dist/` を作成する。本文へ戻れるようにリーダーの公開ファイルも含める。画面のJavaScriptはバンドルし、Worker、問題、採点基準、設定、テストは配信しない。RFC/PDF本文はリポジトリ共通の `rfcs/`・`pdfs/` を参照する。

作問CLIの `--path` は、実行ディレクトリによらずリポジトリのルートからのパスを指定する。

```sh
npm run author -- generate --spec rfc-7591
npm run author -- check --path apps/quiz/questions/spec/rfc-7591.json
npm run author -- publish --commit <40文字のSHA> --path apps/quiz/questions/spec/rfc-7591.json
```

初期設定・公開・APIの一覧は[運用手順](docs/quiz-service.md)、外部AI APIとの接続と認証差し替えは[非同期AI実行契約](docs/ai-executor-contract.md)を参照する。
