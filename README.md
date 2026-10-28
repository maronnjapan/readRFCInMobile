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
- **GitHub への保存**: 閲覧画面の「GitHub に保存」から、読んだ RFC のテキストをリポジトリの `rfcs/` に保存できます（Issue 経由、後述）。
- **廃止・更新の表示**: rfc-editor.org のメタデータが取得できる場合、「この RFC は RFC XXXX により廃止されています」と先頭に表示します。
- **PDF の再レイアウト**: 端末の PDF ファイル、PDF の URL、arXiv の ID から開き、2 段組や見出し・参考文献を解析して RFC と同じ表示にします。図・表・数式は元のページから切り出した画像で表示します。

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
- **URL / arXiv ID**: `https://arxiv.org/abs/1706.03762` や `1706.03762`、`arXiv:1706.03762` のように入力します。arXiv はブラウザからの直接取得を許可しているので、そのまま開けます。ほかのサイト（NIST など）はブラウザからの取得を許可していないことが多く、その場合は PDF を端末に保存してからファイルとして開いてください。
- 開いた PDF は端末内 (IndexedDB) に最大 12 件保存され、「最近読んだもの」から開き直せます。表示設定の「キャッシュを削除」で消えます。URL は `?pdf=<URL>`（ファイルは `?pdf=local:<ID>`）の形になります。

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

## 本文の取得元

次の順に試し、最初に成功したものを使います。

1. 表示設定で指定した「取得元 URL テンプレート」（任意。`{n}` が番号に置き換わります）
2. このサイト自身の `rfcs/rfcNNNN.txt`（GitHub に格納するパターン）
3. `https://www.rfc-editor.org/rfc/rfcNNNN.txt`
4. `https://www.ietf.org/rfc/rfcNNNN.txt`

ブラウザから rfc-editor.org に直接アクセスできない環境（CORS の制限など）では、次の「GitHub に格納するパターン」を使ってください。

## GitHub に格納するパターン

`rfcs/` ディレクトリに `rfcNNNN.txt` を置くと、ネットワークに関係なくそのテキストから表示します。
`rfcs/index.json` に載っている RFC はホーム画面の「このサイトに保存済み」に一覧表示されます。

### 方法 0: アプリの「GitHub に保存」ボタン (Issue 経由、推奨)

1. 閲覧画面の「GitHub に保存」を押すと、タイトルに `save rfc 9110` が入った Issue の作成画面が開きます（読み込みに失敗した画面では「GitHub に保存して読む」）。
2. 「Submit new issue」を押すと `.github/workflows/store-rfc.yml` が起動し、rfc-editor.org から本文を取得して `rfcs/rfc9110.txt` にコミットし、サイトを再デプロイして Issue を自動で閉じます。結果は Issue にコメントされます。
3. 以後その RFC は `rfcs/` から読み込まれ、閲覧画面に「GitHub に保存済み」と表示されます。

表示設定の「キャッシュを削除」を押すと、ブラウザのキャッシュと履歴を消すのに加えて、タイトルが `clear rfcs` の Issue 作成画面を開きます。送信すると `rfcs/` の RFC テキストが**すべて**（最初から同梱されているものも含めて）削除されます。

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

## ファイル構成

```
index.html            アプリのシェル (ホーム画面・リーダー・設定シート)
styles.css            モバイルファーストのスタイル (ライト / ダーク / セピア)
src/rfc-parser.js     RFC テキスト → 構造 (見出し・段落・リスト・図表・参考文献)
src/pdf-extract.js    PDF (PDF.js) → 文字の位置・大きさ・書体、タグ構造、しおり
src/pdf-layout.js     文字の位置 → RFC と同じ構造 (段組・見出し・段落・図表・参考文献の判定)
src/pdf-reader.js     PDF.js の遅延読み込み、図の切り出し描画、端末内への保存 (IndexedDB)
src/render.js         構造 → HTML (リンク化、目次生成)
src/app.js            画面遷移、取得、設定、履歴、Service Worker 登録
vendor/pdfjs/         PDF.js 6.4.299 (legacy ビルド)
sw.js                 オフラインキャッシュ
rfcs/                 格納済みの RFC テキストと index.json
scripts/fetch-rfc.mjs RFC テキストの取得・削除スクリプト
scripts/issue-command.mjs  Issue タイトルをコマンドとして実行 (Actions から使用)
scripts/lib/rfc-store.mjs  rfcs/ の保存・削除・index.json 更新
scripts/pdf-extract.mjs    PDF の解析結果の確認、テスト用データの作成
test/                 パーサー・レンダラー・保存処理・PDF 解析のテスト (test/fixtures/ にテスト用の RFC テキスト、fixtures/pdf/ に PDF とその生成スクリプト)
.github/workflows/    GitHub Pages へのデプロイ、RFC 取得 (手動 / Issue 経由) ワークフロー
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

このリポジトリのコードは MIT ライセンスです。`rfcs/` と `test/fixtures/` 以下の RFC 本文は IETF Trust の著作物で、RFC の再配布条件に従って無改変で収録しています。`test/fixtures/pdf/` の PDF はテスト用に作った架空の文書です。`vendor/pdfjs/` は Mozilla の PDF.js で、Apache License 2.0 です（`vendor/pdfjs/LICENSE`）。
