# maronn-openid-connect の PR から作問する

`maronnjapan/maronn-openid-connect` の **Request a PR quiz** を手動実行すると、このリポジトリの **Author or publish a quiz (manual)** が起動する。作問結果は本リポジトリの専用ブランチへ `draft` で保存する。レビュー後に固定版を公開すると、対象 PR のコメントと neutral Check に回答ページへのリンクが載る。

PR の作成・更新だけでは作問を開始しない。ソース側の Workflow が許可する操作は `generate` で、公開は本リポジトリで別に実行する。

## 接続設定

両方の実装を main に反映してから設定する。先に readRFCInMobile を反映すると、受け側の追加引数と PR 専用形式を利用できる。

| 設定先 | 必要な設定 |
| --- | --- |
| readRFCInMobile の `quiz-authoring` Environment | Variable `QUIZ_API_URL` と Secrets `CF_ACCESS_CLIENT_ID`・`CF_ACCESS_CLIENT_SECRET`。作問用 Access Service Token を登録する |
| readRFCInMobile の `quiz-production` Environment / Worker | `AUTHOR_SUBJECTS` に作問用 Service Token の `service:<common_name>`、Access の issuer/audience、共通 AI API の接続設定。詳細は [運用手順](quiz-service.md#cloudflare-workers-paid-の初期設定) |
| 同上の `CODE_REPOSITORIES` Variable | `maronnjapan/readRFCInMobile,maronnjapan/maronn-openid-connect`。既存の値がある場合は maronn-openid-connect を追加する。デプロイは既存の Worker 変数を維持するため、この更新を明示する |
| 同上の Secrets | `QUIZ_GITHUB_APP_ID`・`QUIZ_GITHUB_INSTALLATION_ID`・`QUIZ_GITHUB_APP_PRIVATE_KEY`。GitHub App を maronn-openid-connect にインストールし、Checks: write・Pull requests: write を付ける。秘密鍵は PKCS#8 PEM |
| maronn-openid-connect の `quiz-authoring` Environment | Secret `QUIZ_DISPATCH_TOKEN`。readRFCInMobile だけを対象に Actions: write を持つ fine-grained PAT、または同等のインストールトークンを設定する |

Worker の公開には既存の `CLOUDFLARE_API_TOKEN` などの[デプロイ設定](deployment.md)を使う。AI の接続とモデルの実行設定は共通 AI API 側でも有効にする。値は Git や作問資料へ保存しない。

GitHub App は公開後の PR コメント・Check 更新用、`QUIZ_DISPATCH_TOKEN` は受け側 Workflow の起動用である。`QUIZ_DISPATCH_TOKEN` を作問 API へ送ることはない。作問 API の認証は Access Service Token が担当する。

## PR を選び、資料を確認する

maronn-openid-connect の Actions → **Request a PR quiz** で main を選ぶ。

- `pr_number`: 対象 PR 番号。
- `spec_id`: 仕様と照合する場合だけ指定する。空欄は PR の変更内容・設計理由・テストを題材にする。
- `focus_paths`: 対象ファイルやディレクトリをカンマ区切りで指定。ディレクトリには末尾 `/` を付ける。
- `part`: 絞り込み後の変更ファイルをパス順で8件ずつ分けた番号。既定は1。
- 問題数とカテゴリ: 既定は7問・全7カテゴリ。カテゴリ数以下の問題数は指定できない。

例: PR #194 の client_credentials を RFC 6749 と照合するなら、`spec_id=rfc-6749`、`focus_paths=packages/core/src/client-credentials-grant.ts,packages/core/src/client-credentials-grant.test.ts` を指定する。実装・テストが増えた場合は対象パスや分割番号を選び直す。

登録済みの仕様は RFC 6749・7523・7591・9101・9126・9449 と `oidc-core-1_0`。OIDC Core は OpenID Foundation の [承認済み Errata 1 タグ](https://github.com/openid/connect/tree/OpenID_Connect_errata_set_1_-_final)の XML ソースを、その版を明記して収録している。原文の著作権表示・ライセンスを維持し、出典の行番号は XML を指す。

AI を使う前に取得範囲を確認する場合は、本リポジトリで次を実行する。新しい仕様ファイルを参照するには、そのファイルを含むコミットを使用する。

```sh
npm ci
node apps/quiz/tools/authoring/quiz.mjs prepare --source maronn-openid-connect --pr 194 --paths packages/core/src/ --part 1
node apps/quiz/tools/authoring/quiz.mjs prepare --spec rfc-6749 --source maronn-openid-connect --pr 194 --paths packages/core/src/ --part 1
```

`prepare` は `.authoring-work/contexts/` に資料を保存し、AI を呼ばない。GitHub の取得トークンは任意の `GITHUB_TOKEN`。`generate` は同じ引数で実際に作問し、出題 Worker と Access の設定も必要になる。

## レビューして公開する

1. readRFCInMobile 側の実行結果の Summary から生成候補を開く。保存先は `apps/quiz/questions/pr/<owner>/<repo>/<PR番号>/<資料ID>.json`。版・仕様・対象パス・分割番号の異なる資料は別ファイルになる。
2. PR 本文の主張を、保存した仕様・差分・変更前後コード・テストと照合する。対象範囲、選択肢、正解、採点基準を確認する。
3. `node apps/quiz/tools/authoring/quiz.mjs check --path <候補のパス>` で検証する。
4. `status` を `published` に変え、専用ブランチへコミット・push する。**このコミットの40文字 SHA** を控える。
5. readRFCInMobile の **Author or publish a quiz (manual)** を main 上で再実行し、`operation=publish`、`commit=<そのSHA>`、`path=<問題ファイルのパス>` を指定する。他の入力は公開操作では使用しない。
6. Summary の回答 URL と PR 連携結果を確認する。`queued` は Queue へ同期を依頼済み、`not_configured` は GitHub App の設定が必要な状態。PR ではリンクと neutral Check を確認する。

問題は readRFCInMobile の固定版に保存し、maronn-openid-connect へ問題 JSON を置く必要はない。PR の head が変わったら新しく作問し、レビューして公開する。既存回答は元の版に残る。

## 資料の範囲

- PR の base/head を SHA に固定し、選択した8件までの差分と前後コード、対応する既存テストを最大2件取得する。削除ファイルは base の本文を読む。
- PR 本文と PR コメント・レビューコメントの最終ページ（各20件まで）を取得時刻付きの抜粋として問題 JSON に保存する。この保存資料の出典リンクは問題ファイルの固定コミットを開く。
- 長い PR 本文・コメント・差分・コードは明記した文字数内で抜粋する。仕様本文は検索語に関連する100行単位の抜粋を先頭の説明とともに最大6か所取得する。仕様全体・PR 全体を確認済みとは扱わない。
- `spec_id` が空なら `spec:null`。仕様適合の断定を避け、PR による動作と変更理由を問う。公開には対象 PR の head に結び付く差分の出典が必須。
- 取得した PR のコードを実行しない。取得対象は `code-sources.yaml` の許可パスで制限する。設定外のパスや、対象に変更がない場合は AI を依頼する前に停止する。

## 接続を確認する順序

`prepare` → readRFCInMobile 側で少数カテゴリの `generate` → draft のレビュー → `publish` → 匿名回答と即時採点 → PR コメント・Check の順に確認する。最後に maronn-openid-connect 側の Workflow から同じ条件で起動する。

`401/403` は Access の設定と作問権限、dispatch の `403/404` はトークンの対象・Actions 権限・受け側 main の反映を確認する。公開の `400` では CLI が返すメッセージを確認し、特に `CODE_REPOSITORIES`、固定 SHA、`published`、保存先と PR 情報の一致を見直す。
