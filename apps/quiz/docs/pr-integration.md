# PR 情報の受け取りと、問題ファイルの公開

初回の設定から問題表示まで操作する場合は、[ステップごとの手順書](pr-quiz-walkthrough.md)を先に参照してください。PR #194 を例に、送信・資料保存・別途の問題作成・main への反映・デプロイ・匿名回答を順に確認できます。本書には処理の仕様と接続設定の詳細をまとめています。

maronn-openid-connect は PR 番号や対象仕様などの情報を渡す。readRFCInMobile はその情報を作問資料として保存し、別途作られた問題ファイルを公開・出題する。作問する人やツールは、ローカルの Claude Code、手作業、任意の AI API などから選べる。

```text
maronn-openid-connect → 作問情報を送信
  → readRFCInMobile の prepare → 作問資料を Git に保存
  → 別途、資料から問題 JSON を作成
  → 問題 JSON を main に反映・デプロイ、または固定版を publish
  → 回答ページを公開 → 元の PR に回答 URL を返す
```

資料の受信・保存と、作成済み問題の公開・回答は、AI 作問 API の設定なしで利用できる。ログイン後に依頼する記述式・実装の AI 採点は独立した機能として残る。

## 1. PR の情報を受け取る

送信側の **Request PR quiz materials** から、このリポジトリの `quiz-authoring.yml` を `workflow_dispatch` で呼ぶ。

| 入力 | 内容 |
| --- | --- |
| `ref` | `main` |
| `operation` | `prepare` |
| `code_source` | `maronn-openid-connect`。登録済み ID のほか `owner/repository` も指定可能 |
| `pr_number` | 対象 PR 番号 |
| `spec_id` | 任意。仕様と照合するときだけ指定 |
| `focus_paths` | 任意の対象パス。空欄なら PR の変更ファイル全体 |
| `question_count` / `question_categories` | 作問する人・ツールへの任意のメモ。ここでは作問しない |

旧送信側の `operation=generate` も、受信側では `prepare` として扱う。旧 `part` 入力は互換用で、ファイルを分割・制限しない。

受信側の **Prepare quiz materials or publish a quiz** は、公開 PR の base/head と共通祖先を固定し、変更一覧、本文・議論、取得できる差分、変更前後の全文コード、対応テスト、指定された仕様を保存する。コードは実行しない。バイナリは変更情報と固定版を残し、本文の省略を明記する。GitHub API 自体の取得上限・省略も確認済みの資料として扱わない。

保存先は `apps/quiz/materials/pr/<owner>/<repo>/<PR番号>/<資料ID>.json`、ブランチは `quiz/materials-<run>-<attempt>`。Summary の「資料を見る」から開く。資料の形式は `format:"quiz-authoring-materials",version:1` で、`context` に出典の抜粋、`files` に取得した全文資料を持つ。PR の本文・議論も全文を `files` に残す。

この操作に Cloudflare Access の Service Token、作問 AI、PR コメント用の GitHub App は不要。送信側は readRFCInMobile の Actions: write を持つ `QUIZ_DISPATCH_TOKEN` を設定する。受信側は自分の `GITHUB_TOKEN` で資料を取得・保存する。

ローカルでも同じ資料を保存できる。

```sh
npm ci
node apps/quiz/tools/authoring/quiz.mjs prepare --source maronn-openid-connect --pr 194
node apps/quiz/tools/authoring/quiz.mjs prepare --source maronnjapan/maronn-openid-connect --pr 194 --spec rfc-6749 --paths packages/core/src/
```

## 2. 問題 JSON を別途作る

保存された資料を読み、[共通の作問形式](../../../skills/quiz-authoring/SKILL.md)に従って問題を作る。作問方法や使用モデルの情報、AI のジョブ ID は問題ファイルの必須項目ではない。

公開用ファイルには次を持たせる。

- `format:"spec-understanding-quiz",version:1,status:"published"`。
- `id,title,spec,pullRequest,references,questions,solutions,inconsistencies`。
- PR の repository・番号・baseSha・headSha と、固定した出典。仕様を指定しない場合は `spec:null`。
- 各問題の `id,type,category,prompt,points,referenceIds` と回答方式に必要な項目。
- `solutions` に正解・解説・採点基準。未回答の画面や静的アセットには配信しない。

保存先は `apps/quiz/questions/pr/<owner>/<repo>/<PR番号>/<問題ID>.json`。PR 問題の問題数・出典数、対象リポジトリ・ディレクトリに独自の上限や許可リストはない。8変更ファイルずつの分割も行わない。ファイル形式・出典の固定版・認証・HTTP サイズなどの入力検証は適用する。保存した版の問題は PR の head が更新された後も回答できる。

```sh
node apps/quiz/tools/authoring/quiz.mjs check --path apps/quiz/questions/pr/owner/repository/194/example.json
```

## 3. 問題を公開し、PR へ URL を返す

次のどちらでも公開でき、AI 作問を経由する必要はない。

1. 公開用 JSON を main にコミット・push する。通常の Worker デプロイが問題ファイルを取り込み、`/quiz` の一覧から匿名で回答できる。GitHub App の設定があれば Cron が PR 問題を登録し、Queue が元の PR のコメントと neutral Check に URL を返す。
2. 別ブランチのファイルを公開する場合は、コミット・push 後に **Prepare quiz materials or publish a quiz** を main 上で実行する。`operation=publish`、`commit=<問題の40文字SHA>`、`path=<問題JSONのパス>` を指定する。Summary に回答 URL が表示され、設定済みなら PR への返却を Queue に依頼する。同じ固定版の再登録は同じ URL になる。

`publish` は出題 Worker の `QUIZ_API_URL` と作問者の Access Service Token を使う。AI API は呼ばない。GitHub App が未設定でも公開・回答でき、その場合の PR 連携結果は `not_configured`。設定済みの `queued` は非同期の投稿依頼済みを表す。PR リンクが出ない場合は Worker のログと App のインストール先・権限を確認する。投稿失敗は outbox と Cron で再試行する。

| 設定先 | 公開・回答・採点に必要な設定 |
| --- | --- |
| Worker | [デプロイ設定](deployment.md)。AI 作問の接続は任意 |
| readRFCInMobile の `quiz-authoring` Environment | 手動 `publish` 用の `QUIZ_API_URL`、`CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET` |
| Worker の `AUTHOR_SUBJECTS` | 上記 Access Service Token の `service:<common_name>` |
| `quiz-production` Environment | PR にリンクを返す場合は `QUIZ_GITHUB_APP_ID`・`QUIZ_GITHUB_INSTALLATION_ID`・`QUIZ_GITHUB_APP_PRIVATE_KEY`。App を返却先にインストールし Checks: write・Pull requests: write を付与 |
| Worker の Access・共通 AI API 設定 | ログイン後の記述式・実装の AI 採点を利用する場合に設定 |

## 任意の AI 作問

保存済み資料から AI に候補を作らせる場合だけ、独立した **Generate a draft quiz with AI (optional)**（`quiz-ai-authoring.yml`）を手動実行する。資料の固定コミット・パスと、問題数・カテゴリを指定する。生成候補は draft として保存し、自動公開しない。

```sh
node apps/quiz/tools/authoring/quiz.mjs generate --materials apps/quiz/materials/pr/owner/repository/194/material.json --count 2 --categories knowledge,debugging
```

既存の共通 AI API の契約を使う。入力サイズ・モデル出力の制約があるため、巨大な資料は参照箇所を選ぶか、全文資料をローカルの作問ツールへ渡す。これらの制約は、資料の受信や完成済み PR 問題の公開とは独立している。

## 接続設定の画面操作

以下は、公開・ログイン後の AI 採点・PR へのリンク返却・任意の AI 作問に使う設定です。資料の受け取りには不要で、利用する機能の節を設定します。既存の設定は作り直さず、各節の「完了の確認」で確認できます。

## 0. 最初に確認すること

### 0-1. 作業する場所を確認する

| 作業する場所 | 作るもの | 完了する節 |
| --- | --- | --- |
| readRFCInMobile の GitHub 設定 | 本番用と作問用の設定の保存場所 | 1 |
| Cloudflare | 作問用の鍵、作問を許可するルール | 3〜4 |
| GitHub の個人設定 | PR に投稿するアプリ | 5 |
| readRFCInMobile の GitHub 設定 | 上で取得した値の登録 | 6 |
| readRFCInMobile の Actions | 設定の反映 | 7 |
| maronn-openid-connect の GitHub 設定 | 資料保存を依頼する鍵の登録 | [送信側の手順](https://github.com/maronnjapan/maronn-openid-connect/blob/main/docs/pr-quizzes.md) |

GitHub の **Environment** は、設定をまとめて保存する場所です。この手順では `quiz-production` と `quiz-authoring` という名前で作ります。同じ名前でも、リポジトリが違えば別の保存場所です。

保存する値には2種類あります。**Variable** は URL や名前などの設定値、**Secret** はパスワードに相当する値です。各手順でどちらに保存するか指定します。

### 0-2. 必要なアカウント・実装を確認する

- GitHub で両リポジトリの Settings を編集できること。
- 問題アプリを置く Cloudflare アカウントを管理できること。このアプリは Workers Paid を前提にしています。
- 問題アプリのコードが readRFCInMobile の main に入っていること。[作問処理のファイル](https://github.com/maronnjapan/readRFCInMobile/blob/main/.github/workflows/quiz-authoring.yml)が開ければ確認できます。
- **ログイン後の AI 採点・任意の AI 作問を使う場合だけ、別の「AI 実行サーバー」が必要です。** このサーバーの実装は、今回の2リポジトリには含まれていません。資料保存や問題ファイルの公開・通常の回答には不要です。

「AI 実行サーバー」は、問題アプリから依頼を受けて Claude を呼び、結果を問題アプリに返すサーバーです。Claude の API キー、ChatGPT の契約、Claude Code のルーチンの URL だけでは代わりになりません。

AI 採点や任意の AI 作問を利用する場合は、管理者から次の接続情報を入手します。

| 入手するもの | あとで登録する名前 | 値の例・確認すること |
| --- | --- | --- |
| 採点依頼・任意の作問依頼を受ける HTTPS URL | `AI_EXECUTOR_URL` | `/v1/requests` などを含む**完全な受付 URL** |
| 問題アプリ用に発行した接続用の鍵 | `AI_EXECUTOR_API_KEY` | サーバーが `Authorization: Bearer` で受け付ける鍵。Claude 自体の API キーとは別 |
| 実行設定の名前 | `AUTHORING_PROFILE`、`GRADING_PROFILE` | AI 採点は `quiz-written-v1`、任意の AI 作問は `quiz-generate-v1`。利用する機能の設定がサーバー側に必要 |

AI 採点・任意の AI 作問を利用する場合のサーバー仕様は [AI 実行サーバーの準備状況](ai-executor-preparation.md)を参照します。サーバーがなくても、本書の資料保存と、別途作成した問題 JSON の公開・回答は進められます。

### 0-3. 問題アプリの URL を控える

1. [readRFCInMobile の公開処理](https://github.com/maronnjapan/readRFCInMobile/actions/workflows/deploy-workers.yml)を開きます。
2. 一番新しい成功した実行を開きます。
3. **Summary → Quiz deployment → URL** をコピーします。末尾の `/quiz` は付けません。
4. その URL に `/quiz` を付けてブラウザで開き、既存の問題一覧が表示されることを確認します。

公開先の例は `https://spec-understanding-quiz.maronn.workers.dev` です。以降はこの値を例にします。別の URL で公開している場合は置き換えてください。

まだ公開処理が成功していない場合は、2で Cloudflare の公開用の鍵を登録し、7で初回公開を実行します。

**完了の確認：** 自分の問題アプリの URL と、AI 実行サーバーが用意済みかどうかが分かっていること。

## 1. readRFCInMobile に設定の保存場所を2つ作る

1. [readRFCInMobile の Environments](https://github.com/maronnjapan/readRFCInMobile/settings/environments)を開きます。
2. `quiz-production` があれば開きます。なければ **New environment** を押し、名前に `quiz-production` を入力して **Configure environment** を押します。
3. 同じ操作で `quiz-authoring` も作ります。
4. 作成したそれぞれの画面で、**Environment secrets** と **Environment variables** の欄を確認します。

これ以降、Secret の登録は **Add environment secret → Name と Value → Add secret**、Variable の登録は **Add environment variable → Name と Value → Add variable** で行います。既存の項目は編集ボタンで更新します。

| 保存場所 | 用途 |
| --- | --- |
| `quiz-production` | 問題アプリ本体に設定を反映するときに使う |
| `quiz-authoring` | 固定版の手動公開・任意の AI 作問に使う。資料保存には不要 |

既存の承認ルールがある場合、Actions の実行時に **Review deployments** から承認する必要があります。両方の処理は main を選んだときに動きます。

**完了の確認：** このリポジトリの Environments 一覧に2つの名前が表示されること。

## 2. Cloudflare に問題アプリを公開する鍵を登録する

**すでに公開が成功していて `CLOUDFLARE_API_TOKEN` が登録されている場合は、この節を飛ばします。** 登録済みの Secret の値を読み出す必要はありません。

1. [Cloudflare の API Tokens](https://dash.cloudflare.com/profile/api-tokens)を開きます。
2. **Create Token → Create Custom Token** を選びます。
3. 名前を `readrfc-quiz-deploy` にします。
4. Permissions に次を追加します。対象はすべて **Account** です。

| 権限 | 設定 |
| --- | --- |
| Workers Scripts | Edit |
| D1 | Edit |
| Queues | Edit |

5. **Account Resources → Include → Specific account** で、問題アプリを置く自分のアカウントを選びます。
6. **Continue to summary → Create Token** を押し、表示された値をコピーします。
7. readRFCInMobile の **Settings → Environments → quiz-production → Add environment secret** を開きます。
8. Name を `CLOUDFLARE_API_TOKEN`、Value を6でコピーした値にして保存します。
9. Cloudflare の対象アカウントで **Workers & Pages** を開き、アカウント詳細にある **Account ID** をコピーします。
10. GitHub の同じ `quiz-production` に、Variable `CLOUDFLARE_ACCOUNT_ID` として保存します。

この鍵は問題アプリの公開用です。後で作る Cloudflare の作問用の鍵や GitHub の起動用の鍵とは別です。

**完了の確認：** `quiz-production` に Secret `CLOUDFLARE_API_TOKEN` と Variable `CLOUDFLARE_ACCOUNT_ID` が表示されること。

## 3. Cloudflare で固定版の手動公開・任意の AI 作問用の鍵を作る

1. [Cloudflare](https://dash.cloudflare.com/)で問題アプリを置いたアカウントを開き、**Zero Trust** を開きます。
2. 初めて開く場合はチーム名を決め、Zero Trust の初期設定を完了します。チーム名は `自分のチーム名.cloudflareaccess.com` の一部になります。
3. **Access controls → Service credentials → Service Tokens** を開きます。以前の画面では **Access → Service Auth → Service Tokens** と表示されることがあります。
4. **Create Service Token** を押します。
5. 名前を `readrfc-quiz-authoring` にし、有効期限を選び、**Generate token** を押します。
6. 表示された **Client ID** と **Client Secret** を控えます。Client Secret が全文表示されるのは作成直後だけです。
7. readRFCInMobile の **Settings → Environments → quiz-authoring** を開き、次の2つを **Secret** として保存します。

| Name | Value に入れるもの |
| --- | --- |
| `CF_ACCESS_CLIENT_ID` | 6の Client ID をそのまま。通常は末尾が `.access` |
| `CF_ACCESS_CLIENT_SECRET` | 6の Client Secret をそのまま |

8. 同じ `quiz-authoring` に **Variable** `QUIZ_API_URL` を作り、0-3の問題アプリの URL を保存します。例は `https://spec-understanding-quiz.maronn.workers.dev`。`/quiz` や `/api` は付けません。

**完了の確認：** `quiz-authoring` に上記2つの Secrets と1つの Variable が表示されること。Cloudflare の Service Tokens 一覧にも `readrfc-quiz-authoring` が表示されること。

## 4. その鍵で作問できるように Cloudflare 側のルールを作る

### 4-1. 作問・公開の操作を保護するアプリケーションを作る

1. Cloudflare の **Zero Trust → Access controls → Applications** を開きます。
2. **Create new application**（旧画面では Add an application）を押します。
3. **Self-hosted and private**（旧画面では Self-hosted）を選びます。
4. 名前を `readrfc-quiz-management` にします。
5. **Add public hostname** を押し、問題アプリのホスト名と、次の表のパスを登録します。同じアプリケーションに複数の公開ホスト名・パスを追加します。

ホスト名の例は `spec-understanding-quiz.maronn.workers.dev` です。`https://` は入力しません。Path 欄では先頭の `/` が画面に表示済みなら、それを重ねて入力しません。

| パス | 保護する操作 |
| --- | --- |
| `/api/authoring/requests*` | 問題の生成依頼と結果の取得 |
| `/api/question-sets/import` | 確認済みの問題を公開する操作 |
| `/quiz/ai-grading` | AI 採点を依頼するためのログイン |
| `/api/attempts/*/grading-requests` | API からの AI 採点依頼 |
| `/quiz/attempts/*/grading-requests` | 画面からの AI 採点依頼 |

パスを全部空欄にするとサイト全体が保護対象になります。ここでは上のパスを入れ、問題一覧 `/quiz`、通常の回答、AI から結果を受け取る `/api/ai/results` は公開経路のままにします。結果受付はアプリ自身が依頼ごとの鍵で認証します。

以前の Access アプリが `/quiz/*`・`/api/*`・サイト全体を保護している場合は、そのアプリの対象パスも上記に絞ります。Worker の **Protect this Worker / All traffic** を有効にすると全体が対象になるため、この手順では **ホスト名・パスを指定したアプリケーション**を使用します。

### 4-2. GitHub 用とブラウザ用の許可を設定する

1. アプリケーションの **Policies → Add a policy** を押します。
2. 名前を `allow-quiz-actions` にします。
3. Action を **Service Auth** にします。
4. Include の Selector を **Service Token** にし、3で作った `readrfc-quiz-authoring` を選び、保存します。
5. もう1つポリシーを追加し、名前を `allow-quiz-owner` にします。
6. Action を **Allow**、Include の Selector を **Emails** にし、自分のログイン用メールアドレスを登録します。
7. ログイン方法では、既存のログイン方法を選ぶか、メールでコードを受け取る **One-time PIN** を選びます。
8. アプリケーションを **Create / Save** します。

GitHub の自動処理には Service Auth のルール、ブラウザでの AI 採点には Allow のルールが使われます。

### 4-3. アプリケーションの識別番号とチームの URL を控える

1. Applications 一覧から `readrfc-quiz-management` を開きます。
2. **Overview** または **Settings** にある **Application Audience (AUD) Tag** をコピーします。これが後で保存する `ACCESS_AUD` です。Application ID ではありません。
3. チームの URL を確認します。分からなければ、ブラウザのプライベートウィンドウで `https://spec-understanding-quiz.maronn.workers.dev/api/authoring/requests` を開きます。
4. Cloudflare のログイン画面へ移動したときの URL の、`https://自分のチーム名.cloudflareaccess.com` までを控えます。後ろのパスや `?` 以降は含めません。これが `ACCESS_ISSUER` です。

**完了の確認：** 作問の URL ではログイン画面が出る一方、プライベートウィンドウで問題アプリの `/quiz` を開くとログインなしで一覧が表示されること。AUD とチームの URL を控えられていること。

## 5. PR に問題のリンクを投稿する GitHub App を作る

このアプリは、公開した問題へのリンクと「仕様理解クイズ」というチェック結果を maronn-openid-connect の PR に表示します。Checks は GitHub の PR 画面にあるチェック結果欄の名前です。

### 5-1. アプリを登録する

1. [GitHub の GitHub Apps 設定](https://github.com/settings/apps)を開き、**New GitHub App** を押します。
2. 次を入力します。

| 項目 | 入力する値 |
| --- | --- |
| GitHub App name | `maronn-pr-quiz-maronnjapan` など、他の人と重複しない名前 |
| Homepage URL | `https://github.com/maronnjapan/readRFCInMobile` |
| Callback URL | 空欄。ユーザーのログインに使うアプリではありません |
| Webhook の Active | チェックを外す。Webhook の URL は不要 |
| Repository permissions → Checks | Read and write |
| Repository permissions → Pull requests | Read and write |
| Metadata | 自動で付く Read-only のまま |
| Where can this GitHub App be installed? | Only on this account |

3. **Create GitHub App** を押します。
4. 作成後の **General** 画面で、数字の **App ID** を控えます。`Iv...` などで始まる Client ID ではありません。

### 5-2. 秘密鍵を作り、アプリが読める形式へ変換する

1. 同じ General 画面の下にある **Private keys → Generate a private key** を押します。
2. ダウンロードされた `.pem` ファイルを Downloads フォルダーに置き、ファイル名を `quiz-app.pem` にします。
3. ターミナルを開きます。macOS / Linux は標準のターミナル、Windows は Git Bash を使います。
4. 次を実行します。この処理はパソコン内で鍵の形式を変換します。

```sh
cd "$HOME/Downloads"
openssl pkcs8 -topk8 -nocrypt -in quiz-app.pem -out quiz-app.pkcs8.pem
head -n 1 quiz-app.pkcs8.pem
```

5. 最後のコマンドで `-----BEGIN PRIVATE KEY-----` と表示されれば変換できています。
6. `quiz-app.pkcs8.pem` をテキストエディターで開きます。**BEGIN と END の行を含む全文**を、次の節で Secret として保存します。鍵を変換する Web サービスや公開リポジトリへ貼り付ける必要はありません。

### 5-3. maronn-openid-connect へインストールする

1. GitHub App の設定画面で **Install App** を開きます。
2. 自分のアカウントの **Install** を押します。
3. **Only select repositories** を選び、`maronn-openid-connect` を選択します。
4. **Install** を押します。
5. インストール後の URL、またはアカウントの **Settings → Applications → Installed GitHub Apps → Configure** の URL を確認します。
6. `https://github.com/settings/installations/12345678` の最後の数字を控えます。これが **Installation ID** です。App ID とは別の値です。
7. readRFCInMobile の **Settings → Environments → quiz-production** に、次の3つを **Secrets** として保存します。

| Name | Value に入れるもの |
| --- | --- |
| `QUIZ_GITHUB_APP_ID` | 5-1で控えた数字の App ID |
| `QUIZ_GITHUB_INSTALLATION_ID` | 5-3で控えた数字の Installation ID |
| `QUIZ_GITHUB_APP_PRIVATE_KEY` | 変換した `quiz-app.pkcs8.pem` の全文 |

**完了の確認：** Installed GitHub Apps に作ったアプリが表示され、対象リポジトリが maronn-openid-connect であること。readRFCInMobile の `quiz-production` に3つの Secrets が表示されること。

## 6. readRFCInMobile に接続情報を登録する

readRFCInMobile の **Settings → Environments → quiz-production** を開きます。次を **Variables** に登録します。

| Name | Value | 値の入手元 |
| --- | --- | --- |
| `QUIZ_APP_ORIGIN` | `https://spec-understanding-quiz.maronn.workers.dev` | 0-3の問題アプリの URL |
| `ACCESS_ISSUER` | `https://自分のチーム名.cloudflareaccess.com` | 4-3で控えたチームの URL |
| `ACCESS_AUD` | 控えた AUD の文字列 | 4-3の Application Audience (AUD) Tag |
| `AUTHOR_SUBJECTS` | `service:` に3の Client IDを続けた値 | 例：Client ID が `abc123.access` なら `service:abc123.access`。トークンの名前ではありません |
| `AUTHOR_EMAILS` | 自分のログイン用メールアドレス | 4-2の Allow で許可したメールアドレス |
| `AI_EXECUTOR_TRANSPORT` | `https` | この値をそのまま |
| `AI_EXECUTOR_AUTH` | `api-key` | この値をそのまま |
| `AI_EXECUTOR_URL` | AI 採点・任意の AI 作問を使う場合に、そのサーバーの受付 URL | 0-2で入手した値 |
| `AUTHORING_PROFILE` | `quiz-generate-v1`、またはサーバー側で指定された作問設定名 | 0-2で確認した値 |
| `GRADING_PROFILE` | `quiz-written-v1`、またはサーバー側で指定された採点設定名 | 0-2で確認した値 |

AI 採点・任意の AI 作問を使う場合は、同じ画面の **Secrets** に `AI_EXECUTOR_API_KEY` を追加し、0-2で入手した問題アプリ用の接続の鍵を保存します。Claude 自体の API キーをこの欄へ入れても、この構成の AI 実行サーバーの代わりにはなりません。

`AI_CALLBACK_SECRET` は問題アプリが初回公開時に自動作成します。通常は手作業で作成・変更しません。

**完了の確認：** 利用する機能の項目が揃っていること。AI の項目は AI 採点・任意の AI 作問、GitHub App の項目は PR への URL 返却、quiz-authoring の項目は固定版の手動公開・任意の AI 作問に使います。資料保存だけならこの接続設定は不要です。Secret の値が表示されないのは正常です。

| readRFCInMobile の保存場所 | 種類 | 名前 |
| --- | --- | --- |
| `quiz-authoring` | Variables | `QUIZ_API_URL` |
| `quiz-authoring` | Secrets | `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET` |
| `quiz-production` | Variables | 6の表の項目。公開先に応じて `CLOUDFLARE_ACCOUNT_ID` |
| `quiz-production` | Secrets | `CLOUDFLARE_API_TOKEN`、`AI_EXECUTOR_API_KEY`、`QUIZ_GITHUB_APP_ID`、`QUIZ_GITHUB_INSTALLATION_ID`、`QUIZ_GITHUB_APP_PRIVATE_KEY` |

既存のリポジトリ Secret を使っている項目は、その値を Environment へ複製する必要はありません。

## 7. 登録した設定を問題アプリへ反映する

1. [Deploy quiz to Cloudflare Workers](https://github.com/maronnjapan/readRFCInMobile/actions/workflows/deploy-workers.yml)を開きます。
2. **Run workflow** を押し、Branch は **main** を選び、実行します。
3. 新しい実行を開きます。承認待ちなら **Review deployments** で既存のルールに従って承認します。
4. **check** と **deploy** が両方緑色になるまで待ちます。
5. Summary に表示された URL の `/quiz` を開き、一覧が表示されることを確認します。

設定を GitHub に保存しただけでは、稼働中の問題アプリへ反映されません。この公開処理を実行する必要があります。問題の本文・回答を保存するためのデータベースと処理待ちのキューは、この処理が作成・更新します。管理画面で同名のものを追加作成する必要はありません。

### 固定版の手動公開・任意の AI 作問の認証を確認する

ターミナルを開き、`bash` を実行してから次を実行できます。Client ID と Client Secret は3で作った値を入力します。Client Secret の入力内容は画面に表示されません。

```sh
read -r -p 'Client ID: ' CF_ACCESS_CLIENT_ID
read -r -s -p 'Client Secret: ' CF_ACCESS_CLIENT_SECRET
printf '\n'
curl -sS -w '\nHTTP %{http_code}\n' \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  'https://spec-understanding-quiz.maronn.workers.dev/api/authoring/requests/00000000-0000-4000-8000-000000000001'
unset CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET
```

`HTTP 404` と `{"message":"作問ジョブが見つかりません。"}` が返れば、存在しない作問結果を探すところまで認証・権限の確認を通過しています。これは成功です。問題は生成されず、AI も呼びません。別の404や HTML 画面は成功扱いにしません。

`401`・`403`・ログイン画面なら3〜4と `AUTHOR_SUBJECTS`、`503`なら6〜7を確認します。

**完了の確認：** 問題一覧が開け、上の認証確認で指定した404の JSON が返ること。
