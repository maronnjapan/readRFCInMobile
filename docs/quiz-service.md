# 仕様理解クイズ：配置と運用

## 実装範囲と配置

このリポジトリを仕様書・問題リポジトリとし、問題側のサービスもここで管理する。既存の RFC/PDF は移動せず、`specs/index.json` から ID・状態・版を定義する。サービスは `worker/`、作問ツールは `tools/authoring/` に分離した。チャットや Claude キーは含めない。

| 保存先 | 内容 |
| --- | --- |
| `specs/index.json` | 仕様 ID、題名、提案中／採用済み／草案／廃止済み、本文パス |
| `code-sources.yaml` | 公開コードのリポジトリ、標準ブランチ、仕様 ID、許可パス |
| `mappings/` | 関連仕様・参照先と検索語。例示設定は対象製品に合わせて変更する |
| `questions/spec/` | main で管理する仕様そのものの問題 |
| `questions/pr/` | 専用ブランチに保存する PR 固有の問題 |
| `.authoring-work/` | 固定コミットで取得したコード。Git 管理・静的配信の対象外 |
| D1 | 問題セットの固定版、利用者ごとの回答、選択式の点数、非同期採点ジョブ、採点理由・出典・実行設定の履歴 |

問題ファイルでは `questions` と `solutions` を分離する。静的配信の `dist/` には問題ファイルや採点基準をコピーせず、出題 API も回答前に正解・採点基準・出典本文を返さない。公開問題リポジトリ自体には解答があるため、練習用の設計である。

## Cloudflare Workers Paid の初期設定

Node.js 22 以降を使用する。

```sh
npm ci
npx wrangler login
npx wrangler d1 create spec-understanding-quiz
npx wrangler queues create spec-quiz-ai
npx wrangler queues create spec-quiz-ai-dead
```

`wrangler.jsonc` で以下を設定する。

- D1 作成結果の `database_id`
- `APP_ORIGIN`: 公開する出題サービスの HTTPS オリジン
- `QUESTION_REPOSITORY`: 問題を読む公開リポジトリ
- `QUESTION_DEFAULT_BRANCH`: 定番問題を管理する標準ブランチ（既定 `main`）。仕様問題の公開時は、そのコミットが標準ブランチの履歴に含まれることを確認する
- `CODE_REPOSITORIES`: PR 連携を許可する公開リポジトリ（カンマ区切り）
- `ACCESS_ISSUER`, `ACCESS_AUD`: Cloudflare Access アプリの issuer と Application Audience
- `AUTHOR_SUBJECTS` または `AUTHOR_EMAILS`: 作問・公開を許可する Access の subject／メールアドレス。Access Service Token は JWT の `sub` が空なので、署名検証した `common_name` に `service:` を付けた値（例: `service:abc123.access`）を `AUTHOR_SUBJECTS` に含める
- `AI_EXECUTOR` の接続先: [共通 AI 実行契約](ai-executor-contract.md) に対応した別 Worker
- `AUTHORING_PROFILE`, `GRADING_PROFILE`: 共通 API 側で承認された Claude の実行設定

Cloudflare Access に許可利用者の Allow ポリシーと、作問用 Service Token の Service Auth ポリシーを設定する。`/api/ai/results` だけは別アプリ／ポリシーで Bypass し、Worker 内のジョブ専用トークン認証を使う。それ以外の API は Access JWT の署名・issuer・audience・有効期限・subject を Worker 自身でも検証する。未設定時・未認証時に匿名の有料実行へフォールバックしない。

```sh
npm run db:migrate:remote
npx wrangler secret put AI_CALLBACK_SECRET   # ランダムな32文字以上。例: openssl rand -hex 32
npm run deploy:workers
```

Claude キーは **共通 AI API 側だけ**に登録する。Service binding は外部ブラウザに実行権限を渡さない。共通 API は推論完了を待たず依頼を永続化して `202` を返し、完了時に別リクエストで結果を返す必要がある。

ローカル開発は `.dev.vars.example` を `.dev.vars` にコピーして設定し、`npm run db:migrate:local` と `npm run dev` を使う。Access JWT を発行する実環境と共通 AI Worker の接続が必要な操作は、対応する開発環境に接続する。依存サービスを使用せず確認する場合は、統合テストのモックを使う。認証を省略する本番コード用スイッチは設けていない。

## 手動で作問する

仕様だけの場合、コードの取得は不要。

```sh
node tools/authoring/quiz.mjs generate --spec rfc-7523
```

公開コードや PR も参照する場合:

```sh
node tools/authoring/quiz.mjs generate --spec rfc-7523 --source reader --ref main
node tools/authoring/quiz.mjs generate --spec rfc-7523 --source reader --pr 42
```

必要な環境変数:

- `QUIZ_API_URL`: 出題 Worker の HTTPS URL
- `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`: 作問用 Access Service Token。CLI は Access の入口へ送り、Claude キーは扱わない
- `QUESTION_REPOSITORY`: 仕様・問題リポジトリ（省略時は本リポジトリ）
- `GITHUB_TOKEN`: 公開資料の取得用（任意。指定した場合も GitHub だけに送る）

ツールは仕様を `git show <固定SHA>:<path>` で読み、コードの標準ブランチや PR の base/head を開始時に SHA へ解決する。取得先が公開リポジトリかを確認し、許可パスのファイル名・本文の検索語からコード・関連テストを読む。PR は差分と変更前・変更後を資料に含める。取得したコードを実行したり、そのコードの CI を権限付きで実行したりしない。

初期版では資料のサイズを制限し、仕様は先頭から最大40,000文字、コード候補は最大10ファイル、差分と変更前は最大6ファイルを読む。対象外の箇所や API が省略した差分を確認済みにしない。大きい PR は参照パスを絞るか対象を分割する。変更前が許可パス外になる rename も自動取得しない。ベクトル化・ベクトル DB は使用しない。

生成候補には選択式・記述式、正解、配点付き採点基準、解説、固定版の出典と参照理由、仕様・実装の不整合を記録する。出典は GitHub のコミット固定リンクで確認できる。候補は `draft` で保存し、自動公開しない。

## レビュー・固定版の公開

1. 候補の問題、選択肢、正解、記述式の配点・採点基準、出典の行、不整合を確認する。
2. `node tools/authoring/quiz.mjs check --path questions/spec/rfc-7523.json` で形式を検査する。
3. レビュー後に `status` を `published` にする。定番問題は main、PR 固有の問題は専用ブランチへコミット・push する。
4. その **40文字のコミット SHA** とパスを指定して取り込む。

```sh
node tools/authoring/quiz.mjs publish --commit <40文字のSHA> --path questions/spec/rfc-7523.json
# PR の場合: --path questions/pr/owner/repository/42.json
```

取り込みは同じリポジトリ・コミット・パスなら同じ出題セットになり、後からブランチやファイルを変更しても既存回答の版は変わらない。更新版は新しいセットとして公開する。RFC 7523 のクレームについての選択式・記述式サンプルを収録している。

GitHub Actions の **Author or publish a quiz (manual)** でも実行できる。`quiz-authoring` Environment を作成し、承認する担当者・main のブランチ制限と上記 Access の2つの Secrets、`QUIZ_API_URL` の Variable を設定する。ワークフロー自身も main 上での `workflow_dispatch` だけを許可する。生成候補は `quiz/generated-<run>-<attempt>` ブランチへ保存する。公開は別の手動実行で SHA を指定する。

通常の `pull_request` 検証ワークフローは `contents: read` のみで、AI 実行用 Environment・Secrets・Service Token を参照しない。`pull_request_target` や PR 更新による有料処理の自動開始は使用しない。

## 回答・採点

`/quiz` から公開セットを選択し、選択式・記述式を回答する。本文画面の「問題を解く」は対応する仕様 ID で一覧を絞る。

選択式は保存済み正解との照合で採点する。記述式は回答保存の後、独立した採点依頼 API で Queue に投入し、共通 AI API が保存済み採点基準と出典本文から採点する。受付・結果受信・利用者の回答送信はすべて別エンドポイント。画面は準備状況を確認し、採点が終わると点数・理由・根拠を表示する。

回答は Access の subject と出題セット ID にひも付く。同じ利用者は別ブラウザでも前の回答・結果を確認できる。送信後の内容変更は `409`、同じ内容の再送は同じ結果になる。再回答する場合は新しい回答を開始する。記述式の失敗時も回答を保持し、利用者が採点を再依頼できる。採点結果・profile・promptVersion・実際のモデル・利用量・参照版を履歴に保存する。

採点は参考情報であり、マージ条件として強制しない。AI の点数や理由は出典と照合できるようにしている。API 応答は `no-store` とし、Service Worker も `/api/` をキャッシュしない。

## PR のリンク・Check

GitHub App を対象コードリポジトリへインストールし、**Checks: write、Pull requests: write** を付与する。Worker に以下を設定すると、公開・回答保存・採点完了時に Queue 経由で同期する。

```sh
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_INSTALLATION_ID
npx wrangler secret put GITHUB_APP_PRIVATE_KEY
```

秘密鍵は PKCS#8 PEM (`BEGIN PRIVATE KEY`)。GitHub の RSA PEM が PKCS#1 の場合は、手元で `openssl pkcs8 -topk8 -nocrypt -in app.pem -out app-pkcs8.pem` として変換する。インストールトークンは対象リポジトリ・必要権限に絞って発行する。

- PR の Conversation に出題 URL を表示する。
- 作問時の `headSha` に Check を作り、常に `neutral` の参考情報として回答・採点済み件数を表示する。
- 公開するのは集計件数だけで、利用者名や記述式の回答本文は投稿しない。
- コメントと Check は識別子を記録して更新する。再配信時も既存 ID／マーカーから再利用する。
- GitHub App 未設定時でも出題・採点は独立して利用可能。公開 API は `prIntegration: not_configured` を返す。PR 連携を使う運用では必ず App を設定する。

## API と検証

| API | 用途 |
| --- | --- |
| `GET /api/quiz/config` | ログイン確認・作問権限 |
| `GET /api/question-sets[?spec=ID]` | 公開セット一覧 |
| `GET /api/question-sets/:id` | 正解・採点基準を含まない出題データ |
| `POST /api/question-sets/import` | 作問権限でレビュー済み固定版を公開 |
| `POST /api/authoring/requests` | 作問権限で生成を依頼、`202` |
| `GET /api/authoring/requests/:id` | 作問権限で候補・状態を取得 |
| `GET/POST /api/question-sets/:id/attempts` | 自分の回答履歴／回答開始 |
| `GET /api/attempts/:id` | 自分の回答・採点結果 |
| `POST /api/attempts/:id/answers` | 回答保存・選択式採点 |
| `POST /api/attempts/:id/grading-requests` | 記述式の非同期採点依頼、`202` |
| `POST /api/ai/results` | ジョブ専用トークンで AI の結果を受付 |

新しい AI ジョブは利用者ごとに60秒あたり5回の近似上限（Cloudflare の各拠点）を設ける。共通 API 側のモデル・頻度・支出制限も併用する。Workers Paid、D1、Queues、Claude の費用はそれぞれの契約に従う。

```sh
npm test
npm run check:workers
node tools/authoring/quiz.mjs check --path questions/spec/rfc-7523.json
```

統合テストは workerd・D1・Queue・Service binding・Access の実際の署名検証を使い、共通 AI API と GitHub のネットワーク応答を置き換える。実際の Claude 実行や本番 Access / GitHub App の接続確認は、各サービスの設定後に実施する。静的ファイルの公開対象は `scripts/build-assets.mjs` の許可リストで管理する。
