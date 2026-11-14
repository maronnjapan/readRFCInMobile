# PR の問題を作って公開する：初期設定からの作業手順

この手順書は、**readRFCInMobile で問題を作り、maronn-openid-connect の PR に問題へのリンクを付ける**ためのものです。上から順に進めてください。設定済みの項目は作り直さず、各節の「完了の確認」ができれば次へ進みます。

初期設定後は、maronn-openid-connect の GitHub 画面で PR 番号を入力して作問を依頼し、readRFCInMobile で内容を確認して公開します。

## 0. 最初に確認すること

### 0-1. 作業する場所を確認する

| 作業する場所 | 作るもの | 完了する節 |
| --- | --- | --- |
| readRFCInMobile の GitHub 設定 | 本番用と作問用の設定の保存場所 | 1 |
| Cloudflare | 作問用の鍵、作問を許可するルール | 3〜4 |
| GitHub の個人設定 | PR に投稿するアプリ | 5 |
| readRFCInMobile の GitHub 設定 | 上で取得した値の登録 | 6 |
| readRFCInMobile の Actions | 設定の反映、最初の作問・公開 | 7〜10 |
| maronn-openid-connect の GitHub 設定 | readRFCInMobile の作問を起動する鍵の登録 | 11 |

GitHub の **Environment** は、設定をまとめて保存する場所です。この手順では `quiz-production` と `quiz-authoring` という名前で作ります。同じ名前でも、リポジトリが違えば別の保存場所です。

保存する値には2種類あります。**Variable** は URL や名前などの設定値、**Secret** はパスワードに相当する値です。各手順でどちらに保存するか指定します。

### 0-2. 必要なアカウント・実装を確認する

- GitHub で両リポジトリの Settings を編集できること。
- 問題アプリを置く Cloudflare アカウントを管理できること。このアプリは Workers Paid を前提にしています。
- 問題アプリのコードが readRFCInMobile の main に入っていること。[作問処理のファイル](https://github.com/maronnjapan/readRFCInMobile/blob/main/.github/workflows/quiz-authoring.yml)が開ければ確認できます。
- **自動作問には、別の「AI 実行サーバー」が必要です。** このサーバーの実装は、今回の2リポジトリには含まれていません。

「AI 実行サーバー」は、問題アプリから依頼を受けて Claude を呼び、結果を問題アプリに返すサーバーです。Claude の API キー、ChatGPT の契約、Claude Code のルーチンの URL だけでは代わりになりません。

すでにそのサーバーがある場合は、管理者から次の3点を入手します。

| 入手するもの | あとで登録する名前 | 値の例・確認すること |
| --- | --- | --- |
| 作問依頼を受ける HTTPS URL | `AI_EXECUTOR_URL` | `/v1/requests` などを含む**完全な受付 URL** |
| 問題アプリ用に発行した接続用の鍵 | `AI_EXECUTOR_API_KEY` | サーバーが `Authorization: Bearer` で受け付ける鍵。Claude 自体の API キーとは別 |
| 実行設定の名前 | `AUTHORING_PROFILE`、`GRADING_PROFILE` | 既定は `quiz-generate-v1`、`quiz-written-v1`。サーバー側に同じ名前の設定が必要 |

**AI 実行サーバーがまだない場合、自動作問の動作確認はここでは完了できません。** [AI 実行サーバーの準備状況を確認する](ai-executor-preparation.md)に、必要な実装と、AI サーバーを用意せずに問題を公開する手順を記載しています。以降の画面設定をするだけで AI サーバーが作られるわけではありません。

### 0-3. 問題アプリの URL を控える

1. [readRFCInMobile の公開処理](https://github.com/maronnjapan/readRFCInMobile/actions/workflows/deploy-workers.yml)を開きます。
2. 一番新しい成功した実行を開きます。
3. **Summary → Quiz deployment → URL** をコピーします。末尾の `/quiz` は付けません。
4. その URL に `/quiz` を付けてブラウザで開き、既存の問題一覧が表示されることを確認します。

この作業環境で確認した公開先は `https://spec-understanding-quiz.maronn.workers.dev` です。以降はこの値を例にします。別の URL で公開している場合は置き換えてください。

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
| `quiz-authoring` | GitHub 上で作問・問題の公開を依頼するときに使う |

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

## 3. Cloudflare で「GitHub からの作問を許可する鍵」を作る

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
| `CODE_REPOSITORIES` | `maronnjapan/readRFCInMobile,maronnjapan/maronn-openid-connect` | この値をそのまま。既存の許可先がある場合は残して追加 |
| `AI_EXECUTOR_TRANSPORT` | `https` | この値をそのまま |
| `AI_EXECUTOR_AUTH` | `api-key` | この値をそのまま |
| `AI_EXECUTOR_URL` | AI 実行サーバーの完全な受付 URL | 0-2で入手した値 |
| `AUTHORING_PROFILE` | `quiz-generate-v1`、またはサーバー側で指定された作問設定名 | 0-2で確認した値 |
| `GRADING_PROFILE` | `quiz-written-v1`、またはサーバー側で指定された採点設定名 | 0-2で確認した値 |

同じ画面の **Secrets** に `AI_EXECUTOR_API_KEY` を追加し、0-2で入手した問題アプリ用の接続の鍵を保存します。Claude 自体の API キーをこの欄へ入れても、この構成の AI 実行サーバーの代わりにはなりません。

`AI_CALLBACK_SECRET` は問題アプリが初回公開時に自動作成します。通常は手作業で作成・変更しません。

**完了の確認：** 次の表に必要な項目が揃っていること。Secret の値が表示されないのは正常です。

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

### 作問の認証を、AI を使わずに確認する

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

## 8. readRFCInMobile から最初の問題を2問だけ作る

まず受け側だけで作問できることを確認します。maronn-openid-connect 側の起動設定は、その後で行います。

1. [Author or publish a quiz (manual)](https://github.com/maronnjapan/readRFCInMobile/actions/workflows/quiz-authoring.yml)を開きます。
2. **Run workflow** を押し、Branch は **main** を選びます。
3. 最初は次の値を入力します。PR #194 の2ファイルだけを対象に、知識・誤り発見の問題を作る例です。

| 入力欄 | 入れる値 |
| --- | --- |
| `operation` | `generate` |
| `spec_id` | `rfc-6749` |
| `code_source` | `maronn-openid-connect` |
| `pr_number` | `194` |
| `question_count` | `2` |
| `question_categories` | `knowledge,debugging` |
| `focus_paths` | `packages/core/src/client-credentials-grant.ts,packages/core/src/client-credentials-grant.test.ts` |
| `part` | `1` |
| `commit` | 空欄 |
| `path` | 空欄 |

4. **Run workflow** で実行し、新しい実行を開きます。
5. 処理が終わったら **Summary → 作問候補のレビュー → 候補を見る** を開きます。
6. 問題・正解・解説を保存した JSON ファイルが開きます。この時点では `"status": "draft"` で、一般の回答者へは公開されていません。

**完了の確認：** 作問処理が成功し、候補ファイルに問題が2問あること。起動だけ成功して結果がない場合は未完了です。

## 9. 問題を確認して、公開する版を保存する

1. 8の Summary に書かれた問題ファイルのパスを控えます。
2. 候補を見るリンクで開いた URL の `blob/` の直後にある40文字が、その候補を保存したコミット番号です。`quiz/generated-...` という専用ブランチも作成されています。
3. 作問した Actions の実行画面で **author** を開き、`git switch -c` で始まる保存ステップのログを開きます。`Switched to a new branch 'quiz/generated-...'` に表示されたブランチ名をコピーします。**Code** タブへ戻り、左上のブランチ選択にその名前を貼り付けて選びます。選んだブランチの最新コミット番号が2の番号と一致することを確認します。
4. 控えたパスのファイルを開きます。問題文、選択肢、`solutions` 内の正解と解説、出典を確認します。間違いがあれば鉛筆の編集ボタンで修正します。
5. 公開してよければ、ファイル内の `"status": "draft"` を `"status": "published"` に変えます。
6. **Commit changes** を押し、**Commit directly to the 選択した専用ブランチ** を選んで保存します。main へのマージは、この公開方法では必要ありません。
7. コミット名のリンクを開き、**40文字の完全なコミット番号**をコピーします。これは5〜6で状態を変更した**後の**番号です。変更前の番号や7文字の短い番号は使いません。

パソコンで形式の検査も行う場合は、次のコマンドでそのブランチを取得します。`作問用ブランチ名` は3でコピーした名前、`問題ファイルのパス` は8の Summary のパスに置き換えます。すでに取得済みの場合は既存のリポジトリで対象ブランチへ切り替えます。

```sh
git clone --branch '作問用ブランチ名' https://github.com/maronnjapan/readRFCInMobile.git
cd readRFCInMobile
npm ci
node apps/quiz/tools/authoring/quiz.mjs check --path '問題ファイルのパス'
```

**完了の確認：** 専用ブランチの問題が `published` になっており、その更新を保存した40文字のコミット番号と問題ファイルのパスを控えていること。

## 10. 問題を公開して、回答と PR のリンクを確認する

1. [Author or publish a quiz (manual)](https://github.com/maronnjapan/readRFCInMobile/actions/workflows/quiz-authoring.yml)で **Run workflow** を押します。
2. Branch を **main**、`operation` を **publish** にします。
3. `commit` に9-7の40文字のコミット番号、`path` に問題ファイルのパスを入れます。この操作では他の作問入力欄は使用しません。
4. 実行が成功したら、Summary の **問題に回答する** を開きます。
5. プライベートウィンドウでも同じ URL を開き、ログインせず回答できることを確認します。
6. [maronn-openid-connect の対象 PR](https://github.com/maronnjapan/maronn-openid-connect/pull/194)を開きます。
7. **Conversation** に問題へのリンクが付き、**Checks** に **仕様理解クイズ** が出ることを確認します。表示されるのは回答件数・採点済み件数で、個人の回答本文は投稿されません。

Summary の `PR 連携: queued` は投稿の処理待ちを意味します。少し待って7を確認します。`not_configured` なら、問題は公開できていますが5の GitHub App の設定が必要です。

**完了の確認：** 公開 URL で問題を解け、対象 PR からその URL を開けること。

## 11. maronn-openid-connect 側の起動設定をする

ここまでで readRFCInMobile から作問・公開できます。次に、maronn-openid-connect の画面から同じ作問を起動できるようにします。

1. [maronn-openid-connect の手順書](https://github.com/maronnjapan/maronn-openid-connect/blob/main/docs/pr-quizzes.md)を開きます。まだ main にない場合は、[追加 PR #195](https://github.com/maronnjapan/maronn-openid-connect/pull/195)の変更を先に反映します。
2. そちらの手順1〜3で、readRFCInMobile の処理を起動できる GitHub の鍵を作り、maronn-openid-connect に保存します。
3. 同手順4で PR #194 の2問を依頼します。
4. readRFCInMobile 側に新しい作問実行が現れたことを確認します。

**完了の確認：** maronn-openid-connect の実行だけでなく、readRFCInMobile 側で候補の作成まで成功すること。

## 12. 次からの使い方

1. maronn-openid-connect の **Actions → Request a PR quiz** を開き、作問したい PR 番号を入れます。
2. 最初は小さい対象パス・2問で作問し、慣れてから対象や問題数を広げます。
3. readRFCInMobile 側で候補を確認し、9〜10の手順で公開します。
4. 仕様と照合しない、PR の変更内容だけの問題なら `spec_id` を空欄にします。

対象の変更が多い場合、パス順に8ファイルずつ分かれます。`part=1` の次は `part=2` として作問します。全体のうち何番目かは作問資料と候補の説明に残ります。PR が更新された場合は新しく作問します。古い回答は元の問題の版に残ります。

## 困ったときに確認する場所

| 起きたこと | 確認・修正する場所 |
| --- | --- |
| Actions に処理名が見当たらない | そのリポジトリの main に `.github/workflows/` のファイルがあるか。PR のブランチにだけある場合は main への反映が必要 |
| 処理が承認待ち | 実行画面の Review deployments。Environment の既存の承認ルールを確認 |
| `QUIZ_API_URL` が必要と言われる | readRFCInMobile の **quiz-authoring → Variables** に問題アプリの URL を保存 |
| `401`・`403`・Cloudflare のログイン画面 | 3〜4の Service Token、Service Auth ポリシー、6の `AUTHOR_SUBJECTS`、4-3の AUD とチーム URL を確認 |
| 作問が長く待機し、AI 実行 API のエラーになる | 0-2の AI サーバーの有無、6の受付 URL・接続用の鍵・実行設定名と、サーバー側の実行・結果配送を確認 |
| 公開できない | 保存したファイルが `published` か、変更後の40文字のコミット番号か、`path` が完全一致するか確認 |
| 問題は解けるが PR にリンクがない | 5の App ID・Installation ID・秘密鍵・インストール先・権限、6の `CODE_REPOSITORIES`、7の設定反映を確認 |
| 設定を変えたのに変わらない | quiz-production の値は7の公開処理を再実行して反映。起動用トークンは登録先リポジトリ・Environment も確認 |

実装の契約は [AI 実行サーバーとの接続仕様](ai-executor-contract.md)、公開処理の詳細は [デプロイの説明](deployment.md)、問題形式は [作問用スキル](../../../skills/quiz-authoring/SKILL.md)にあります。

画面名の確認には Cloudflare 公式の [Service Tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)、[Workers と Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)、[保護対象パス](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)を参照しています。
