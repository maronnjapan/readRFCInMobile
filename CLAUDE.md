# CLAUDE.md

RFC と PDF をスマホで読むための、ビルド不要の静的サイトです（詳しくは README.md）。依存パッケージはなく、テストは `npm test`（Node 18 以降）で動きます。`main` に push すると `.github/workflows/deploy-pages.yml` がテストを実行してから GitHub Pages に公開します。

## 日本語訳の作り方

RFC・PDF の日本語訳 (`rfcs/ja/rfcNNNN.json`・`pdfs/ja/<ID>.json`) を頼まれたら、毎回この手順と表記ルールに従ってください。これまでの訳 (RFC 7523、RFC 7591、NIST SP 800-207) はすべてこの型で作っています。ここに書いていないことは、既存の訳（特に `rfcs/ja/rfc7591.json`）の表現に合わせます。

### 手順

1. **原文を確かめる。** RFC は `rfcs/rfcNNNN.txt`、PDF は `pdfs/` にあるものを訳します。RFC がなければ `node scripts/fetch-rfc.mjs NNNN` で保存します（ネットワークが使えなければ、Issue `save rfc NNNN` での保存を利用者に頼みます）。
2. **ひな形を作る。** `node scripts/translation.mjs template rfc NNNN`（PDF は `node scripts/translation.mjs template pdf pdfs/<ファイル>.pdf`）。
   - `src` は変えません。項目の追加・削除・並べ替えもしません（アプリは `src` で原文と突き合わせます）。
   - 参考文献・コード・著者の連絡先はひな形に入りません。訳さず原文のまま表示する決まりです。
3. **すべての `dst` を訳す。** 一部だけ訳して終えることはしません。
   - JSON を手で書き換えず、作業用ディレクトリ (scratchpad) に書いたスクリプトで当てはめます。スクリプトでは、ひな形の順に `[src の書き出し, 訳文]` の組を並べ、書き出しが一致しなければ止めます。書き出しには `src/translation.js` の `stringifyTranslation`（1 行 1 項目）を使います。このスクリプトはコミットしません。
   - `source` の次に `note` を入れます: `AI による日本語訳 (YYYY-MM-DD)。公式の訳ではありません。原文と食い違う場合は原文を優先してください。`（PDF は末尾に `参考文献は原文のまま表示します。` を足します）
4. **機械的に検査する。** 下の「検査」をすべて行います。
5. **独立したレビューを受ける。** サブエージェント (Agent) に、原文・訳 (JSON)・用語の手本 (`rfcs/ja/rfc7591.json`)・この CLAUDE.md の表記ルールを渡し、全項目を突き合わせてもらいます。自分の結論は渡しません。
   - 見てもらう点: 誤訳（否定・論理・主語の取り違えを含む）、訳し漏れ・付け足し、要件キーワードの過不足と位置、引用タグ・URL・識別子の欠落、用語の不統一、明らかに不自然な日本語。
   - 指摘は原文で確かめてから反映します。
6. **一覧と README を更新する。**
   - `node scripts/fetch-rfc.mjs --reindex`（PDF は `node scripts/fetch-pdf.mjs --reindex`）を実行し、`index.json` に `translations.ja`（訳した題名）を載せます。
   - README の「収録済みの日本語訳」の表に行を足し、本文の件数（「次の N つの日本語訳」）と「ライセンス」節の列挙も直します。
7. **`npm test` を通す。**
8. **コミットする。** メッセージは英語で、単位はこれまでと同じです。
   - `Translate RFC NNNN into Japanese`: 翻訳ファイル
   - `Apply review fixes to the RFC NNNN translation`: レビューで直した点（本文に何を直したかを書きます。指摘がなければこのコミットはありません）
   - `List the RFC NNNN translation in rfcs/index.json and the README`: `index.json` と README
9. **push する。** 作業ブランチに push します。main への反映を頼まれたら、レビューの反映まで終えてから、作業ブランチを main に fast-forward で push します。これまでの訳は PR を作らず、この形で main に入れています。

### 検査

```sh
node scripts/translation.mjs check
```

対象のファイルが `o … 訳文 N / N 項目` になり、「原文に見つからない」が出ないことを確かめます。

次のコマンドで、項目ごとに要件キーワード・引用タグ・URL が原文と訳で一致しているかを確かめます。

```sh
node -e '
const t = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const KW = /\b(?:MUST NOT|MUST|REQUIRED|SHALL NOT|SHALL|SHOULD NOT|SHOULD|NOT RECOMMENDED|RECOMMENDED|MAY|OPTIONAL)\b/g;
const TAG = /\[[A-Za-z0-9][\w.+\/-]{0,40}\]/g;
const URL = /https?:\/\/[^\s"<>]*[^\s"<>.,;:)]/g;
const list = (s, re) => (s.match(re) || []).sort().join(" ");
t.segments.forEach((s, i) => {
  for (const [name, re] of [["キーワード", KW], ["引用", TAG], ["URL", URL]]) {
    if (list(s.src, re) !== list(s.dst, re)) console.log(`${i} ${name}: 原文 [${list(s.src, re)}] 訳 [${list(s.dst, re)}]`);
  }
});
' rfcs/ja/rfcNNNN.json
```

差分が出たら直します。ただし、次の 2 つは意図した差分なので残します。

- 原文の改行で URL の途中に空白が入ったものを、訳で 1 つの URL に直したもの。
- 他の RFC の節を指すために、訳で引用タグを補ったもの（下の「参照」）。

最後にアプリで表示を確かめます。`npm run serve` を実行し、`http://localhost:8080/?rfc=NNNN&lang=ja` をスマホ幅（390px）で開きます。次の点を確認します（Playwright があればスクリーンショットで確認します）。

- 題名・見出し・目次が訳になっている。
- 横スクロールが出ない。
- キーワードが太字になり、節の参照がリンクになっている。

### 表記ルール

#### 文体と書式

- 本文は「だ・である」調にします。`note` だけは「です・ます」調にします。
- 英数字と和文の間と、半角括弧の外側には半角スペースを入れます。例: `JWT を`、`OAuth 2.0 [RFC6749] の`、`認可サーバー (AS) によって`。句読点の直前には入れません。例: `(MUST)。`
- 数字は半角で書きます。例: `2 つ`、`1 つ以上`、`セクション 4.1`
- 語末の長音は付けます。例: サーバー、パラメーター、ユーザー、プロバイダー、インターフェース
- 原文が「:」で終わる文（リストや例を導く文）は、訳も半角の「:」で終えます。
- `src` が改行で区切られた項目は、`dst` も同じ行数にして `\n` で区切ります。

#### 要件キーワード (BCP 14)

大文字のキーワードは 1 つ残らず訳に残し、その要件がかかる述語の直後に原語を括弧で添えます（アプリが太字にします）。1 文に 2 つあるときは「〜なければならず (MUST)、〜なければならない (MUST)」のようにします。

| 原文 | 訳 |
| --- | --- |
| MUST | しなければならない (MUST)、でなければならない (MUST) |
| MUST NOT | してはならない (MUST NOT) |
| REQUIRED | 必須 (REQUIRED) |
| SHALL | するものとする (SHALL) |
| SHALL NOT | してはならない (SHALL NOT) |
| SHOULD | すべきである (SHOULD) |
| SHOULD NOT | すべきではない (SHOULD NOT) |
| RECOMMENDED | 推奨される (RECOMMENDED) |
| NOT RECOMMENDED | 推奨されない (NOT RECOMMENDED) |
| MAY | してもよい (MAY) |
| OPTIONAL | 任意 (OPTIONAL) |

小文字の must・should・may はキーワードではないので、原語を添えません。訳はそれぞれ次のとおりです。

- must: 「〜必要がある」
- should: 「〜ことが望ましい」
- may: 「〜できる」「〜場合がある」

#### そのまま残すもの

- 引用タグ (`[RFC6749]`)、`RFC 6749`、URL、URN、パラメーター名・クレーム名などの識別子、登録する値
- 他の仕様の題名と、短い仕様名。例: `"JSON Web Token (JWT)" [JWT]`、`OAuth Assertion Framework [RFC7521]`、`The OAuth 2.0 Authorization Framework [RFC6749]`
- レジストリ名。例: `"OAuth URI" レジストリ`
- 定型文の中の名称（Internet Standards Track、Internet Engineering Task Force (IETF) など）。`rfcs/ja/rfc7591.json` の訳文どおりにします。

#### 引用符

- 値・識別子・英語のまま残す題名を囲む `"..."` は、半角のまま残します。
- 訳す語句を囲む引用符（用語の列挙や “zero trust” など）は「」にします。例: 用語「アクセストークン」「認可コード」、「ゼロトラスト」

#### 参照（この形で書くとアプリがリンクにします）

- `Section 4.1` は `セクション 4.1`、`Appendix A` は `付録 A`、`Figure 1` は `図 1`、`Table 2` は `表 2` と書きます。
- 他の RFC の節は、「のセクション」の直前を `[RFCnnnn]` か `RFC nnnn` にします。
  - `Section 6.2.1 of RFC 3986 [RFC3986]` → `RFC 3986 [RFC3986] のセクション 6.2.1`
  - `Section 4 of the OAuth Assertion Framework [RFC7521]` → `OAuth Assertion Framework [RFC7521] のセクション 4`
  - 原文に引用タグがないとき（`OAuth 2.0, Section 2.3.1`）は補います: `OAuth 2.0 [RFC6749] のセクション 2.3.1`
- Trust Legal Provisions の `Section 4.e` は `Trust Legal Provisions の 4.e 項` と書きます（節へのリンクにしません）。
- URL の直後に和文を続けません。半角スペース・引用符・句読点のどれかを挟みます。例: `http://www.rfc-editor.org/info/rfc7591 で入手できる`。原文の改行で URL の途中に空白が入っているときは、訳では空白を除いて 1 つの URL にします。

#### 決まった訳

見出し:

| 原文 | 訳 |
| --- | --- |
| Abstract | 概要 |
| Status of This Memo | このメモの位置付け |
| Copyright Notice | 著作権表示 |
| Table of Contents | 目次 |
| Introduction | はじめに |
| Notational Conventions | 表記規則 |
| Terminology | 用語 |
| Security Considerations | セキュリティに関する考慮事項 |
| Privacy Considerations | プライバシーに関する考慮事項 |
| Interoperability Considerations | 相互運用性に関する考慮事項 |
| IANA Considerations | IANA に関する考慮事項 |
| References | 参考文献 |
| Normative References | 規範的参考文献 |
| Informative References | 非規範的参考文献 |
| Acknowledgements / Acknowledgments | 謝辞 |
| Authors' Addresses | 著者の連絡先 |

定型の段落（Status of This Memo、Copyright Notice、要件キーワードの段落）は、`rfcs/ja/rfc7591.json` の訳文をそのまま使い、RFC 番号・年・`RFC 2119 [RFC2119]` のような違いだけを合わせます。

決まった言い回し:

- `(with line breaks for display purposes only)` → `(改行は表示のためだけのものである)`
  - `with line wraps within values` なら `値の中の改行は…`、`with extra line breaks` なら `余分な改行は…` とします。
- `The following is a non-normative example ...:` → `次は、…非規範的な…の例である:`
- `For example,`・`e.g.,` → `たとえば、`
- `i.e.,` → `つまり、`
- `a.k.a.` → `…とも呼ばれる`

その他:

- 定義する用語の初出には原語を括弧で添えます。例: `ソフトウェアステートメント (Software Statement)`、`アイデンティティプロバイダー (Identity Provider)`
- IANA の登録テンプレートの項目名は次のように訳します: Change Controller → 変更管理者、Specification Document(s) → 仕様文書、Common Name → 通称（URN はそのまま）。登録する値（名前）は英語のまま残します。

#### 用語（OAuth・JOSE）

1 つの文書の中では、必ず同じ訳語を使います。

| 原語 | 訳語 |
| --- | --- |
| authorization server | 認可サーバー |
| resource owner / resource server | リソースオーナー / リソースサーバー |
| protected resource | 保護されたリソース |
| client identifier / client secret | クライアント識別子 / クライアントシークレット |
| client credentials | クライアントクレデンシャル |
| client authentication | クライアント認証 |
| public client / confidential client | パブリッククライアント / コンフィデンシャルクライアント |
| access token / refresh token | アクセストークン / リフレッシュトークン |
| access token request / response | アクセストークンリクエスト / アクセストークンレスポンス |
| authorization grant / grant type | 認可グラント / グラントタイプ |
| extension grant type | 拡張グラントタイプ |
| authorization code | 認可コード |
| authorization endpoint / token endpoint | 認可エンドポイント / トークンエンドポイント |
| redirection URI | リダイレクト URI |
| scope | スコープ |
| error response | エラーレスポンス |
| end-user | エンドユーザー |
| claim | クレーム |
| assertion / security token | アサーション / セキュリティトークン |
| Bearer token | Bearer トークン（例: JWT Bearer トークン） |
| issuer / subject / audience | 発行者 / サブジェクト / オーディエンス（クレーム名は `"iss" (issuer) クレーム` のように残す） |
| intended audience | 意図されたオーディエンス |
| principal | プリンシパル |
| party | 当事者 |
| trust relationship | 信頼関係 |
| digitally signed | デジタル署名されている |
| Message Authentication Code (MAC) | 英語のまま |
| replay | リプレイ |
| clock skew | クロックスキュー |
| validate / verify | 検証する |
| deployment | デプロイメント（NIST SP 800-207 の訳では「展開」） |
| out of scope | （この仕様の）範囲外 |
| out of band | アウトオブバンド |
| document / specification | 文書 / 仕様 |
| default | 既定値 |
| registry | レジストリ |
| non-normative | 非規範的 |
