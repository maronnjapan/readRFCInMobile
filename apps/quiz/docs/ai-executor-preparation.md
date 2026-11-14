# AI 実行サーバーの準備状況を確認する

初期設定の途中で出てくる「共通 AI API」「AI 実行サーバー」は、問題アプリの依頼を受けて Claude を呼び、結果を返すための別サービスです。

利用するのはログイン後の AI 採点と、独立した手動 Workflow から任意に実行する AI 作問です。PR 情報の受け取り・作問資料の保存・作成済み問題 JSON の公開と通常の回答には不要です。[PR 連携](pr-integration.md)と[問題ファイルだけで公開する手順](question-files.md)を参照してください。

**このサービスの実装は、readRFCInMobile と maronn-openid-connect のどちらにも含まれていません。** 以前の手順にあった `AI_EXECUTOR_URL` は、この別サービスの受付 URL を登録する欄です。Cloudflare や GitHub で設定項目を追加するだけでは、そのサービスは作成されません。

## 1. すでにサーバーがあるか確認する

そのサービスを管理している人、または自分の既存プロジェクトで、次の情報を確認します。

1. 作問依頼を受ける HTTPS の URL があるか。
2. 問題アプリ用に接続の鍵を発行できるか。
3. [このリポジトリの接続仕様](ai-executor-contract.md)の JSON を受け取れるか。
4. AI 採点の `answers.grade`、任意の AI 作問を使う場合は `questions.generate` を受け付け、処理後に問題アプリへ結果を返せるか。
5. 利用する機能に応じた `quiz-written-v1`、`quiz-generate-v1`、またはそれに代わる実行設定名があるか。

Claude の API キーや Claude Code のルーチンがすでにあっても、3〜5を満たすサーバーがなければ現在の自動作問経路では利用できません。Anthropic の通常の API URL をそのまま `AI_EXECUTOR_URL` に入れる構成でもありません。

すべて揃っていれば、[初期設定手順0-2](pr-integration.md#0-2-必要なアカウント実装を確認する)で使う URL・接続用の鍵・実行設定名を入手して、その手順を続けます。

## 2. サーバーがない場合に、新しく作る必要があるもの

AI 採点・任意の AI 作問を使うには、以下を行うサービスの開発と公開が必要です。これは鍵を発行する画面の操作とは別の開発作業です。

| 作る機能 | 必要な動作 |
| --- | --- |
| 依頼の受付 | HTTPS の受付口を設け、問題アプリ専用の接続の鍵を検証する |
| 依頼の保存 | `requestId` ごとに依頼を保存する。同じ依頼が届いても AI の実行を追加しない |
| AI の実行 | 保存した依頼の `input.system` と `input.messages` を Claude に渡す。Claude 自体の API キーはこのサービス側に保存する |
| 実行設定 | 作問用・採点用の設定名を、利用するモデルと入力・出力・利用量の上限に対応付ける |
| 結果の配送 | `callback.url` に生成結果を POST し、依頼時に渡された `callback.token` を送信時の認証に使う |
| 失敗・再送への対応 | 実行と結果配送を受付通信の終了後も継続し、通信失敗で結果を失わないようにする |

入力・出力の正確な JSON、受付後の実行、認証、再送、結果配送の仕様は [AI 実行 API との契約](ai-executor-contract.md)にあります。このサービスは任意の AI 作問・AI 採点に必要で、資料を保存する Workflow はこのサービスを呼びません。

一方、PR の問題を作って公開すること自体は、次の手順で進められます。

## 3. AI サーバーを作らず、ChatGPT / Codex で作問して公開する

この方法では、作問する AI はいま利用している ChatGPT / Codex です。作った問題ファイルを GitHub に置くと、既存の公開処理で問題一覧へ追加できます。Cloudflare Access の作問設定や起動用トークンは、この方法のためには作成しません。

必要なのは、readRFCInMobile の公開処理が成功していることと、GitHub へ問題ファイルを保存できることです。

### 3-1. 問題ファイルの候補を作る

1. readRFCInMobile と maronn-openid-connect を参照・編集できる ChatGPT / Codex を開きます。
2. 次の依頼文を送ります。例では PR #194 の2問を作ります。別の PR を題材にする場合は URL と仕様の指定を変えます。

```text
maronnjapan/maronn-openid-connect の PR #194 を題材に、理解度確認の問題を作成してください。
対象 PR: https://github.com/maronnjapan/maronn-openid-connect/pull/194
参照仕様: readRFCInMobile に保存済みの RFC 6749 の client_credentials に関係する箇所
対象コード: packages/core/src/client-credentials-grant.ts と対応するテスト
問題数: 2問。knowledge と debugging の選択式を1問ずつ。

readRFCInMobile の skills/quiz-authoring/SKILL.md と
apps/quiz/worker/contracts.js を読んで、正式な問題形式にしてください。
外部の作問 API を呼ぶ代わりに、自身で固定版の仕様・PR・コードを読んで作問してください。
出典は GitHub で取得できる固定コミット、正確なファイルと行範囲にし、PR の差分の出典を含めてください。
問題・正解・解説を確認し、CLI の check で検証してください。
status は draft で、apps/quiz/questions/pr/ 内の専用ブランチへ保存してください。
確認用の PR を作り、問題ファイルのパスと PR のリンクを教えてください。
```

3. 返ってきた PR と問題ファイルを開きます。
4. 問題文・選択肢・正解・解説・出典を確認します。誤りがあれば修正を依頼します。

### 3-2. 確認した候補を公開状態にする

1. readRFCInMobile の作問用 PR の **Files changed** で問題ファイルを開きます。
2. ファイルの専用ブランチを開いて編集し、`"status": "draft"` を `"status": "published"` に変更します。自分で編集する代わりに、確認が終わったことを伝えて AI に変更を依頼しても構いません。
3. 変更を同じ PR のブランチへ保存します。
4. PR の検証処理が成功していることを確認し、**main へマージ**します。

この方法では main の公開済み問題を利用するため、`operation=publish` の手動実行、コミット番号の入力、作問用の認証設定は不要です。

### 3-3. 公開された問題を解く

1. [Deploy quiz to Cloudflare Workers](https://github.com/maronnjapan/readRFCInMobile/actions/workflows/deploy-workers.yml)を開きます。
2. 問題ファイルのマージで始まった実行の **check** と **deploy** が成功するまで待ちます。
3. Summary の公開 URL に `/quiz` を付けて開きます。
4. 今回作った問題のタイトルを選び、問題を解きます。
5. その問題ページの URL をコピーします。

### 3-4. maronn-openid-connect の PR から開けるようにする

GitHub App を設定している場合は、公開された PR 問題を Cron が登録し、Queue が元の PR にリンクを返します。App を使わない場合は、以下の手順で回答 URL を共有できます。

1. [対象 PR #194](https://github.com/maronnjapan/maronn-openid-connect/pull/194)の Conversation を開きます。
2. コメント欄に、たとえば `この PR の理解度確認問題: （3-3でコピーしたURL）` と入力して投稿します。
3. そのリンクをプライベートウィンドウで開き、回答できることを確認します。

これで、AI 実行サーバーの実装を待たずに、PR を題材にした問題を公開して解けます。この方法では PR コメントを手で投稿します。自動のチェック表示や件数更新は、[初期設定手順](pr-integration.md)で GitHub App と作問・公開の経路を準備したときに利用できます。
