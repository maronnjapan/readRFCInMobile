# 仕様理解クイズ：配置と運用

## 実装範囲と配置

問題アプリは `apps/quiz/` に集約し、画面・フォーム操作・APIをHonoで構成する。画面HTMLはHono JSXでサーバー描画し、並べ替えはHono JSX DOMで操作する。配置と処理の入口は [アプリのREADME](../README.md) を参照する。この文書のファイルパスとコマンドは、特記しない限り `apps/quiz/` を起点とする。`--path` と出典のファイルパスはリポジトリのルートから指定する。既存の RFC/PDF は共通資料としてルートに置き、`specs/index.json` で ID・状態・版を定義する。チャットや Claude キーは含めない。

| 保存先 | 内容 |
| --- | --- |
| `specs/index.json` | 仕様 ID、題名、提案中／採用済み／草案／廃止済み、本文パス |
| `code-sources.yaml` | 公開コードのリポジトリ、標準ブランチ、仕様 ID、許可パス |
| `mappings/` | 関連仕様・参照先と検索語。例示設定は対象製品に合わせて変更する |
| `questions/spec/` | main で管理する仕様そのものの問題 |
| `questions/pr/` | 専用ブランチに保存する PR 固有の問題 |
| `.authoring-work/` | 固定コミットで取得したコード。Git 管理・静的配信の対象外 |
| D1 | 問題セットの固定版、利用者ごとの回答、選択式・並べ替えの点数、非同期採点ジョブ、採点理由・出典・実行設定の履歴 |

問題ファイルでは `questions` と `solutions` を分離する。静的配信の `dist/` には問題ファイルや採点基準をコピーせず、出題 API も各問題への回答前にその正解・採点基準・出典本文を返さない。公開問題リポジトリ自体には解答があるため、練習用の設計である。

## 問題のカテゴリと回答方式

カテゴリ（何を確かめるか）と回答方式（どう答えるか）を分ける。

| category | 目的・例 | 基本の回答方式 |
| --- | --- | --- |
| `vocabulary` | 用語を平易な説明に置き換える。例: redirect_uri → 認可コードなどを渡すリダイレクト先のURL。対訳・翻訳問題にはしない | 選択式 |
| `knowledge` | 要件・概念・条件を確認する | 選択式 |
| `flow` | 手順・処理フローを組み立てる | 並べ替え |
| `design` | ユースケースの制約を満たす設計と理由を答える | 記述式、または設計案の選択式 |
| `debugging` | 不具合・仕様違反を見つけ、原因や修正を特定する | 選択式 |
| `comparison` | 似た概念・方式を比較し、使い分ける | 選択式 |

`questions[].type` は `choice` / `ordering` / `written`。旧ファイルで `category` がない場合は `knowledge` として扱う。`vocabulary` には `term`、`design` と `debugging` には具体的な `scenario` が必要。記述式には任意の `answerHint` を付けられる。設計の採点基準では文章量を評価せず、短い箇条書きや制約を満たす代替案も評価する。

並べ替えは `items: [{ "id": "send", "text": "登録要求を送る" }, ...]` に2〜8個の異なる項目を持ち、`solutions[id].answer` に全項目IDの正しい順序を保存する。同じ制約を満たす複数の順序がある場合は、追加の完全な順序を `acceptedOrders` に列挙できる。いずれかに一致すれば満点、それ以外は0点。正解・許容順序は採点前の出題データに含めない。

画面はスマホを主な利用環境とし、1列表示、44px以上のタッチ領域、16px以上の入力文字を使う。並べ替えは候補をタップして順に追加し、上下ボタン・「外す」で修正できる。ドラッグ操作は不要で、キーボードでも操作可能。途中の並べ替えは同じタブの下書きへ保存し、採点済み回答はサーバーから復元する。長い用語も画面幅で折り返す。

## Cloudflare Workers Paid の初期設定

Node.js 22 以降を使用する。リポジトリのSecret `CLOUDFLARE_API_TOKEN` を登録すると、`main` の更新時にD1・Queues・Workerをデプロイする。手元で実行する場合も、トークンを環境変数へ設定して以下を実行する。リソースの手動作成や `database_id` の書き換えは不要。

```sh
npm ci             # リポジトリのルートで実行
npm run deploy:workers
```

[デプロイとデストロイ](deployment.md)にトークン権限、CIのVariables・Secrets、削除、途中失敗からの復旧手順をまとめている。D1の実ID入り設定は `.wrangler/quiz-deploy/` へ生成する。以下のWorker設定はCIのVariablesまたはCloudflareの管理画面で設定でき、再デプロイ時も維持する。既定値を変更する場合は `wrangler.jsonc` を編集する。

- `APP_ORIGIN`: 公開する出題サービスの HTTPS オリジン
- `AI_EXECUTOR_URL`: 共通 AI API の HTTPS エンドポイント（例: `https://ai-api.example.com/v1/requests`）
- `AI_EXECUTOR_TRANSPORT=https`, `AI_EXECUTOR_AUTH=api-key`: 現在の共通 AI API 呼び出し方式
- `QUESTION_REPOSITORY`: 問題を読む公開リポジトリ
- `QUESTION_DEFAULT_BRANCH`: 定番問題を管理する標準ブランチ（既定 `main`）。仕様問題の公開時は、そのコミットが標準ブランチの履歴に含まれることを確認する
- `CODE_REPOSITORIES`: PR 連携を許可する公開リポジトリ（カンマ区切り）
- `ACCESS_ISSUER`, `ACCESS_AUD`: Cloudflare Access アプリの issuer と Application Audience
- `AUTHOR_SUBJECTS` または `AUTHOR_EMAILS`: 作問・公開を許可する Access の subject／メールアドレス。Access Service Token は JWT の `sub` が空なので、署名検証した `common_name` に `service:` を付けた値（例: `service:abc123.access`）を `AUTHOR_SUBJECTS` に含める
- 共通 AI API の接続先は [非同期 AI 実行契約](ai-executor-contract.md) に対応させる
- `AUTHORING_PROFILE`, `GRADING_PROFILE`: 共通 API 側で承認された Claude の実行設定

Cloudflare Access に許可利用者の Allow ポリシーと、作問用 Service Token の Service Auth ポリシーを設定する。保護対象には `/quiz`・`/quiz/*` の画面と `/api/*` を含める。`/api/ai/results` だけは別アプリ／ポリシーで Bypass し、Worker 内のジョブ専用トークン認証を使う。それ以外の画面・APIはAccess JWTの署名・issuer・audience・有効期限・subjectをWorker自身でも検証する。未設定時・未認証時に匿名の有料実行へフォールバックしない。

`AI_EXECUTOR_API_KEY` はCIのSecretまたはCloudflareのWorker Secretへ登録する。`AI_CALLBACK_SECRET` は初回デプロイでランダムな64桁のhex値を生成し、Worker Secretへ保存する。既存の値は更新しない。自分で指定する場合は32文字以上のSecretを設定する。

`npm run deploy:workers` は既存環境の更新時もWorkerの公開前にリモートDBマイグレーションを実行する。`0002_choice_answers.sql` は1問ごとの選択式回答を保存し、`0003_instant_answers.sql` は選択式・並べ替えに共通のJSON回答テーブルを追加して旧回答を引き継ぐ。更新中に旧 Worker が保存した回答も、次の読み込み時に引き継ぐ。

`AI_EXECUTOR_API_KEY` は共通 AI API へのサーバー間認証にだけ使用し、`Authorization: Bearer` で送る。Claude キーは **共通 AI API 側だけ**に登録する。共通 API はキーごとに許可操作・利用上限を管理し、推論完了を待たず依頼を永続化して `202` を返し、完了時に別リクエストで結果を返す。

認証アダプタは `fetch(request, send) -> Promise<Response>` の契約で差し替える。OAuth + DPoP の実装は利用側が用意し、`worker/ai-executor-auth.js` へ接続する。詳細は [差し替え契約](ai-executor-contract.md#認証アダプタの差し替え) を参照する。

Service binding を使用する場合は、標準の HTTPS 設定から明示的に変更する。

```json
{
  "services": [{ "binding": "AI_EXECUTOR", "service": "ai-execution-api" }],
  "vars": { "AI_EXECUTOR_TRANSPORT": "service-binding", "AI_EXECUTOR_AUTH": "service-binding" }
}
```

上記は `wrangler.jsonc` へ追加・統合する設定差分。共通 API を非公開 Worker とし、binding で許可した実行元だけを受け付ける。API キー未設定や認証方式の誤記を理由にこの方式へ自動変更することはない。

ローカル開発は `.dev.vars.example` を `.dev.vars` にコピーして設定し、`npm run db:migrate:local` と `npm run dev` を使う。Access JWT を発行する実環境と共通 AI Worker の接続が必要な操作は、対応する開発環境に接続する。依存サービスを使用せず確認する場合は、統合テストのモックを使う。認証を省略する本番コード用スイッチは設けていない。

## 手動で作問する

仕様だけの場合、コードの取得は不要。

```sh
node tools/authoring/quiz.mjs generate --spec rfc-7523
# 既定は6問・全6カテゴリ。カテゴリを絞る場合:
node tools/authoring/quiz.mjs generate --spec rfc-7591 --count 3 --categories vocabulary,knowledge,flow
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

生成候補にはカテゴリ、回答方式、正解、配点付き採点基準、解説、固定版の出典と参照理由、仕様・実装の不整合を記録する。指定カテゴリを各1問以上含むことを結果受信時に検証する。問題数は2〜10問、指定カテゴリ数以上とする。出典は GitHub のコミット固定リンクで確認できる。候補は `draft` で保存し、自動公開しない。

## レビュー・固定版の公開

1. 候補の問題、選択肢、正解、記述式の配点・採点基準、出典の行、不整合を確認する。
2. `node tools/authoring/quiz.mjs check --path apps/quiz/questions/spec/rfc-7523.json` で形式を検査する。
3. レビュー後に `status` を `published` にする。定番問題は main、PR 固有の問題は専用ブランチへコミット・push する。
4. その **40文字のコミット SHA** とパスを指定して取り込む。

```sh
node tools/authoring/quiz.mjs publish --commit <40文字のSHA> --path apps/quiz/questions/spec/rfc-7523.json
# PR の場合: --path apps/quiz/questions/pr/owner/repository/42.json
```

取り込みは同じリポジトリ・コミット・パスなら同じ出題セットになり、後からブランチやファイルを変更しても既存回答の版は変わらない。更新版は新しいセットとして公開する。ファイル移動前の `questions/spec/`・`questions/pr/` のパスも、固定SHAによる取り込みに対応する。RFC 7523 の従来形式と、全6カテゴリ・3回答方式を含む [RFC 7591 のサンプル](../questions/spec/rfc-7591.json) を収録している。

GitHub Actions の **Author or publish a quiz (manual)** でも実行できる。`quiz-authoring` Environment を作成し、承認する担当者・main のブランチ制限と上記 Access の2つの Secrets、`QUIZ_API_URL` の Variable を設定する。ワークフロー自身も main 上での `workflow_dispatch` だけを許可する。生成候補は `quiz/generated-<run>-<attempt>` ブランチへ保存する。公開は別の手動実行で SHA を指定する。

通常の `pull_request` 検証ワークフローは `contents: read` のみで、AI 実行用 Environment・Secrets・Service Token を参照しない。`pull_request_target` や PR 更新による有料処理の自動開始は使用しない。

## 回答・採点

`/quiz` から公開セットを選択する。選択式・並べ替えは1問ずつ表示し、「採点する」で回答を保存して、即座に正誤・点数・解説を表示する。「次の問題へ」で結果を確認しながら進み、即時採点の問題が終わったら記述式の回答に進む。本文画面の「問題を解く」は対応する仕様 ID で一覧を絞る。

選択式・並べ替えは1問ごとの API で保存済み正解と照合し、記述式や残りの問題の回答を待たず、同じリクエストで結果を返す。未回答の問題の正解・解説は返さない。記述式のないセットは最後の1問で採点が完了する。途中で画面を閉じても、回答済みの結果と未回答の続きへ戻れる。

記述式はまとめて回答を保存した後、独立した採点依頼 API で Queue に投入し、問題アプリが保存済み採点基準・出典本文・回答を含むプロンプトを組み立て、共通AI APIがそのままClaudeへ渡して採点する。記述式だけのセットも利用できる。受付・結果受信・利用者の回答送信はすべて別エンドポイント。画面は準備状況を確認し、採点が終わると点数・理由・根拠を表示する。

回答は Access の subject と出題セット ID にひも付く。同じ利用者は別ブラウザでも前の回答・結果を確認できる。送信後の内容変更は `409`、同じ内容の再送は同じ結果になる。再回答する場合は新しい回答を開始する。記述式の失敗時も回答を保持し、利用者が採点を再依頼できる。採点結果・profile・promptVersion・実際のモデル・利用量・参照版を履歴に保存する。

採点は参考情報であり、マージ条件として強制しない。AI の点数や理由は出典と照合できるようにしている。API応答と利用者ごとの画面HTMLは `no-store` とし、Service Workerも `/api/`・`/quiz` をキャッシュしない。

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

## Honoの画面ルート

| 画面ルート | 動作 |
| --- | --- |
| `GET /quiz[?spec=ID]` | 問題一覧のHTML |
| `GET /quiz?set=ID` | 問題セットと自分の回答履歴 |
| `GET /quiz?attempt=ID[&question=ID]` | 1問の出題・即時採点の解説・記述式・結果 |
| `POST /quiz/attempts` | 回答開始 |
| `POST /quiz/attempts/:id/instant-answers` | 選択式・並べ替えの回答と即時採点 |
| `POST /quiz/attempts/:id/answers` | 記述式の保存 |
| `POST /quiz/attempts/:id/grading-requests` | 独立した非同期採点依頼 |

画面もAccess認証と所有者確認を通す。通常のフォームには303リダイレクトを返し、ブラウザの送信補助には遷移先JSONを返す。画面の状態とHTMLはHonoが描画する。静的な `quiz.html` は生成せず、旧URLは `/quiz` へリダイレクトする。

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
| `GET /api/attempts/:id` | 自分の回答・途中経過・採点結果 |
| `POST /api/attempts/:id/instant-answers` | 選択式・並べ替えを1問保存し即時採点。`{ "questionId": "client-sub", "answer": 0 }` / `{ "questionId": "registration-order", "answer": ["prepare", "send", "register", "receive"] }` |
| `POST /api/attempts/:id/choice-answers` | 既存クライアント用の互換エンドポイント（同じ処理） |
| `POST /api/attempts/:id/answers` | 選択式・並べ替えの完了後、記述式の回答を保存 |
| `POST /api/attempts/:id/grading-requests` | 記述式の非同期採点依頼、`202` |
| `POST /api/ai/results` | ジョブ専用トークンで AI の結果を受付 |

選択式・並べ替えはセット内の即時採点の問題順に受け付け、同じ回答の再送は同じ結果を返す。並べ替えは全項目が1回ずつ含まれることも検証する。回答後の変更や未回答の問題を飛ばす送信は `409`。`GET /api/attempts/:id` の `answers` と `results` は途中経過も返し、`completed` が全問の回答保存済み、`status: graded` が全問の採点完了を表す。

新しい AI ジョブは利用者ごとに60秒あたり5回の近似上限（Cloudflare の各拠点）を設ける。共通 API 側のモデル・頻度・支出制限も併用する。Workers Paid、D1、Queues、Claude の費用はそれぞれの契約に従う。

```sh
npm test
npm run check:workers
node tools/authoring/quiz.mjs check --path apps/quiz/questions/spec/rfc-7523.json
node tools/authoring/quiz.mjs check --path apps/quiz/questions/spec/rfc-7591.json
```

統合テストは workerd・D1・Queue・HTTPS / Service binding・Access の実際の署名検証を使い、共通 AI API と GitHub のネットワーク応答を置き換える。API キーの送信と、認証アダプタの差し替えも検証する。実際の Claude 実行や本番 Access / GitHub App の接続確認は、各サービスの設定後に実施する。画面HTMLはHonoが描画する。CSS・ブラウザ用JavaScriptなどの配信対象は `scripts/build.mjs` で管理し、リーダーの公開ファイルはルートの `scripts/build-assets.mjs` から組み立てる。
