# Workersへのデプロイとリソース削除

Node.js 22以降とCloudflare Workers Paidを使用する。リポジトリのルートでも `apps/quiz/` でも同じnpmコマンドを使える。スクリプトはD1・AI Queue・dead-letter Queue・Workerをまとめて扱う。Cloudflare Accessのアプリ／ポリシー、外部AI API、GitHub Appはそれぞれの管理画面で設定する。

## GitHub Actionsで公開する

リポジトリのSecret `CLOUDFLARE_API_TOKEN` を使用する。トークンには、対象アカウントの **Workers Scripts: Edit、D1: Edit、Queues: Edit** を付ける。アカウントIDを自動取得する場合は、アカウント一覧を読める権限も必要。取得できない場合や対象アカウントが複数ある場合は、リポジトリまたは `quiz-production` EnvironmentのVariable `CLOUDFLARE_ACCOUNT_ID` を設定する。同名のSecretからも読み取れる。

Cloudflareで `workers.dev` のサブドメインを設定しておく。既定の公開先は `https://spec-understanding-quiz.<サブドメイン>.workers.dev`。アカウント全体のサブドメインはスクリプトから変更しない。独自ドメインを使う場合は、あらかじめルーティングを用意して `QUIZ_APP_ORIGIN` を指定する。

`.github/workflows/deploy-workers.yml` は、アプリ・本文・公開用ファイルなどに関係する `main` のpush、またはmainを選んだ手動実行で動く。

1. 本番Secretを渡さず `npm ci`、全テスト、Workersのdry-runを実行する。
2. `quiz-production` Environmentのジョブで、リポジトリSecretを使って実際にデプロイする。
3. D1・Queuesを名前で探し、存在すれば再利用、なければ作成する。Workerにも所有情報を記録する。
4. 実際のD1 ID入りのWrangler設定を生成し、リモートのマイグレーションを適用してWorkerを公開する。
5. Worker Secretsを設定し、ジョブのサマリーとEnvironmentにURLを表示する。

`quiz-production` Environmentに承認・main限定などの保護規則を追加できる。通常のPR検証は本番Secretを使わず、デプロイワークフローもPRブランチでは動かない。デプロイと削除は同じconcurrencyグループで直列に実行し、進行中の処理を後続実行でキャンセルしない。

### アプリを接続する設定

CIのVariablesは次のとおり。未指定の場合は既存Workerの値を維持し、それもなければ `wrangler.jsonc` の既定値を使う。設定の詳細は[運用手順](quiz-service.md#cloudflare-workers-paid-の初期設定)を参照する。

| Variable | 用途 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | 対象アカウント。アクセス可能なアカウントが1つなら省略可能 |
| `QUIZ_WORKER_NAME` | Worker名。既定は `spec-understanding-quiz` |
| `QUIZ_APP_ORIGIN` | HTTPSオリジン。省略時は既存の値またはworkers.dev。既存の `QUIZ_API_URL` も使用可能 |
| `ACCESS_ISSUER`, `ACCESS_AUD` | AI採点・管理操作に使うCloudflare Accessのissuerとaudience（通常回答には不要） |
| `AUTHOR_SUBJECTS`, `AUTHOR_EMAILS` | 作問・公開を許可する利用者／Service Token |
| `AI_EXECUTOR_URL`, `AI_EXECUTOR_TRANSPORT`, `AI_EXECUTOR_AUTH` | 外部AI API。既定は `https` と `api-key` |
| `QUESTION_DEFAULT_BRANCH` | 定番問題の標準ブランチ。既定は `main` |
| `AUTHORING_PROFILE`, `GRADING_PROFILE` | 共通AI APIで承認された実行設定 |

問題リポジトリ `QUESTION_REPOSITORY` はCIがこのリポジトリ名に設定する。名前変更だけでは別環境にならない。DB名・Queue名は `wrangler.jsonc` で管理するため、別環境を作る場合はそれぞれ異なる名前を指定する。

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | デプロイ／削除用。必須 |
| `AI_EXECUTOR_API_KEY` | 外部AI APIの呼び出し元用キー。AIを利用するときに設定する |
| `AI_CALLBACK_SECRET` | 結果受信用。未作成ならランダムに生成し、以後は既存値を維持 |
| `QUIZ_GITHUB_APP_ID`, `QUIZ_GITHUB_INSTALLATION_ID`, `QUIZ_GITHUB_APP_PRIVATE_KEY` | 任意のPR連携。Workerでは先頭の `QUIZ_` を除いた名前へ登録 |

GitHub Appの秘密鍵はPKCS#8 PEMを使用する。Claudeのキーは外部AI API側だけに置く。AccessやAI APIが未設定でも、問題一覧・選択式・並べ替え・記述式回答の保存を利用できる。AI採点と管理操作にはAccess設定が必要。既存のAccessアプリが `/quiz` や `/api/*` 全体を保護している場合は、[保護するパス](quiz-service.md#cloudflare-workers-paid-の初期設定)を絞る。Workerの更新だけではAccessの入口の設定は変わらない。

## 手元で公開する

環境変数 `CLOUDFLARE_API_TOKEN` を設定する。値をGitへ保存しない。必要に応じて `CLOUDFLARE_ACCOUNT_ID` と、上表の接続設定を設定する。手元のオリジン指定は `APP_ORIGIN` を使用する。

```sh
npm ci
npm run deploy:workers
```

ビルド、リソース準備、DB更新、公開までを実行する。2回目以降も同じコマンドを使う。既存のWorker Secretsは維持し、環境変数に指定したSecretだけを追加・更新する。`AI_CALLBACK_SECRET` を変更すると処理中ジョブのコールバック認証に影響するため、通常は初回生成した値を維持する。

`wrangler.jsonc` のD1 IDはローカル開発用の仮値のままでよい。実際のID・絶対パスを含む設定は `apps/quiz/.wrangler/quiz-deploy/<Worker名>.wrangler.json` に生成し、Gitへ追加しない。

## 作成したものを削除する

同じCloudflare用の環境変数を使い、まず削除計画を表示する。このコマンドだけでは削除しない。

```sh
npm run destroy:workers
```

削除を実行するには対象Worker名を完全一致で指定する。

```sh
npm run destroy:workers -- --confirm spec-understanding-quiz
```

削除するのは、このデプロイが新規作成したWorker・Queue・D1。Queueのconsumerを解除し、Worker、Queue、最後に状態を保存するD1を削除する。**作成したD1の削除は回答・採点結果・追加登録した問題の固定版参照も削除する。** 問題JSONはGitHubに残る。再実行は削除済みのリソースを読み飛ばす。

デプロイ前から存在したWorker・D1・Queueは残す。新規Workerを既存Queueへ接続していた場合、そのWorkerのconsumerだけを解除する。再利用したD1ではこのデプロイの管理行のみを除去し、アプリのデータやマイグレーション履歴は残す。既存Workerが新しく作ったリソースを使っている場合は、先にそのbindingを手動で切り離す。所有マーカーの異なるWorker、別consumerのある作成済みQueue、別デプロイの管理行もあるD1は削除を拒否する。

GitHub Actionsの **Destroy quiz Cloudflare resources (manual)** でも削除できる。mainを選び、`confirm_worker` に同じWorker名を入力する。`state_run_id` は通常空でよい。mainへのpushから削除が自動実行されることはない。

## 状態の保存と途中失敗からの復旧

作成・再利用したリソースのIDと作成者情報を次へ保存する。APIトークンやWorker Secretsの値は含めない。

- ローカル: `apps/quiz/.wrangler/quiz-deploy/<Worker名>.state.json`
- D1: `_quiz_deployment_state` テーブルのWorker別の行
- CI: `quiz-deployment-state-<run ID>` Artifact。失敗したジョブも保存し、保持期間は30日

新しいCIランナーでもD1から所有情報を復元する。リソース作成のたびに記録するため、途中失敗時も再デプロイ・削除を同じ記録から実行できる。作成したリソースを失敗直後に自動削除する処理は行わない。

D1への状態保存前に失敗した場合は、CIのArtifactから状態ファイルを取得する。削除用ワークフローの `state_run_id` にそのデプロイ実行のIDを指定するか、手元で取得したファイルを指定する。

```sh
npm run destroy:workers -- --state /path/to/spec-understanding-quiz.state.json
npm run destroy:workers -- --state /path/to/spec-understanding-quiz.state.json --confirm spec-understanding-quiz
```

CIで復元できるのは同じリポジトリのmain上で動いたデプロイワークフローのArtifactだけ。ローカル状態とD1状態が別デプロイを示す場合やアカウントが違う場合も停止する。対象リソース名を変える前に既存環境を片付け、状態ファイルを復旧に備えて保管する。
