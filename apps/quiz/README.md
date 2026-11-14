# 仕様理解クイズ

Cloudflare Workers Paid・Hono・D1・Queuesで動く問題アプリ。API、PC・スマホ向け画面、作問ツール、問題データ、設定、テストをこのディレクトリで管理する。

7カテゴリ・4回答方式（選択式・並べ替え・記述式・コード実装）に対応する。実装問題はケース・制約・入出力例を提示し、PCではCodeMirror 6の補完・シンタックスハイライト付きエディタでコードを書く。JavaScript・TypeScript・Pythonに対応し、スマホ幅では同じ題材のコード読解・関数選択問題に切り替えて出題する。[実装問題のサンプル](questions/spec/rfc-7591-implementation.json)と[形式・採点の説明](docs/quiz-service.md#実装問題)を参照する。

AIが作問するときの共通skillはリポジトリ直下の [skills/quiz-authoring/SKILL.md](../../skills/quiz-authoring/SKILL.md)。`.agents/skills/quiz-authoring`・`.claude/skills/quiz-authoring`の両方から同じファイルを参照する。

maronn-openid-connect から受け取った PR 情報は作問資料として保存する。資料から問題を作る方法は、ローカルの Claude Code・手作業・任意の AI API などから別途選ぶ。完成済みの問題 JSON があれば AI 作問なしで公開・回答でき、PR のコメントと Check に回答 URL を返せる。PR の変更ファイル数・問題数・対象リポジトリに独自の制限は設けない。[PR 連携](docs/pr-integration.md)と[問題ファイルだけで公開する手順](docs/question-files.md)を参照する。接続設定の画面操作は [PR 連携の設定詳細](docs/pr-integration.md#接続設定の画面操作)、任意の AI 接続の準備は [AI 実行サーバーの説明](docs/ai-executor-preparation.md)に記載している。

## 収録している DPoP 問題集

[RFC 9449 DPoP の問題集（80 問）](docs/rfc-9449-dpop.md)は、保存済みの `rfcs/rfc9449.txt` を使った 4 セットです。選択式 68 問・並べ替え 4 問・記述式 8 問に、解説・採点基準・コミット固定の出典を付けています。自習用ページでは解答を折りたたんで表示します。

| セット | 問題データ |
| --- | --- |
| 1. 基本概念と proof の読み方 | [rfc-9449-01-foundations.json](questions/spec/rfc-9449-01-foundations.json) |
| 2. トークン発行と受信時の検証 | [rfc-9449-02-validation.json](questions/spec/rfc-9449-02-validation.json) |
| 3. nonce・認可コード・PAR | [rfc-9449-03-nonce-code.json](questions/spec/rfc-9449-03-nonce-code.json) |
| 4. 攻撃シナリオと実装レビュー | [rfc-9449-04-security.json](questions/spec/rfc-9449-04-security.json) |

仕様 ID は共通の `rfc-9449` です。mainに保存してデプロイすると、4ファイルが取り込み操作なしで `/quiz?spec=rfc-9449` に並び、ログインなしで回答できます。公開方法は[問題集の手順](docs/rfc-9449-dpop.md#問題アプリで使う場合)を参照してください。

[発展問題集（128 問）](docs/rfc-9449-dpop-advanced.md)は、要件の強さ・条件・主語の読み分けと、DPoP が土台にしている仕様を扱う 7 セットです。選択式 107 問・並べ替え 5 問・記述式 8 問・実装 8 問で、選択式の誤答は一か所だけ違うように作っています。RFC 9449 以外の出典は、`rfcs/` に保存した関連 RFC の本文（コミット `1ae11d196faad317d95d4d02e402621dcde76d49`）に固定しています。

| セット | 問題データ |
| --- | --- |
| 5. 精読 — 要件の強さ・条件・主語 | [rfc-9449-05-close-reading.json](questions/spec/rfc-9449-05-close-reading.json) |
| 6. JOSE の土台 — JWS・JWK・JWA・JWT | [rfc-9449-06-jose.json](questions/spec/rfc-9449-06-jose.json) |
| 7. 鍵の結び付け — JWK Thumbprint・cnf・introspection | [rfc-9449-07-key-binding.json](questions/spec/rfc-9449-07-key-binding.json) |
| 8. HTTP の細部 — メソッド・URI・認証ヘッダー | [rfc-9449-08-http.json](questions/spec/rfc-9449-08-http.json) |
| 9. 相互運用 — メタデータ・登録・PAR・PKCE | [rfc-9449-09-metadata-par.json](questions/spec/rfc-9449-09-metadata-par.json) |
| 10. 方式比較と脅威モデル — mTLS・Bearer・セキュリティ BCP | [rfc-9449-10-design-threats.json](questions/spec/rfc-9449-10-design-threats.json) |
| 11. 実装 — DPoP の処理を自分で書く | [rfc-9449-11-implementation.json](questions/spec/rfc-9449-11-implementation.json) |

7 ファイルの `status` は `published` です。main に反映してデプロイすると、基本の 4 セットと合わせて全 11 セット・208 問が取り込み操作なしで `/quiz?spec=rfc-9449` に並び、ログインなしで回答できます。実装問題は PC ではコード実装、スマホではコード読解で回答します。

## コードの入口

まず `worker/app.js` を読むと、画面・APIと認証の適用範囲が分かる。`worker/index.js` はWorkersのfetch・queue・scheduledの接続だけを担当する。

| 配置 | 役割 |
| --- | --- |
| `worker/app.js` | 画面・APIのHonoルート登録、レスポンスとエラー処理 |
| `worker/middleware.js` | Access認証、作問権限、同一オリジン確認、ID検証 |
| `worker/routes/pages.jsx` | Honoの画面ルートとフォーム操作。出題・結果のHTMLを返す |
| `worker/routes/` | 問題セット、回答、作問依頼、AI結果のJSON API |
| `worker/services/` | 問題公開、即時採点、記述式・実装採点依頼、AI結果保存 |
| `worker/jobs/` | QueueによるAI依頼とCronによる未完了ジョブの回復 |
| `worker/store.js`, `worker/question-files.js` | GitHubの問題ファイル・固定版メタデータとD1の回答取得 |
| `worker/contracts.js` | 問題・回答・採点結果の検証 |
| `worker/prompts.js` | システム指示、資料、回答、採点基準、出力形式を含むプロンプト全文の構築 |
| `worker/ai-executor*.js` | 共通AI APIへの接続と差し替え可能な認証 |
| `web/document.jsx`, `web/pages.jsx` | Hono JSXで描画するレイアウト・問題一覧・出題・結果画面 |
| `web/components/` | Hono JSXの問題表示・出典・並べ替えコンポーネント |
| `web/client.jsx` | Hono JSX DOMによる並べ替え操作と、フォーム送信・採点状況の更新 |
| `web/code-editor.js` | 遅延読込するCodeMirrorエディタ、コードの構文強調、タブ内の下書き保存 |
| `shared/` | サーバー・画面・作問ツールで共有する定義 |
| `tools/authoring/` | 固定版の仕様・公開コードからの手動作問と公開 |
| `questions/` | GitHubで管理する正解・採点基準・出典付きの問題ファイル（出題の正本） |
| `specs/`, `mappings/`, `code-sources.yaml` | 対象仕様とコード参照の設定 |
| `migrations/` | D1マイグレーション |
| `scripts/deploy.mjs`, `scripts/destroy.mjs` | D1・Queues・Workerの一括デプロイ／作成リソースの削除 |
| `scripts/deployment.mjs`, `scripts/cloudflare.mjs` | Cloudflare API、所有情報の保存、Wrangler実行 |
| `test/`, `test-support/` | 単体テスト、Workers・D1・Queuesの統合テスト |
| `wrangler.jsonc`, `.dev.vars.example` | Workersの設定とローカル設定の例 |

画面もAPIもHonoのルートで処理する。画面はHono JSXでサーバー描画し、静的HTMLシェルを配信しない。画面のフォーム操作とJSON APIは同じサービスを使う。並べ替えはHono JSX DOMで操作し、JavaScriptなしでも通常のフォームと選択欄で回答できる。サービスはHonoのContextに依存しない。AI結果の受信ルートはジョブ専用トークンで認証し、利用者向けのAccess認証と分ける。

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

`npm run build` は `apps/quiz/dist/` を作成する。本文へ戻れるようにリーダーの公開ファイルも含める。公開済みの問題JSONは固定コミット情報とともに非公開のWorkerバンドルへ含め、DBへの問題本文の取り込みなしで出題する。別ブランチの固定版を公開するAPIも、DBへは版の参照と一覧用メタデータだけを登録する。正解・採点基準・出典本文はGitHubのファイルから読む。

画面のJavaScriptは `hono/jsx/dom` でバンドルし、HTMLはHonoがリクエストごとに描画する。全リクエストをHonoに通し、CSS・JavaScript・本文の取得はAssets bindingへ委譲する。Workerのソース、問題、採点基準、設定、テストは静的配信しない。RFC/PDF本文はリポジトリ共通の `rfcs/`・`pdfs/` を参照する。

問題のRFC出典リンクは、サイト内のリーダーで該当する段落・見出し・用語を開く（`/?rfc=番号#L開始行-L終了行`）。日本語表示でも原文と同じ箇所へ移動する。コード・PR差分の出典はGitHubの固定版を開く。

通常の出題・即時採点・記述式回答の保存にはAccess認証は不要。回答は匿名Cookieで所有者を確認してD1へ保存する。記述式のAI採点を依頼するときだけ、専用ログイン画面で認証・認可し、匿名回答を引き継ぐ。作問・固定版の登録は管理操作として認証と作問権限を維持する。

作問CLIの `--path` は、実行ディレクトリによらずリポジトリのルートからのパスを指定する。

```sh
npm run author -- generate --spec rfc-7591
npm run author -- check --path apps/quiz/questions/spec/rfc-7591.json
npm run author -- publish --commit <40文字のSHA> --path apps/quiz/questions/spec/rfc-7591.json
```

本番への公開と削除は[デプロイとデストロイ](docs/deployment.md)、Access・作問・APIの一覧は[運用手順](docs/quiz-service.md)、外部AI APIとの接続と認証差し替えは[非同期AI実行契約](docs/ai-executor-contract.md)を参照する。


## プロンプトの責務

問題アプリがプロンプト全文を組み立て、ジョブ作成時に保存する。共通AI APIは完成済みの `system` と `messages` をそのままClaudeへ渡す。作問・採点のドメイン知識やテンプレートは共通APIへ持たせない。AIの返した文章のJSON解析と内容の検証も問題アプリが担当する。
