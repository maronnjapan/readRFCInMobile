# readRFCInMobile

RFC をスマートフォンでも読みやすく表示する、ビルド不要の静的サイトです。
RFC 番号を入力すると rfc-editor.org から本文を取得し、固定幅 72 桁のプレーンテキストを構造解析してスマホ向けに再レイアウトします。
NIST SP や論文などの PDF も、段組を解いて同じ形式で表示できます（後述）。

## できること

- **RFC 番号で読み込み**: `?rfc=9110` のような URL、またはホーム画面の入力欄から開けます。
- **スマホ向けレイアウト**: 段落は画面幅で折り返し、見出し・リスト・定義リスト・参考文献を HTML の構造に変換します。
- **図表は原文のまま**: ASCII アートは等幅・横スクロールで崩さずに表示します。xml2rfc v3 形式の罫線テーブルは HTML の表に変換します。
- **ナビゲーション**: 目次シート、現在位置のハイライト、読書位置の記憶、スクロール進捗バー、先頭へ戻るボタン。
- **リンク化**: `[RFC2119]` のような引用は参考文献へ、`RFC 9110` や `Section 4.1 of [RFC7231]` は該当 RFC・該当セクションへ飛べます。
- **表示設定**: 文字サイズ、テーマ（自動 / ライト / ダーク / セピア）、コードブロックの折り返し。
- **オフライン対応**: 一度読んだ RFC は Service Worker がキャッシュします。ホーム画面に追加して PWA として使えます。
- **GitHub への保存**: 閲覧画面の「GitHub に保存」から、読んだ RFC のテキストをリポジトリの `rfcs/` に、PDF を `pdfs/` に保存できます（Issue 経由、後述）。
- **廃止・更新の表示**: rfc-editor.org のメタデータが取得できる場合、「この RFC は RFC XXXX により廃止されています」と先頭に表示します。
- **PDF の再レイアウト**: 端末の PDF ファイル、PDF の URL、arXiv の ID から開き、2 段組や見出し・参考文献を解析して RFC と同じ表示にします。図・表・数式は元のページから切り出した画像で表示します。
- **日本語訳への切り替え**: GitHub に翻訳ファイル (`rfcs/ja/`・`pdfs/ja/`) を置くと、RFC も PDF も原文と日本語訳を切り替えて読めます。見た目 (見出し・目次・コード・表・図) は原文と同じです（後述）。

対応フォーマットは、ページ区切り付きの旧来形式（RFC 791 や RFC 2616 など）と、ページ区切りなしの xml2rfc v3 形式（RFC 8650 以降）の両方です。

## 使い方

### 1. GitHub Pages で公開する（推奨）

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
2. `main` ブランチに push すると `.github/workflows/deploy-pages.yml` がテストを実行し、サイトを公開します。
3. `https://<ユーザー名>.github.io/readRFCInMobile/?rfc=9110` のように開きます。

### 2. 手元で動かす

```sh
npm run serve      # http://localhost:8080 で静的配信 (python3 が必要)
npm test           # パーサーとレンダラーのテスト (Node 18 以降、依存パッケージなし)
```

## PDF を読む

ホーム画面の「PDF を読む」から開きます。

- **PDF ファイルを選ぶ**: 端末に保存した PDF を開きます。どのサイトの PDF でも確実に開ける方法です。
- **URL / arXiv ID**: `https://arxiv.org/abs/1706.03762` や `1706.03762`、`arXiv:1706.03762` のように入力します。arXiv はブラウザからの直接取得を許可しているので、そのまま開けます。ほかのサイト（NIST など）はブラウザからの取得を許可していないことが多く、その場合は PDF を端末に保存してからファイルとして開くか、開けなかった画面の「GitHub に保存して読む」で GitHub Actions に取得させてください（[PDF を GitHub に保存する](#pdf-を-github-に保存する)）。
- 開いた PDF は端末内 (IndexedDB) に最大 12 件保存され、「最近読んだもの」から開き直せます。表示設定の「キャッシュを削除」で消えます。URL は `?pdf=<URL>`（ファイルは `?pdf=local:<ID>`）の形になります。
- 「GitHub に保存」で `pdfs/` に保存した PDF は、キャッシュを消しても、ほかの端末からでも「このサイトに保存済み」から読めます。

主な対象は、2 段組の論文（IEEE・ACM・USENIX・arXiv の LaTeX）と、NIST SP のような Word 由来の 1 段組の文書です。

- 段組（段間の縦の空白）を見つけて、左の段 → 右の段の順に読みます。題名や全幅の図など段をまたぐ行はその位置のまま残します。
- 見出しは PDF のしおり（アウトライン）、Tagged PDF のタグ（H1〜H6）、文字の大きさ・書体・番号（`2.1` `IV.` `A.`）の順に手がかりにします。
- 毎ページ同じ位置に出る行（ランニングヘッダー、ページ番号、NIST の「This publication is available free of charge…」）は取り除きます。
- 段・ページをまたいだ段落をつなぎ、行末のハイフンで分かれた語を直します（`attacker-controlled` のような複合語は残します）。
- 参考文献（`[1]` `[SP800-63]` など）を解析し、本文の `[3]` `[3, 12]` から飛べるようにします。脚注は小さな注として表示します。
- 図・表・数式は、キャプション（`Figure 1:` `Table 2.` など）と周りの余白から範囲を決め、元のページを切り出した画像で表示します。画像はタップで拡大できます。Tagged PDF の表は HTML の表にします。

苦手なもの:

- スキャンした画像だけの PDF（文字の情報がないので表示できません）。
- 段落中の数式（記号が崩れることがあります）、3 段以上の段組、段落の横に置かれた注。
- 自動判定なので、文書によっては見出しや段落の区切りを誤ることがあります。その場合はページ末尾のリンクから元の PDF を参照してください。

PDF の読み込みには [PDF.js](https://mozilla.github.io/pdf.js/)（`vendor/pdfjs/`、Apache License 2.0）を使い、PDF を開いたときにだけ読み込みます。日本語などの CMap を使う PDF では、必要なデータを jsDelivr から取得します。

解析結果を手元で確認するには:

```sh
node scripts/pdf-extract.mjs --text paper.pdf          # 解析結果をテキストで表示
node scripts/pdf-extract.mjs --html paper.pdf > a.html # HTML で出力
node scripts/pdf-extract.mjs paper.pdf > paper.json    # 文字の位置情報 (テスト用データ)
```

## 日本語訳を表示する

GitHub に翻訳ファイルを置くと、その文書を原文と日本語訳で切り替えて読めます。`rfcs/`・`pdfs/` に保存した文書はもちろん、rfc-editor.org から読んだ RFC や端末のファイルとして開いた PDF でも、対応する翻訳ファイルがあれば切り替えられます。翻訳ファイルは自分で用意します（アプリが翻訳することはありません）。

| 文書 | 翻訳ファイルの場所 |
| --- | --- |
| RFC | `rfcs/ja/rfcNNNN.json`（例: `rfcs/ja/rfc7591.json`） |
| PDF | `pdfs/ja/<ID>.json`。ID は PDF ファイルの SHA-256 の先頭 16 文字（小文字の 16 進）で、同じファイルなら URL から開いても、端末のファイルとして開いても、`pdfs/` に保存したものを開いても同じです |

翻訳ファイルがある文書を開くと、上部のバーに「日本語」（日本語訳を表示中は「原文」）、題名の下に「原文 / 日本語訳」の切り替えが出ます。切り替えても読んでいた箇所はそのままです。次に翻訳のある文書を開くときは最後に選んだほうで表示します（表示設定の「日本語訳がある文書」でも選べます）。`?rfc=7591&lang=ja` のように URL で指定することもできます。

### 見た目が原文と同じになる仕組み

翻訳ファイルは、原文の見出し・段落・箇条書き・定義リスト・表のセル・図表の説明などの文字列 (`src`) と、その訳文 (`dst`) を並べた JSON です。表示するときは原文を解析した構造をそのまま使い、文字列だけを訳文に置き換えます。

- 見出しの番号、目次、コードブロック、ASCII アート、表の組み方は原文と同じです。
- PDF の図・表・数式は、元の PDF から切り出した画像をそのまま使います。
- 参考文献、コード、著者の連絡先は訳さず、原文のまま表示します。
- 訳文のない (`dst` が空の) 項目は原文のまま表示するので、少しずつ訳せます。題名の下に「翻訳済み 40%」のように表示されます。

### 翻訳ファイルの作り方

1. ひな形を作ります（どちらも同じものができます）。
   - アプリ: 文書の末尾の「翻訳用ファイル (JSON) を書き出す」。PDF はこの方法が手軽です。
   - コマンド: `node scripts/translation.mjs template rfc 7591`、`node scripts/translation.mjs template pdf paper.pdf`（URL や `pdfs/` に保存したファイルも可）
2. 各項目の `dst` に、`src` の訳文を書き込みます。`src` は変更しないでください。
3. GitHub の `rfcs/ja/rfc7591.json`、`pdfs/ja/<ID>.json` に置きます（GitHub の画面の「Add file → Upload files」でも構いません）。サイトの再デプロイが終わると切り替えられるようになります。

```json
{
  "format": "rfcreader-translation",
  "version": 1,
  "lang": "ja",
  "source": { "type": "rfc", "number": 7591, "title": "OAuth 2.0 Dynamic Client Registration Protocol" },
  "note": "（任意）題名の下に表示する注記。翻訳者や翻訳した日など",
  "segments": [
    {"src": "OAuth 2.0 Dynamic Client Registration Protocol", "dst": "OAuth 2.0 動的クライアント登録プロトコル"},
    {"src": "Abstract", "dst": "概要"},
    {"src": "This specification defines mechanisms for dynamically registering ...", "dst": "この仕様は、OAuth 2.0 クライアントを認可サーバーに動的に登録する仕組みを定義する。..."}
  ]
}
```

訳文の書き方:

- `[RFC6749]` のような引用、`RFC 6749`、URL は、そのまま書けば原文と同じくリンクになります。
- 節や図表への参照は「セクション 4.1」「4.1 節」「付録 A」「図 1」「表 2」と書くとリンクになります。ほかの RFC の節は「[RFC6749] のセクション 4.1」「RFC 6749 の 4.1 節」と書きます。
- 要件のキーワードは「しなければならない (MUST)」のように原語を括弧で残すと、原文と同じく太字になります。
- 改行を含む `src`（行ごとに並べた部分）は、`dst` も `\n` で区切ると行ごとに表示します。

確認と更新:

```sh
node scripts/translation.mjs check               # 形式の誤りと、訳した項目の数を表示
node scripts/translation.mjs template rfc 7591   # 既存のファイルの訳文を引き継いで、足りない項目を足す
```

`check` は、原文に見つからない訳文も一覧にします。アプリの更新で段落の区切りが変わった場合などに起こるので、`template` で作り直して足りない項目を訳してください（原文に見つからなくなった訳文も、作業が失われないようファイルの末尾に残ります）。

翻訳ファイルは、表示設定の「キャッシュを削除」や Issue の `delete rfc` / `clear rfcs` / `delete pdf` / `clear pdfs` では削除されません。不要になったら GitHub 上で削除してください。リポジトリが公開されていれば翻訳ファイルも誰でも読めるので、論文などを訳す場合は元の文書のライセンスを確認してください。

### 収録済みの日本語訳

このリポジトリには、次の 4 つの日本語訳を収録しています。どれも全文を訳してあります。

| 文書 | 翻訳ファイル | 原文の利用条件 |
| --- | --- | --- |
| [RFC 7521](https://www.rfc-editor.org/rfc/rfc7521) Assertion Framework for OAuth 2.0 Client Authentication and Authorization Grants | `rfcs/ja/rfc7521.json` | IETF Trust の Legal Provisions Relating to IETF Documents の条件で公開された文書で、翻訳を作ることが認められています |
| [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523) JSON Web Token (JWT) Profile for OAuth 2.0 Client Authentication and Authorization Grants | `rfcs/ja/rfc7523.json` | IETF Trust の Legal Provisions Relating to IETF Documents の条件で公開された文書で、翻訳を作ることが認められています |
| [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591) OAuth 2.0 Dynamic Client Registration Protocol | `rfcs/ja/rfc7591.json` | IETF Trust の Legal Provisions Relating to IETF Documents の条件で公開された文書で、翻訳を作ることが認められています |
| [NIST SP 800-207](https://doi.org/10.6028/NIST.SP.800-207) Zero Trust Architecture（`pdfs/NIST.SP.800-207.pdf`） | `pdfs/ja/0290d6ece2487428.json` | 米国政府 (NIST) の刊行物で、米国内では著作権による保護を受けません |

AI が作成した翻訳で、公式の訳ではありません。正確さが必要な場面では原文を参照してください。誤訳や不自然な箇所は、JSON の `dst` を直接直せます。

- RFC の要件キーワードは「しなければならない (MUST)」のように原語を残してあり、原文と同じく太字で表示されます。
- 参考文献の書誌情報（著者・題名・URL）と、略語・人名だけの項目は、原文のまま表示します。

## 本文の取得元

次の順に試し、最初に成功したものを使います。

1. 表示設定で指定した「取得元 URL テンプレート」（任意。`{n}` が番号に置き換わります）
2. このサイト自身の `rfcs/rfcNNNN.txt`（GitHub に格納するパターン）
3. `https://www.rfc-editor.org/rfc/rfcNNNN.txt`
4. `https://www.ietf.org/rfc/rfcNNNN.txt`

ブラウザから rfc-editor.org に直接アクセスできない環境（CORS の制限など）では、次の「GitHub に格納するパターン」を使ってください。

## GitHub に格納するパターン

`rfcs/` ディレクトリに `rfcNNNN.txt` を置くと、ネットワークに関係なくそのテキストから表示します。
`rfcs/index.json` に載っている RFC はホーム画面の「このサイトに保存済み」に一覧表示されます（日本語訳のあるものには「日本語訳」と付きます）。`index.json` は GitHub Pages に公開するときにも作り直すので、GitHub の画面から直接ファイルを置いた場合も一覧に出ます。

### 方法 0: アプリの「GitHub に保存」ボタン (Issue 経由、推奨)

1. 閲覧画面の「GitHub に保存」を押すと、タイトルに `save rfc 9110` が入った Issue の作成画面が開きます（読み込みに失敗した画面では「GitHub に保存して読む」）。
2. 「Submit new issue」を押すと `.github/workflows/store-rfc.yml` が起動し、rfc-editor.org から本文を取得して `rfcs/rfc9110.txt` にコミットし、サイトを再デプロイして Issue を自動で閉じます。結果は Issue にコメントされます。
3. 以後その RFC は `rfcs/` から読み込まれ、閲覧画面に「GitHub に保存済み」と表示されます。

表示設定の「キャッシュを削除」が消すのは、ブラウザに保存した本文キャッシュ、端末に保存した PDF、最近読んだ履歴だけです。GitHub (`rfcs/`, `pdfs/`) に保存した RFC テキストと PDF は削除されず、その後も「このサイトに保存済み」に表示され、そこから読み込まれます。
保存したテキストを削除したいときは、下のコマンドをタイトルにした Issue を作成してください。

Issue のタイトルで使えるコマンド:

| タイトル | 動作 |
| --- | --- |
| `save rfc 9110` / `save rfc 9110, 6749` | 取得して保存 |
| `delete rfc 9110` | 指定した RFC を削除 |
| `clear rfcs` | すべて削除 |

安全のため、リポジトリのオーナー・メンバー・コラボレーターが作成した Issue だけを処理します（他のユーザーの Issue は無視され、通常の Issue として残ります）。
ブラウザ側にトークンは保存しません。Issue を作成するリポジトリは `index.html` の `<meta name="github-repo">` で指定します（空の場合は `*.github.io` の URL から推定します）。

### 方法 A: GitHub Actions から取得する

**Actions → "Fetch RFC text into rfcs/" → Run workflow** を開き、RFC 番号（例: `9110 6749`）を入力して実行します。
rfc-editor.org から本文を取得して `rfcs/` にコミットします。

### 方法 B: 手元のスクリプトで取得する

```sh
node scripts/fetch-rfc.mjs 9110 6749       # rfcs/rfc9110.txt などを保存し index.json を更新
node scripts/fetch-rfc.mjs --delete 9110   # 削除
node scripts/fetch-rfc.mjs --clear         # すべて削除
node scripts/fetch-rfc.mjs --reindex       # index.json だけ作り直す
```

取得した後に commit / push してください。

### 方法 C: 自分でファイルを置く

`rfcs/rfcNNNN.txt` を置き、`node scripts/fetch-rfc.mjs --reindex` で `index.json` を更新します。

## PDF を GitHub に保存する

PDF はリポジトリの `pdfs/` に保存し、`pdfs/index.json` に一覧（題名・ページ数・元の URL・内容のハッシュ）を載せます。
保存した PDF はホーム画面の「このサイトに保存済み」に表示され、元のサイトや端末のキャッシュに関係なく `pdfs/` から読み込みます。
ブラウザから取得できないサイト（NIST など）の PDF も、GitHub Actions が代わりに取得するので読めるようになります。

> 保存した PDF はリポジトリと GitHub Pages のサイトで公開されます（公開リポジトリなら誰でも見られます）。再配布してよい PDF だけを保存してください。

### アプリの「GitHub に保存」ボタン (Issue 経由、推奨)

- **URL や arXiv ID で開いた PDF**: 閲覧画面の「GitHub に保存」（読み込みに失敗した画面では「GitHub に保存して読む」）を押すと、タイトルに `save pdf <URL>` が入った Issue の作成画面が開きます。「Submit new issue」を押すと、GitHub Actions が PDF を取得して `pdfs/` にコミットし、サイトを再デプロイして Issue を閉じます。
- **端末のファイルとして開いた PDF**: 「GitHub に保存」を押すと、タイトルが `save pdf` の Issue の作成画面が開きます。本文に同じ PDF ファイルを添付して（ドラッグ＆ドロップ、貼り付け、または添付のボタンから選択）送信すると、GitHub Actions が添付ファイルを `pdfs/` に保存します。ブラウザにトークンを置かない方針なので、ファイルは Issue の添付として GitHub に渡します。添付し忘れたときは、Issue を編集して添付するともう一度処理します。

保存が終わると、閲覧画面に「GitHub に保存済み」と表示されます。同じ内容の PDF は二重に保存しません。
ファイルとして保存した PDF は、内容のハッシュ（`?pdf=local:<ID>` の ID）で見分けるので、別の端末で同じファイルを開いても保存済みとして扱います。

Issue のタイトルで使えるコマンド:

| タイトル | 動作 |
| --- | --- |
| `save pdf https://arxiv.org/abs/1706.03762` | URL から取得して保存（arXiv は `save pdf 1706.03762` のように ID でも可。スペース区切りで複数指定可） |
| `save pdf` ＋ 本文に PDF ファイルを添付 | 添付したファイルを保存 |
| `delete pdf arxiv-1706.03762` | 指定した PDF を削除（`pdfs/` のファイル名。`.pdf` は省略可。元の URL でも指定できます） |
| `clear pdfs` | すべて削除 |

ファイル名は、arXiv なら `arxiv-<ID>.pdf`、ほかは URL や添付ファイルの名前から付けます。保存できるのは 1 ファイル 50 MB までです（Issue に添付できるファイルは GitHub の制限で 25 MB まで）。
RFC と同じく、リポジトリのオーナー・メンバー・コラボレーターが作成した Issue だけを処理します。

### 手元のスクリプトで保存する

```sh
node scripts/fetch-pdf.mjs https://arxiv.org/abs/1706.03762  # URL (arXiv の ID も可) から取得して保存
node scripts/fetch-pdf.mjs ~/Downloads/paper.pdf             # 手元のファイルを保存
node scripts/fetch-pdf.mjs --delete arxiv-1706.03762         # 削除
node scripts/fetch-pdf.mjs --clear                           # すべて削除
node scripts/fetch-pdf.mjs --reindex                         # index.json を pdfs/ の中身に合わせる
```

保存した後に commit / push してください。

### 自分でファイルを置く

GitHub の画面（`pdfs/` を開いて **Add file → Upload files**）や git で `pdfs/` に PDF を置くこともできます。
デプロイのたびに `deploy-pages.yml` が公開する `index.json` を `pdfs/` の中身に合わせる（題名を解析して追加し、無くなったものを外す。リポジトリの `index.json` は書き換えません）ので、置いた PDF もそのまま「このサイトに保存済み」に表示されます。
手元の `npm run serve` で確認するときは `node scripts/fetch-pdf.mjs --reindex` を実行してください。

## ファイル構成

```
index.html            アプリのシェル (ホーム画面・リーダー・設定シート)
styles.css            モバイルファーストのスタイル (ライト / ダーク / セピア)
src/rfc-parser.js     RFC テキスト → 構造 (見出し・段落・リスト・図表・参考文献)
src/pdf-extract.js    PDF (PDF.js) → 文字の位置・大きさ・書体、タグ構造、しおり
src/pdf-layout.js     文字の位置 → RFC と同じ構造 (段組・見出し・段落・図表・参考文献の判定)
src/pdf-reader.js     PDF.js の遅延読み込み、図の切り出し描画、端末内への保存 (IndexedDB)
src/render.js         構造 → HTML (リンク化、目次生成)
src/translation.js    翻訳ファイルの検査・ひな形の作成と、構造の文字列だけを訳文に置き換える処理
src/app.js            画面遷移、取得、設定、原文と日本語訳の切り替え、履歴、Service Worker 登録
vendor/pdfjs/         PDF.js 6.4.299 (legacy ビルド)
sw.js                 オフラインキャッシュ
rfcs/                 格納済みの RFC テキストと index.json
rfcs/ja/              RFC の日本語訳 (rfcNNNN.json)
pdfs/                 格納済みの PDF と index.json
pdfs/ja/              PDF の日本語訳 (<SHA-256 の先頭 16 文字>.json)
scripts/fetch-rfc.mjs RFC テキストの取得・削除スクリプト
scripts/fetch-pdf.mjs PDF の取得・保存・削除スクリプト
scripts/issue-command.mjs  Issue のタイトル (と本文の添付ファイル) をコマンドとして実行 (Actions から使用)
scripts/lib/rfc-store.mjs  rfcs/ の保存・削除・index.json 更新
scripts/lib/pdf-store.mjs  pdfs/ の保存・削除・index.json 更新
scripts/translation.mjs    翻訳ファイルのひな形の作成・検査
scripts/lib/translation-store.mjs  rfcs/ja/・pdfs/ja/ のひな形の作成・検査 (translation.mjs とテストから使用)
scripts/lib/translation-index.mjs  index.json に載せる日本語訳の題名の読み込み
scripts/pdf-extract.mjs    PDF の解析結果の確認、テスト用データの作成
test/                 パーサー・レンダラー・保存処理・PDF 解析・翻訳のテスト (test/fixtures/ にテスト用の RFC テキスト、fixtures/pdf/ に PDF とその生成スクリプト)
.github/workflows/    GitHub Pages へのデプロイ、RFC の取得 (手動)、RFC・PDF の保存 (Issue 経由) ワークフロー
```

## 解析の仕組み (概要)

1. フォームフィード (`\f`) や `[Page N]` を手がかりにページヘッダー・フッターを取り除き、ページをまたいだ段落を連結します。
2. 先頭のヘッダーブロック（`Request for Comments:` / `Category:` / 著者 / 日付）とタイトルをメタデータとして抜き出します。
3. 空行で区切られたブロックごとに、見出し・目次・図表キャプション・罫線テーブル・ASCII アート・参考文献・リスト・定義・コード・段落を判定します。
   コードかどうかは、インデントだけでなく `=` や `{` などの記号、行の長さ、列揃えといった内容の特徴で判定します（v3 形式ではコードも本文と同じインデントのため）。
   JSON・HTTP メッセージ・改行された JWT は形でコードと判定し、空行を挟んで続く同じ例（HTTP のヘッダーと本文など）は 1 つのコードブロックにまとめます。記号を含んでいても大半が英文のブロックは段落として扱います。
4. 定義リストやリストの項目の後に続く、より深いインデントの段落・箇条書き・コードは、その項目の説明として入れ子にします。
5. 段落は 1 行に連結してブラウザに折り返しを任せ、図表とコードは等幅のまま残します。

ヒューリスティックなので、珍しいレイアウトの RFC では段落とコードの判定を誤ることがあります。その場合は「原文ヘッダー」や本文末尾のリンクから rfc-editor.org の原文を参照してください。

## ライセンス

このリポジトリのコードは MIT ライセンスです。`rfcs/` と `test/fixtures/` 以下の RFC 本文は IETF Trust の著作物で、RFC の再配布条件に従って無改変で収録しています。`pdfs/` に保存した PDF の権利はそれぞれの著作者にあります。`rfcs/ja/`・`pdfs/ja/` の翻訳ファイルは利用者が用意するもので、原文の著作権はそれぞれの権利者にあります（収録している RFC 7521・RFC 7523・RFC 7591 と NIST SP 800-207 の日本語訳は、上の「収録済みの日本語訳」のとおり、原文の利用条件の範囲で作成したものです）。`test/fixtures/pdf/` の PDF はテスト用に作った架空の文書です。`vendor/pdfjs/` は Mozilla の PDF.js で、Apache License 2.0 です（`vendor/pdfjs/LICENSE`）。
