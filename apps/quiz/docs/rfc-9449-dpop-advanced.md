# RFC 9449 DPoP 発展問題集（128 問）

[基本の問題集（80 問）](rfc-9449-dpop.md)の続きです。RFC 9449 の要件を、強さ・条件・主語まで正確に読み分けられるかを確かめ、DPoP が土台にしている仕様（JWS・JWK・JWA・JWT、JWK Thumbprint、cnf、introspection、HTTP の認証と URI の正規化、メタデータ、PAR・PKCE、mTLS、OAuth のセキュリティ BCP）まで広げます。最後に、DPoP の処理を自分で実装する問題（スマホではコード読解）を解きます。

基本の問題集と違い、選択式の誤答は「一か所だけ違う」ように作っています。正解を選べたら、ほかの選択肢がどの一語・どの条件で誤りになるのかも説明してください。説明できない選択肢があれば、解説の出典を開いて原文を読んでください。

出典はコミットに固定しています。RFC 9449 は基本の問題集と同じ `993c1cf7f6b5fd47c151a56d60bb801bdd921aac`、関連する RFC はこのリポジトリに保存した `1ae11d196faad317d95d4d02e402621dcde76d49` の本文です。問題アプリでは、出典のリンクからリーダーの該当行を開けます。

## 学習の進め方

1. 第 1 部（RFC 9449 精読）から始めてください。基本の問題集を解いた後なら、どの部から始めても構いません。
2. 選択式は、正解の根拠になる一文を原文から探してください。MUST と SHOULD、「〜の場合だけ」という条件、AS・RS・クライアントのどれの義務かで、選択肢が分かれています。
3. 並べ替えは、各手順がどの値を前提にしているか（どの値がそろわないと次へ進めないか）を考えてください。
4. 記述式と実装は、短い箇条書きやコメントで構いません。採点基準と照らして、抜けている観点を出典で確かめてください。
5. 第 7 部の実装問題は、PC ではコードを書き、スマホではコードを読んで正しい実装を選びます。ケースの入出力をすべて満たすかを確かめてください。

| 順番 | 内容 | 構成 | 問題アプリ用データ |
| --- | --- | --- | --- |
| [第 1 部](#part-1) | RFC 9449 精読 — 要件の強さ・条件・主語 | 選択 18・並べ替え 1・記述 1 | [JSON](../questions/spec/rfc-9449-05-close-reading.json) |
| [第 2 部](#part-2) | JOSE の土台 — JWS・JWK・JWA・JWT と proof | 選択 17・並べ替え 1・記述 2 | [JSON](../questions/spec/rfc-9449-06-jose.json) |
| [第 3 部](#part-3) | 鍵の結び付け — JWK Thumbprint・cnf・introspection | 選択 18・並べ替え 1・記述 1 | [JSON](../questions/spec/rfc-9449-07-key-binding.json) |
| [第 4 部](#part-4) | HTTP の細部 — メソッド・URI・認証ヘッダー・状態コード | 選択 18・並べ替え 1・記述 1 | [JSON](../questions/spec/rfc-9449-08-http.json) |
| [第 5 部](#part-5) | 相互運用 — メタデータ・登録・PAR・PKCE | 選択 18・並べ替え 1・記述 1 | [JSON](../questions/spec/rfc-9449-09-metadata-par.json) |
| [第 6 部](#part-6) | 方式比較と脅威モデル — mTLS・Bearer・セキュリティ BCP | 選択 18・記述 2 | [JSON](../questions/spec/rfc-9449-10-design-threats.json) |
| [第 7 部](#part-7) | 実装 — DPoP の処理を自分で書く（スマホではコード読解） | 実装 8 | [JSON](../questions/spec/rfc-9449-11-implementation.json) |

計 128 問です。選択式は各 1 点、並べ替えは各 2 点、記述式と実装は採点基準ごとに配点しています。

## 扱う仕様

| 仕様 | DPoP との関係 | 主に扱う部 |
| --- | --- | --- |
| RFC 9449 | DPoP 本体。要件の強さと条件 | 第 1 部・全体 |
| RFC 7515・7517・7518・7519・8037 | proof の JWS 構造、jwk、署名アルゴリズム、iat・jti | 第 2 部 |
| RFC 8725 | alg の検証、明示的な型付け（typ）、別用途 JWT の取り違え | 第 2 部・第 6 部 |
| RFC 7638・7800・7662・9068 | jkt の計算、cnf、introspection、JWT アクセストークン | 第 3 部 |
| RFC 9110・3986・6750 | htm・htu、URI の正規化、認証ヘッダーと challenge、状態コード | 第 4 部 |
| RFC 8414・9728・7591・9126・7636・6749 | メタデータ、クライアント登録、PAR、PKCE、token_type | 第 5 部 |
| RFC 8705・9700 | mTLS との比較、送信者制約の推奨と refresh token の保護 | 第 6 部 |

## 問題アプリで使う場合

7 つのセットは仕様 ID `rfc-9449` に属します。レビュー前の候補なので、JSON の `status` は `draft` です。draft のファイルはデプロイ時の出題対象に入らないので、このページで自習してください。レビュー後に各 JSON の `status` を `published` にして main に反映すると、`/quiz?spec=rfc-9449` に基本の 4 セットと並んで表示されます。ログインなしで回答でき、記述式と実装の AI 採点を依頼するときだけ認証します。別の固定版を追加で登録する方法は[基本の問題集の手順](rfc-9449-dpop.md#問題アプリで使う場合)と同じです。

<a id="part-1"></a>

## 第 1 部：RFC 9449 精読 — 要件の強さ・条件・主語

20 問・26 点。MUST・SHOULD・MAY の強さ、要件が発生する条件、誰の義務かを取り違えやすい箇所を集めました。

### 1-01. MUST はどれか

知識 / 選択式 / 1 点

次のうち、RFC 9449 が MUST（必須）として定めているものはどれですか？

- **A.** RS が challenge に algs パラメーターを含め、受け入れる alg を示す
- **B.** サーバーが proof を受理するのは、その proof の生成後の限られた時間のあいだに限る
- **C.** jti を記録するサーバーが、不必要に大きい jti を拒否するか hash だけを保存する
- **D.** htu を比較する前に、RFC 3986 の構文ベース・スキームベースの正規化を行う
- **E.** 対象 URI の文脈で jti を記録し、同じ proof の 2 回目の利用を拒否する

<details>
<summary>解答・解説</summary>

**正解：B**

§11.1 は「servers MUST only accept DPoP proofs for a limited time after their creation」と定めています。D は §4.3 の SHOULD です。E は §11.1 で「can」と書かれ、共有状態のない複数台のように厳格に行えない構成があるとも述べています。A は §7.1 の SHOULD、C は §11.1 の小文字の should で、jti を追跡するサーバーへの注意です。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936)

</details>

### 1-02. 要件の強さの組み合わせ

知識 / 選択式 / 1 点

次の 4 つの記述について、RFC 9449 の要件の強さの組み合わせとして正しいものはどれですか？  
(1) AS が、DPoP proof 付きの要求に Bearer のアクセストークンを発行する  
(2) token_type が DPoP でない応答を受けたクライアントが、DPoP の保護を重要とする場合に応答を破棄する  
(3) 認可要求で dpop_jkt を使う  
(4) AS が nonce の値を予測できないものにする

- **A.** (1) SHOULD NOT　(2) MAY　(3) OPTIONAL　(4) MUST
- **B.** (1) MAY　(2) SHOULD　(3) RECOMMENDED　(4) MUST
- **C.** (1) MUST NOT　(2) MUST　(3) OPTIONAL　(4) SHOULD
- **D.** (1) MAY　(2) MUST　(3) OPTIONAL　(4) MUST
- **E.** (1) MAY　(2) MUST　(3) PAR を使う場合は REQUIRED　(4) MUST

<details>
<summary>解答・解説</summary>

**正解：D**

§5 の「An authorization server MAY elect to issue access tokens that are not DPoP bound」が (1)、「The client MUST discard the response in this case if this protection is deemed important」が (2) です。(2) は保護を重要とする場合に限る条件付きの MUST です。§10 は「Use of the dpop_jkt authorization request parameter is OPTIONAL」、§8 は「Nonce values MUST be unpredictable」です。E：PAR と DPoP の両方に対応する AS は dpop_jkt と DPoP ヘッダーの両方式をサポートしなければなりませんが（§10.1）、クライアントに dpop_jkt を必須にする規定ではありません。§10.1 の「In this case, dpop_jkt MUST be included alongside other authorization request parameters in the POST body of the PAR request」も、dpop_jkt を使う場合の置き場所の要件です。B の RECOMMENDED は、§10 が PKCE について Security BCP の推奨に触れた箇所との混同です。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118)

</details>

### 1-03. トークンエンドポイントで適用されない検証

知識 / 選択式 / 1 点

public client が refresh token を使い、AS のトークンエンドポイントへ要求します。要求にアクセストークンは含めません。AS はこのクライアントに nonce を提供済みです。

§4.3 の検証項目のうち、この要求の proof には適用されないものはどれですか？

- **A.** ath と、アクセストークンに結び付いた鍵を、そのアクセストークンについて照合すること
- **B.** htu が、query と fragment を除いたトークンエンドポイントの URI と、正規化の後に一致すること
- **C.** iat、または nonce に入れたサーバーの時刻で判断した生成時刻が、受理できる時間窓に収まること
- **D.** nonce クレームが、AS がこのクライアントに提供した最近の nonce と完全に一致すること
- **E.** jwk ヘッダーパラメーターに、秘密鍵のメンバー（d など）が含まれていないこと

<details>
<summary>解答・解説</summary>

**正解：A**

§4.3 の 12 番目は「If presented to a protected resource in conjunction with an access token」の場合の検証で、トークンエンドポイントへの要求には適用されません。§4.2 でも ath は、保護されたリソースへのアクセスでアクセストークンと一緒に proof を使う場合の必須クレームです。なお public client の refresh token は、§5 により AS が同じ鍵の proof かどうかを別途検証します。これは ath ではなく、AS が refresh token に保持する結び付けの検証です。D は nonce を提供済みなので適用されます（10 番目）。B・E・C は条件のない検証です。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

### 1-04. ath が必須になる条件

知識 / 選択式 / 1 点

proof に ath クレームを含めなければならない（MUST）のはどの場合ですか？

- **A.** RS が DPoP-Nonce を提供した後に、保護されたリソースへ送る要求だけ
- **B.** アクセストークンが JWT 形式で、cnf.jkt を含む場合だけ
- **C.** 保護されたリソースへのアクセスで、アクセストークンと一緒に proof を提示する場合
- **D.** refresh token を提示するトークン要求で、その refresh token のハッシュとして含める場合
- **E.** クライアントがアクセストークンを保持している間に送る、すべての proof（トークンエンドポイントへの refresh 要求を含む）

<details>
<summary>解答・解説</summary>

**正解：C**

§4.2 と §7 は、保護されたリソースへのアクセスでアクセストークンを提示するときに ath を MUST としています。E：判断の基準はトークンを保持しているかではなく、その要求で提示するかです。トークンエンドポイントへの refresh 要求はアクセストークンを提示しません。A：nonce の有無とは独立です。B：opaque トークンでも ath は必要で、RS は提示された値からハッシュを計算します。D：ath はアクセストークンのハッシュで、refresh token のハッシュを入れる仕組みはありません。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 1-05. 200 応答で受け取った nonce

知識 / 選択式 / 1 点

クライアントは、AS のトークン応答（HTTP 200）で初めて DPoP-Nonce: N1 を受け取りました。これまで use_dpop_nonce のエラーを受けたことはありません。

この AS への次のトークン要求について、正しいものはどれですか？

- **A.** 次の要求では N1 を含めない。use_dpop_nonce のエラーを受けてから初めて含める
- **B.** 200 応答で届く nonce は RS 向けの値である。AS へのトークン要求には含めない
- **C.** N1 は 1 回だけ使える値である。2 回目以降のトークン要求では nonce を省略する
- **D.** エラーで要求されたわけではないので、nonce は任意である。含めるかどうかはクライアントが選べる
- **E.** 次のトークン要求から N1 を含め続ける。新しい値が提供されたら、その値に切り替える

<details>
<summary>解答・解説</summary>

**正解：E**

§8.2 は、200 (OK) 応答に DPoP-Nonce を含める方法を、往復を減らす効率的な方法として定義しています。「The client MUST use the new nonce value supplied for the next token request and for all subsequent token requests until the authorization server supplies a new nonce」です。§4.2 も、AS または RS が応答で DPoP-Nonce を提供したら nonce を含めることを MUST としています。D・A はエラー応答だけを契機と誤解しています。B：AS が自分の応答で提供した nonce は AS 向けです。C：§11.1 のとおり、同じ nonce を複数回使うことは許容されます。同じ proof の再利用は jti で防ぎます。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235)

</details>

### 1-06. dpop_bound_access_tokens が保証すること

知識 / 選択式 / 1 点

あるクライアントのメタデータに dpop_bound_access_tokens: true が登録されています。

RFC 9449 の規定だけから保証されることはどれですか？

- **A.** AS は、このクライアントに常に token_type=DPoP のアクセストークンを発行する
- **B.** RS は、このクライアントのアクセストークンが Bearer 方式で届いたら必ず拒否する
- **C.** このクライアントの refresh token は、confidential client であっても DPoP 鍵に結び付く
- **D.** AS は、このクライアントからの DPoP ヘッダーを含まないトークン要求を拒否する
- **E.** このクライアントの認可要求には dpop_jkt を必ず含める

<details>
<summary>解答・解説</summary>

**正解：D**

§5.2 は「If the value is true, the authorization server MUST reject token requests from the client that do not contain the DPoP header」と定めるだけです。このメタデータは、クライアントがトークン要求で常に DPoP を使うことを表します。A：§5 の「An authorization server MAY elect to issue access tokens that are not DPoP bound」を打ち消す規定はなく、発行する token type までは保証しません。クライアントは token_type を確認します。B：RS の挙動はこのメタデータの対象外で、§7.2 などで別に定まります。E：dpop_jkt は OPTIONAL のままです。C：confidential client の refresh token は §5 のとおり DPoP 鍵に結び付きません。

**出典：** [§5.2: dpop_bound_access_tokens の既定値と要求](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L662-L682) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021)

</details>

### 1-07. 別の鍵での refresh

比較・使い分け / 選択式 / 1 点

クライアントは鍵 K1 の proof でトークンを取得しました。その後、新しい鍵 K2 で正しく署名した proof を付けて refresh token を提示します。他の検証はすべて成功しています。

public client の場合と、クライアント認証に成功した confidential client の場合で、AS の扱いとして正しい組み合わせはどれですか？

- **A.** public：認可要求に dpop_jkt=thumbprint(K2) があった場合だけ受理する　confidential：受理する
- **B.** public：拒否する　confidential：受理でき、新しいアクセストークンを K2 に結び付ける
- **C.** public：受理して K2 に結び付け直す　confidential：受理する
- **D.** public：拒否する　confidential：拒否する（refresh token はクライアントの種類によらず K1 に結び付くため）
- **E.** public：拒否する　confidential：受理するが、新しいアクセストークンは K1 に結び付ける

<details>
<summary>解答・解説</summary>

**正解：B**

§5 により、public client に発行した refresh token は proof の公開鍵に結び付けられ（MUST）、使うたびに同じ鍵の proof が必要です（MUST）。K2 の proof では K1 への結び付きを満たせないので拒否します。confidential client の refresh token は DPoP 鍵に結び付かず、クライアント識別子とクライアント認証で送信者制約されます。§5 はこの方式を、クライアント認証の資格情報をローテーションしても refresh token を無効にしない柔軟な方式と説明しています（DPoP 鍵の交換について述べた文ではありません）。AS は新しいアクセストークンを、その要求の proof の公開鍵（K2）に結び付けます。E は proof と異なる鍵に結び付けています。A の dpop_jkt は認可コードの結び付けで、refresh token の検証とは関係ありません。

**出典：** [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

### 1-08. 結び付け先の鍵の情報源

誤り発見・原因特定 / 選択式 / 1 点

opaque なアクセストークンを受け取る RS が introspection を使わず、「同じトークン値で最初に届いた proof の jwk を記録し、以降はその鍵と一致する proof だけを受理する」実装にしています。

この実装の問題として最も適切なものはどれですか？

- **A.** 結び付けは AS が発行時に行う。RS は cnf.jkt や introspection など、信頼できる情報源から知る必要がある
- **B.** 問題はない。最初の proof で鍵の所持が示されたので、以降はその鍵を結び付け先として扱ってよい
- **C.** RFC 9449 は結び付けの表現を cnf.jkt に限っている。opaque トークンはそもそも DPoP に使えない
- **D.** 最初の proof に RS が提供した nonce が含まれていれば、この方式でも RFC 9449 の要件を満たす
- **E.** 問題は jwk 全体を記録する点だけである。代わりに kid を記録すれば、この方式でも安全になる

<details>
<summary>解答・解説</summary>

**正解：A**

§6 は、RS がトークンが DPoP-bound かどうかと結び付いた公開鍵を信頼できる方法で知れることを MUST とし、例として JWT の cnf.jkt と introspection（§6.2）を挙げています。AS と RS の合意によるその他の方法もありますが、どれも発行時の結び付けを RS が参照する方法です。最初に提示された鍵を信用する方式では、漏えいしたトークンを正規クライアントより先に使った攻撃者の鍵が結び付け先になります。E・D は原因を解決しません。C：opaque トークンは introspection などで扱えます。

**出典：** [§6: RS が取得する鍵の結び付け情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L684-L699) / [§6.2: introspection 応答と RS によるローカルな鍵照合](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L742-L762) / [§3: AS・クライアント・RS の役割と基本フロー](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L255-L335)

</details>

### 1-09. challenge のパラメーター

知識 / 選択式 / 1 点

RS が返す WWW-Authenticate: DPoP の challenge について、RFC 9449 の記述と一致するものはどれですか？

- **A.** error_description は、エンドユーザーに表示する説明として含めることが推奨される（RECOMMENDED）
- **B.** scope パラメーターは Bearer のためのもので、DPoP の challenge には含めてはならない（MUST NOT）
- **C.** algs は SHOULD で含め、受信側は未知のパラメーターを無視しなければならない（MUST）
- **D.** algs は MUST で含め、値は JWS の alg 値をカンマで区切ったリストにしなければならない
- **E.** 401 応答には、理由を示す error パラメーターを常に含めなければならない（MUST）

<details>
<summary>解答・解説</summary>

**正解：C**

§7.1 では、algs は「SHOULD be included」で、値はスペース区切りの JWS alg 値のリストです。「unknown parameters MUST be ignored by recipients」です。D は強さと区切り文字が誤りです。E：error は、要求にアクセストークンが含まれ認証に失敗した場合に SHOULD で含めます。認証情報のない要求には、エラー情報を含めるべきではない（SHOULD NOT）とされています（§7.2、RFC 6750 §3.1）。B：§7.1 は、RFC 6750 §3 で定義された scope を MAY で含められるとしています。A：error_description は開発者向けで、エンドユーザーに表示するものではありません。

**出典：** [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021)

</details>

### 1-10. 古い nonce を含む proof

誤り発見・原因特定 / 選択式 / 1 点

AS は、最近の nonce として N4 と N5 を有効にしています。クライアントが 2 時間前に提供された N1 を含む proof でトークン要求を送りました。他の検証はすべて成功しています。

AS の扱いとして RFC 9449 に沿うものはどれですか？

- **A.** いったん受理してよい。成功応答で新しい nonce を提供すれば、次から正しい値になる
- **B.** 拒否し、error は invalid_dpop_proof とする。拒否応答に新しい nonce を含めてはならない
- **C.** 拒否しなければならない。拒否応答には、新しい DPoP-Nonce を必ず含めなければならない（MUST）
- **D.** N1 は AS が一度提供した値である。最近の値でなくても受理しなければならない
- **E.** 拒否しなければならない。拒否応答で、新しい nonce を DPoP-Nonce として提供してもよい（MAY）

<details>
<summary>解答・解説</summary>

**正解：E**

§8 は「If the nonce claim in the DPoP proof does not exactly match a nonce recently supplied by the authorization server to the client, the authorization server MUST reject the request. The rejection response MAY include a DPoP-Nonce HTTP header」と定めます。use_dpop_nonce は、不一致の際に新しい nonce を提供するときにも使います。C は MAY を MUST に強めています。B：新しい nonce を含めることを禁止する規定はありません。D・A は、最近提供した nonce と完全に一致しない値を受理しています。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159)

</details>

### 1-11. DPoP のエラーコードを使う場所

知識 / 選択式 / 1 点

IANA に登録された use_dpop_nonce と invalid_dpop_proof の使用場所（Usage Location）として正しいものはどれですか？

- **A.** どちらも、保護されたリソースへのアクセスのエラー応答だけ
- **B.** use_dpop_nonce は両方、invalid_dpop_proof は認可エラー応答を含む 3 か所
- **C.** どちらも、トークンエラー応答と認可エラー応答（リダイレクトで返すエラー）
- **D.** use_dpop_nonce はトークンエラー応答だけ、invalid_dpop_proof は両方
- **E.** どちらも、トークンエラー応答と、保護されたリソースへのアクセスのエラー応答

<details>
<summary>解答・解説</summary>

**正解：E**

§12.2 の登録では、どちらも Usage Location が「token error response, resource access error response」です。AS では RFC 6749 §5.2 の形式（HTTP 400 の JSON）、RS では WWW-Authenticate: DPoP の error として使います（§7.1・§8・§9）。認可エンドポイントからリダイレクトで返すエラーは登録されていません。DPoP ヘッダーは、ブラウザーのリダイレクトではなく、クライアントが直接送る HTTP 要求に付けるものです。

**出典：** [§12.1〜12.5: token type、エラー、dpop_jkt、認証スキーム、media type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1550-L1629) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235)

</details>

### 1-12. token type DPoP の登録内容

知識 / 選択式 / 1 点

OAuth Access Token Types に登録された token type「DPoP」について、正しいものはどれですか？

- **A.** トークン応答に cnf（jkt）を追加し、クライアントが結び付けを確認できるようにする
- **B.** トークン応答の JSON に nonce を追加し、次の nonce を返す
- **C.** HTTP 認証スキームは Bearer で、token_type の値だけが DPoP になる
- **D.** 追加のトークン応答パラメーターはなく、HTTP 認証スキームは DPoP である
- **E.** トークン応答に dpop_jkt を追加し、認可要求で指定した値を返す

<details>
<summary>解答・解説</summary>

**正解：D**

§12.1 では「Additional Token Endpoint Response Parameters: (none)」「HTTP Authentication Scheme(s): DPoP」です。クライアントは token_type=DPoP で、トークンが自分の鍵に結び付いたことを知ります（§5）。次の nonce は JSON ではなく DPoP-Nonce ヘッダーで渡します（§8.2）。cnf.jkt は RS が結び付けを検証するための情報で、アクセストークン自体や introspection 応答で伝えます（§6）。

**出典：** [§12.1〜12.5: token type、エラー、dpop_jkt、認証スキーム、media type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1550-L1629) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§6: RS が取得する鍵の結び付け情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L684-L699)

</details>

### 1-13. 抽出できる鍵と XSS

誤り発見・原因特定 / 選択式 / 1 点

SPA が DPoP の秘密鍵を JWK として localStorage に保存しています（抽出できる鍵）。攻撃者は XSS で SPA のオリジン上でスクリプトを実行し、refresh token を盗みました。

DPoP による防御の評価として正しいものはどれですか？

- **A.** XSS は localStorage の鍵も持ち出せるので、攻撃者は自分の端末で proof を作って refresh token を使える
- **B.** 攻撃者の端末から送る proof は htu が正規の端末と異なるので、AS が拒否する
- **C.** AS が nonce を使っていれば、鍵を盗まれても攻撃者は受理される proof を作れない
- **D.** AS が jti を記録していれば、攻撃者が作る proof は再利用として拒否される
- **E.** refresh token は DPoP 鍵に結び付いているので、鍵の保存方法によらず、攻撃者は盗んだ refresh token を自分の端末で使えない

<details>
<summary>解答・解説</summary>

**正解：A**

§2 は「If the private key is non-extractable (as is possible with [W3C.WebCryptoAPI]), DPoP renders exfiltrated tokens alone unusable」と、鍵を抽出できないことを条件にしています。鍵を抽出できる形で保存すると、XSS はトークンと鍵の両方を持ち出せます。E：トークンだけでは使えないとされるのは鍵を抽出できない場合で、保存方法によらず使えないとは言えません。B：htu は送信先の URI で、送信元の端末を表しません。C：nonce は事前生成した proof の利用を制限しますが、鍵を持つ攻撃者は受け取った nonce を入れた新しい proof を作れます。D：攻撃者は毎回新しい jti を使えます。§11.4 のとおり、クライアントで信頼できないコードを実行させないことが重要です。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433) / [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391)

</details>

### 1-14. 検証の順序とすべての成功

知識 / 選択式 / 1 点

§4.3 の検証について、RFC 9449 の記述と一致するものはどれですか？

- **A.** 1 から 12 の順に行う必要があり、署名の検証（6 番目）より前に htm・htu を照合してはならない
- **B.** htu は正規化せず、文字列として完全に一致させなければならない（MUST）
- **C.** 検証は任意の順序で行えるが、すべてに成功するまでアクセスを許可してはならない
- **D.** nonce の照合（10 番目）に成功すれば、生成時刻の検証（11 番目）は省略してよい
- **E.** 1〜7 番目は AS が、8〜12 番目は RS が担当し、互いの検証は行わない

<details>
<summary>解答・解説</summary>

**正解：C**

§4.3 は最後に「These checks may be performed in any order」と述べ、§7.1 は「The resource server MUST NOT grant access to the resource unless all checks are successful」と定めます。D：11 番目は生成時刻を「iat、またはサーバーが nonce で管理する時刻」で判断すると書いています。nonce で時刻を管理する場合も、時間窓の検証自体を省略するわけではありません。B：正当な proof を誤って拒否すること（偽陰性）を減らすため、構文ベース・スキームベースの正規化を行うことが SHOULD です。E：AS も RS も 1〜11 番目を行い、12 番目はアクセストークンと一緒に提示された場合の検証です。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854)

</details>

### 1-15. 正規の利用者による proof の持ち出し

ユースケース設計 / 選択式 / 1 点

銀行の社員が、DPoP 鍵を持つ業務端末で将来の iat を入れた proof を大量に作り、私物の端末へ持ち出して後日使おうとしています。鍵はハードウェアで保護され、抽出できません。RS は jti を記録して重複を拒否し、iat の時間窓も検証しています。

この持ち出しを防ぐ RFC 9449 の対策として最も適切なものはどれですか？

- **A.** iat の時間窓をさらに短くすれば、将来の時刻で作った proof は使えなくなる
- **B.** サーバーが予測できない nonce を、自分の決めた時点で新しく提供する
- **C.** htu に端末の IP アドレスを含めさせ、proof をその端末に結び付ける
- **D.** 抽出できない鍵を使っているので、この持ち出しに対して追加の対策は要らない
- **E.** jti の重複を検出しているので、持ち出した proof はすべて拒否される

<details>
<summary>解答・解説</summary>

**正解：B**

§11.2 は、正規の利用者自身も proof を事前生成して持ち出す攻撃者になり得ると述べています。このとき証明されるのは鍵の所持ではなく proof の所持です。サーバーが予測できない nonce を新しく提供すれば、proof の寿命を制限できます。D：持ち出すのは鍵ではなく作成済みの proof です。E：事前生成した proof はそれぞれ一意な jti を持ち、1 回ずつ使えば重複になりません。A：攻撃者は使う予定の時刻を iat に入れるので、提示する時点では時間窓に収まります。C：htu は要求先の URI で、端末を表しません。なお ath により、proof を使える期間はアクセストークンの寿命に制限されます。

**出典：** [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358)

</details>

### 1-16. code_verifier も漏れた場合

ユースケース設計 / 選択式 / 1 点

SPA の XSS により、攻撃者が認可コードと PKCE の code_verifier を、SPA が引き換える前に取得しました。AS は複製されたサーバー群で動いており、認可コードの単回使用を厳密には保証できない時間があります。SPA の DPoP 鍵は抽出できません。

攻撃者が、自分の鍵に結び付いたトークンをこのコードで取得することを防ぐのはどれですか？

- **A.** トークン要求の proof の htu。攻撃者の端末から送ると、htu が正規の値と変わるため
- **B.** 認可コードの単回使用。複製された AS でも、最初の 1 回の引き換えだけが必ず成功するため
- **C.** 認可要求の dpop_jkt。トークン要求の proof の鍵が SPA の鍵でなければ、AS が拒否するため
- **D.** PKCE。トークン要求の code_verifier が code_challenge と一致しなければ引き換えられないため
- **E.** 認可要求の state。攻撃者が送るトークン要求には、正しい state が含まれないため

<details>
<summary>解答・解説</summary>

**正解：C**

§11.9 は、AS が単回使用を厳密に保証できず、攻撃者が認可コード（PKCE を使う場合は code_verifier も）を入手できる場合、攻撃者が自分の鍵に結び付けたトークンを得る偽のトークン要求を作れると述べ、dpop_jkt がこれを防ぐとしています。§10 で AS は、proof の鍵の thumbprint が dpop_jkt と一致しなければ拒否します（MUST）。D：code_verifier も盗まれています。E：state はリダイレクトを受けたクライアントが確認する値で、トークン要求の検証には使いません。B：§11.9 は、複製の遅延で単回使用を守れない時間があると述べています。A：htu はトークンエンドポイントの URI で、どこから送っても同じです。

**出典：** [§11.9: 認可コードの盗難・再利用と dpop_jkt](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1482-L1514) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

### 1-17. nonce について規定されていること

知識 / 選択式 / 1 点

DPoP の nonce について、RFC 9449 自体が規定しているものはどれですか？

- **A.** 有効期間を 5 分以内にすること
- **B.** 値が予測できないこと（MUST）と、構文が 1*NQCHAR であること
- **C.** 成功応答のたびに新しい値を提供すること
- **D.** 値を JWT として生成し、クライアントが署名を検証できるようにすること
- **E.** 発行した時刻を、クライアントが解析できる形式で含めること

<details>
<summary>解答・解説</summary>

**正解：B**

§8 の「Nonce values MUST be unpredictable」と、§8.1 の「nonce = 1*NQCHAR」が規定です。新しい nonce を提供する時期や判断の仕方はサーバーに任され、この文書の範囲外です（§8・§8.2）。nonce はクライアントにとって opaque です（§8）。§11.1 はサーバーの時刻を nonce に含める方法に触れていますが、クライアントが解析するためのものではありません。例の値がピリオドを含んでいても、JWT である必要はありません。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§8.1: nonce = 1*NQCHAR](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1161-L1168) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358)

</details>

### 1-18. dpop_jkt と nonce を使うコードフロー

フロー構築 / 並べ替え / 2 点

認可コードを DPoP 鍵 K に結び付け、AS が最初のトークン要求で nonce を要求する場合の流れを並べてください。他の検証はすべて成功します。

- **A.** AS が 400 の use_dpop_nonce と DPoP-Nonce: N を返す
- **B.** クライアントが K で署名した nonce なしの proof を付けて、トークン要求を送る
- **C.** クライアントが K の公開鍵の JWK SHA-256 Thumbprint を計算する
- **D.** 認可要求に dpop_jkt として thumbprint を含める
- **E.** クライアントが nonce=N と新しい jti を含む proof を作り、トークン要求を再送する
- **F.** AS が認可コードを発行し、dpop_jkt の値と関連付けて保存する
- **G.** AS が proof の鍵の thumbprint と dpop_jkt の一致を確かめ、token_type=DPoP で発行する

<details>
<summary>解答・解説</summary>

**正解：C → D → F → B → A → E → G**

§10 の dpop_jkt は認可要求のパラメーターで、トークン要求を受けた AS が proof の鍵の thumbprint と比較します。§8 で nonce を要求する AS は、400 の use_dpop_nonce と DPoP-Nonce を返し、クライアントは nonce を含む proof で再試行します。再試行の proof にも新しい jti を使います（§4・§4.2）。発行はすべての検証に成功した後です。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 1-19. 設計書の要件レベルの監査

ユースケース設計 / 記述式 / 6 点

社内の DPoP 設計書に次の 6 つの記述があります。  
(1) RS は htu を正規化せずに比較しなければならない。  
(2) RFC 9449 が求めているので、AS は DPoP を使うすべてのクライアントに dpop_jkt を必須にする。  
(3) public client の refresh token を DPoP 鍵に結び付けるかどうかは任意である。  
(4) RS は、nonce を提供したクライアントから nonce のない proof を受け取っても、jti が新しければ受理してよい。  
(5) jti を記録できない構成では、proof の受理期間を無制限にしてよい。  
(6) token_type が DPoP 以外のとき、クライアントは常に応答を破棄しなければならない。

各記述の誤りを、RFC 9449 の要件の強さ（MUST・SHOULD・MAY・OPTIONAL など）と条件に基づいて指摘し、正しい記述に直してください。

番号ごとに 1〜2 行で構いません。正しい要件の強さと、要件が発生する条件を書いてください。

<details>
<summary>解答・解説</summary>

**解答例**

(1) 誤り。htu は query と fragment を除いて照合し、比較の前に RFC 3986 の構文ベース・スキームベースの正規化を行うことが SHOULD。(2) 誤り。dpop_jkt の使用は OPTIONAL で、RFC 9449 はすべてのクライアントへの必須化を求めていない。PAR と DPoP の両方に対応する AS は両方式をサポートしなければならず（MUST）、dpop_jkt が使われたときは proof の鍵と一致しなければ拒否する（MUST）。(3) 誤り。DPoP に対応する AS が、有効な proof を示した public client に refresh token を発行するなら、鍵への結び付けは MUST、使うたびの検証も MUST。(4) 誤り。nonce を提供した後は、nonce のない proof を受理してはならない（MUST NOT）。jti が新しいことは代わりにならない。(5) 誤り。生成後の限られた時間だけ受理することが MUST。jti の記録は「can」で、厳格に行えない構成があるとされているだけ。(6) 誤り。破棄が MUST になるのは、DPoP の保護をアプリの安全性に重要と判断する場合。それ以外は通常の OAuth として続けられる。

**採点基準（各 1 点）**

- (1) 正規化しない比較を MUST とする点を誤りとし、構文ベース・スキームベースの正規化を SHOULD で行うと直す。
- (2) dpop_jkt の使用は OPTIONAL で、すべてのクライアントへの必須化は RFC の要求ではないと直す（PAR での両方式のサポートや、不一致時の拒否の MUST に触れてもよい）。
- (3) 有効な proof を示した public client への refresh token の結び付けと、使用時の検証が MUST だと直す。
- (4) nonce を提供した後に nonce のない proof を受理してはならない（MUST NOT）と直し、jti では代替できないと示す。
- (5) proof を生成後の限られた時間だけ受理するのは MUST で、jti を記録できない構成でも無制限にできないと直す。
- (6) 破棄は、DPoP の保護を重要と判断した場合の条件付き MUST だと直す。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§11.3: nonce 提供後の nonce なし proof の受理禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1393-L1396) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358)

</details>

### 1-20. Bearer の challenge だけを返す RS

知識 / 選択式 / 1 点

DPoP-bound のアクセストークンを持つクライアントが、ある RS から 401 と WWW-Authenticate: Bearer realm="api" だけを受け取りました。DPoP の challenge はありません。

RFC 9449 の記述と一致する説明はどれですか？

- **A.** Authorization: Bearer と Authorization: DPoP の両方を付ける。どちらに対応する RS でも受理される
- **B.** DPoP-bound のトークンを Bearer で送ることは常に禁止されている。この RS は使えない
- **C.** AS から Bearer のトークンを改めて取得する。DPoP-bound のトークンのままでは送れない
- **D.** この RS は DPoP を知らないと考えられ、Bearer で送れる。ただし、この RS では DPoP の保護は働かない
- **E.** Bearer で送る場合も DPoP ヘッダーを付ける。そうすれば、この RS も所持の証明を検証する

<details>
<summary>解答・解説</summary>

**正解：D**

§7.2 は、RFC 6750 だけに対応し DPoP を知らない RS は DPoP-bound トークンを Bearer として受理すると考えられ、クライアントは WWW-Authenticate: Bearer の challenge を受けたら Bearer 方式で送れると述べています。段階的な移行のための互換性です。一方、Bearer と DPoP の両方に対応する RS は、Bearer として届いた DPoP-bound トークンを拒否しなければなりません（MUST）。DPoP を知らない RS は proof を検証しないので、その RS に対しては送信者制約が働きません。A：Authorization の値は 1 つの資格情報で（RFC 9110 §11.6.2）、カンマ区切りのリストを認めないフィールドの行を複数送ってはなりません（MUST NOT、§5.3）。Figure 19 は、両方式に対応する RS がそのような要求を 400 の invalid_request で拒否する例です。E：DPoP を知らない RS は DPoP ヘッダーを検証しません。

**出典：** [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [§7.2: 複数 challenge と 2 方式同時使用の 400 の例](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1023-L1057) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [RFC 9110 §11.6.2: Authorization ヘッダー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L5062-L5081) / [RFC 9110 §5.3: 同名のフィールド行の結合](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L1515-L1545)

</details>

<a id="part-2"></a>

## 第 2 部：JOSE の土台 — JWS・JWK・JWA・JWT と proof

20 問・32 点。proof は JWS で署名した JWT です。署名入力、base64url、ES256 の署名形式、JWK のメンバー、typ と crit の処理など、ライブラリ任せにすると見落とす規則を確かめます。

### 2-01. 署名の入力

単語の意味 / 選択式 / 1 点

**用語：JWS Signing Input（DPoP proof の署名対象）**

JWS Compact Serialization の DPoP proof で、秘密鍵による署名の入力になるのはどれですか？

- **A.** ASCII(BASE64URL(UTF8(JOSE ヘッダー)) || "." || BASE64URL(ペイロード) || ".")
- **B.** UTF8(JOSE ヘッダーの JSON) || "." || UTF8(ペイロードの JSON)
- **C.** ASCII(BASE64URL(UTF8(JOSE ヘッダー)) || "." || BASE64URL(ペイロード))
- **D.** SHA-256(UTF8(JOSE ヘッダー) || UTF8(ペイロード)) を base64url にした文字列
- **E.** ASCII(BASE64(UTF8(JOSE ヘッダー)) || "." || BASE64(ペイロード))（パディングあり）

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 7515 §2 の JWS Signing Input は「ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))」です。署名するのは JSON そのものではなく、base64url にした 2 つの部分をピリオドでつないだ ASCII 文字列です。B は JSON を直接つないでいます。A は末尾のピリオドが余分です。署名値の前のピリオドは署名入力に含まれません。E：base64 は「+」「/」とパディングを使うので、それらが現れる場合は base64url（「-」「_」、パディングなし）と別のバイト列になります。JWS の定義は BASE64URL です。D：ハッシュはアルゴリズム（ES256 なら SHA-256）の内部で計算するもので、アプリケーションがハッシュを署名入力にするわけではありません。

**出典：** [RFC 7515 §2: base64url（パディングなし）と JWS Signing Input](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L287-L299) / [RFC 7515 §3.1: JWS Compact Serialization の 3 つの部分](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L376-L390) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-02. パディングと token68

誤り発見・原因特定 / 選択式 / 1 点

クライアントのライブラリが、JWT の各部分をパディング付きで出力していました。DPoP ヘッダーは「DPoP: eyJ0eXAi…fQ==.eyJqdGki…fQ==.Mr4n…A==」のようになり、RS の JWT パーサーが拒否します。開発者は「RFC 9449 の token68 は「=」を許すので、RS は受理すべきだ」と主張しています。

この主張の評価として正しいものはどれですか？

- **A.** RFC 9449 は寛容な復号を勧めている（SHOULD）。RS は「=」を取り除いて受理すべきである
- **B.** 「=」は問題ではない。拒否の原因は、token68 で「.」を使えないことにある
- **C.** RFC 7515 では base64url の末尾のパディングは付けても付けなくてもよい。RS はどちらの形も受理しなければならない
- **D.** token68 の ABNF は「=」を値のどこにでも置けると定めている。したがって RS は受理しなければならない
- **E.** token68 の「=」は末尾だけで、JWS の各部分もパディングなしの base64url なので、主張は誤り

<details>
<summary>解答・解説</summary>

**正解：E**

§4.1 の DPoP ヘッダーは token68 の構文で、「1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="」のとおり「=」は末尾にだけ置けます。中身の JWT は JWS Compact Serialization で、RFC 7515 §2 の base64url は末尾の「=」を省きます（任意ではありません）。RFC 7515 §5.2 の検証は、改行・空白・その他の文字を使っていないことを前提に復号します。D・C：途中の「=」は token68 にも base64url にも合いません。A：RFC 9449 にそのような規定はありません。B：「.」は token68 で使える文字で、JWT の区切りです。

**出典：** [§4.1: DPoP HTTP ヘッダーの構文と大文字・小文字](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L359-L391) / [RFC 7515 §2: base64url（パディングなし）と JWS Signing Input](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L287-L299) / [RFC 7515 §5.2: JWS の検証手順と受け入れる alg の判断](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L847-L943)

</details>

### 2-03. ES256 の署名形式

誤り発見・原因特定 / 選択式 / 1 点

Node.js の crypto.sign("sha256", 署名入力, P-256 の秘密鍵) で ES256 の proof を作ったところ、署名が 70 バイト前後の DER 形式になり、RS の JOSE ライブラリが署名を拒否しました。

原因と直し方として正しいものはどれですか？

- **A.** ES256 のハッシュは SHA-512 である。crypto.sign の第 1 引数を "sha512" に変えて署名し直す
- **B.** R と S の先頭の 0x00 を取り除いて連結する。合計の長さは 62〜64 バイトで変わってよい
- **C.** 署名を base64url ではなく base64 で符号化する。そうすれば DER のままでも検証できる
- **D.** ES256 の署名は、R と S を 32 バイトずつ連結した 64 バイトである。DER を R||S に変換する
- **E.** DER のままでよい。RS が alg を ES256K として扱えば、同じ署名を検証できる

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 7518 §3.4 は、ES256 の署名を「R と S をそれぞれ 32 オクテットのビッグエンディアンにし、R、S の順に連結した 64 オクテット」と定めます。「MUST NOT be shortened to omit any leading zero octets」なので B は誤りで、検証側は 64 オクテットでなければ失敗とします。DER（ASN.1 の SEQUENCE）は別の表現で、多くのライブラリは IEEE P1363 形式（R||S）で出力するオプションを持ちます。A：ES256 は P-256 と SHA-256 です。E：ES256K は別の曲線のアルゴリズムです。C：符号化を変えても署名の形式は変わりません。

**出典：** [RFC 7518 §3.4: ECDSA 署名は R と S を固定長で連結した値](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L455-L539) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-04. P-256 の jwk に必要なメンバー

知識 / 選択式 / 1 点

ES256 の proof の jwk に入れる P-256 公開鍵について、必須のメンバーの組み合わせはどれですか？

- **A.** kty・crv・x・y（use・kid・alg などは任意）
- **B.** kty・crv・x・y・kid（kid で鍵を識別するため必須）
- **C.** kty・crv・x（P-256 では y を省略できる）
- **D.** kty・x・y（crv は alg の ES256 から決まるので不要）
- **E.** kty・crv・x・y・d（署名の検証に d が必要）

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 7518 §6.2.1 は EC 公開鍵に crv と x を必須とし、P-256・P-384・P-521 では y も必須です。kty は RFC 7517 §4.1 で必須です。C：この 3 つの曲線では y を省略できず、SEC1 の点圧縮もサポートされません。D：crv は必須で、alg から推測しません。B：kid は任意です。DPoP では鍵を jwk そのもので示し、結び付けは JWK Thumbprint で照合します。E：d は秘密鍵で、RFC 9449 §4.2 は jwk に秘密鍵を含めることを禁じています（MUST NOT）。

**出典：** [RFC 7518 §6.2.1: EC 公開鍵の crv・x・y と座標の長さ](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L1543-L1603) / [RFC 7517 §4.1: kty（大文字・小文字を区別、必須）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7517.txt#L287-L303) / [RFC 7518 §6.2.2: EC 秘密鍵の d](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L1605-L1618) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-05. kid で鍵を選ぶ実装

誤り発見・原因特定 / 選択式 / 1 点

RS の実装が、proof の JOSE ヘッダーの kid でクライアントの登録済み JWK Set から公開鍵を選び、その鍵で署名を検証しています。jwk ヘッダーパラメーターは読んでいません。

RFC 9449 に照らして正しい指摘はどれですか？

- **A.** kid は DPoP proof に含めてはならないヘッダーである。kid を含む proof は、それだけで拒否しなければならない
- **B.** 署名は jwk の公開鍵で検証し、その鍵の Thumbprint を結び付けと照合する。kid は無視してよい
- **C.** kid と jwk の両方がある場合は kid を優先する。RFC 7515 がそう定めている
- **D.** 登録済みの鍵で検証できたなら問題ない。jwk と異なる鍵でも RFC 9449 に適合する
- **E.** kid の値が cnf.jkt と一致すれば、その鍵との結び付けを確認できる。jwk は読まなくてよい

<details>
<summary>解答・解説</summary>

**正解：B**

§4.3 の 6 番目は「The JWT signature verifies with the public key contained in the jwk JOSE Header Parameter」です。§4.2 は jwk を必須ヘッダーにしています（RFC 7515 §4.1.3 では任意）。結び付けは jwk の JWK Thumbprint を cnf.jkt などと照合して確かめます（§6）。A：§4.2 は他のヘッダーパラメーターを含めることを許しています（MAY）。E：kid は鍵のヒントで、値の構造は規定されていません（RFC 7515 §4.1.4）。kid を thumbprint と比べても、その鍵で署名されたことは示せません。D：§4.3 の 6 番目の検証を満たしません。C：そのような優先順位の規定はありません。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [RFC 7515 §4.1.3: jwk ヘッダーパラメーター（JWS では任意）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L572-L577) / [RFC 7515 §4.1.4: kid（鍵のヒント）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L579-L588) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719)

</details>

### 2-06. typ を処理するのは誰か

知識 / 選択式 / 1 点

JWS の typ ヘッダーパラメーターについて、RFC 7515 の記述と一致するものはどれですか？

- **A.** typ は JWS のライブラリでは無視され、アプリケーションが処理する。署名の検証とは別に確かめる
- **B.** Compact Serialization では typ は署名の保護対象に入らない。そのため途中で改ざんされ得る
- **C.** JWS のライブラリが typ を処理する。署名を検証する前に、ライブラリが typ を必ず確認しなければならない
- **D.** 「application/」は省略してはならない。"application/dpop+jwt" と書くことが推奨される
- **E.** typ の値は alg と同じ規則で比べる。大文字・小文字を区別しなければならない

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 7515 §4.1.9 は「This parameter is ignored by JWS implementations; any processing of this parameter is performed by the JWS application」と述べています。RFC 9449 §4.3 の 4 番目と §11.5 の typ の確認は、DPoP の検証処理（アプリケーション）が行う必要があります。E：§5.3 は typ と cty を通常の文字列比較の例外とし、§4.1.9 のとおりメディアタイプの値は大文字・小文字を区別しません。D：「application/」は省略することが推奨（RECOMMENDED）され、RFC 9449 も typ の値を dpop+jwt としています。B：Compact Serialization では JOSE ヘッダー全体が保護ヘッダーです（§3.1）。

**出典：** [RFC 7515 §4.1.9: typ はアプリケーションが処理し、application/ を省略できる](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L655-L694) / [RFC 7515 §5.3: 文字列比較の規則（typ・cty は例外）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L945-L987) / [RFC 7515 §3.1: JWS Compact Serialization の 3 つの部分](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L376-L390) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.5: typ による別用途 JWT の受理防止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1435-L1439)

</details>

### 2-07. 明示的な型付けが守る範囲

知識 / 選択式 / 1 点

RFC 8725 §3.11 の明示的な型付けと、RFC 9449 の typ=dpop+jwt の確認について正しいものはどれですか？

- **A.** 明示的な型付けでは、完全なメディアタイプが必要である。typ には「application/」を付けて書く
- **B.** typ は署名で保護される。typ=dpop+jwt の proof は、DPoP 以外のどの種類の JWT の検証処理でも受理されなくなる
- **C.** typ の確認で、別用途の JWT を proof として受理することは防げる。typ を見ない別の検証処理は守れない
- **D.** 署名を jwk の公開鍵で検証できれば、別用途の JWT は混ざらない。typ の確認は省略できる
- **E.** typ の確認が必要なのは、サーバーが nonce を提供して proof の寿命を制限している場合だけである

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 8725 §3.11 は「the use of explicit typing may not achieve disambiguation from existing kinds of JWTs, as the validation rules for existing kinds of JWTs often do not use the "typ" Header Parameter value」と注意しています。型付けは、型を確認する側を守る仕組みです。別の種類の JWT の検証では、§3.12 のように必須クレームなどを相互排他的にして取り違えを防ぎます。D：RFC 9449 §11.5 は、proof を受け付けるサーバーが typ を確認することを MUST としています。A：「application/」は省略が推奨されます。E：typ の確認に条件はありません。

**出典：** [RFC 8725 §3.11: 明示的な型付けとその限界](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L440-L469) / [RFC 8725 §3.12: 種類ごとに相互排他的な検証規則](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L471-L512) / [§11.5: typ による別用途 JWT の受理防止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1435-L1439) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 2-08. ミリ秒の iat

誤り発見・原因特定 / 選択式 / 1 点

ブラウザーの SPA が、proof の iat に Date.now() の値（例：1794528000000）を入れていました。RS は iat が現在時刻の前後 60 秒以内かを確かめており、proof を未来の時刻として拒否します。

正しい修正はどれですか？

- **A.** iat を文字列の "1794528000" にする。そうすれば RS は数値として比較しないので受理される
- **B.** nonce を使えば iat は不要になる。RS に nonce を要求させて、iat を proof から削除する
- **C.** iat を ISO 8601 形式の文字列（例："2026-11-13T00:00:00Z"）にして、単位の誤解をなくす
- **D.** iat は秒単位の NumericDate である。Math.floor(Date.now() / 1000) などの秒の値にする
- **E.** NumericDate は小数も表せるので、ミリ秒の値でも仕様上は正しい。RS が 1000 で割るべきである

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 7519 §2 の NumericDate は「the number of seconds from 1970-01-01T00:00:00Z UTC」で、§4.1.6 の iat は NumericDate の数値でなければなりません（MUST）。小数を含む値も表せますが、単位は秒です。E：ミリ秒の値は 1000 倍も先の時刻を表すので、仕様上も誤りです。C・A：iat は数値です。B：RFC 9449 §4.2 で iat は必須クレームです。§4.3 は生成時刻を nonce に入れたサーバーの時刻で判断することも認めていますが、iat を省略してよいわけではありません。

**出典：** [RFC 7519 §2: NumericDate は秒単位](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7519.txt#L287-L295) / [RFC 7519 §4.1.6〜4.1.7: iat と jti（大文字・小文字を区別）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7519.txt#L525-L541) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 2-09. 重複したヘッダーパラメーター

誤り発見・原因特定 / 選択式 / 1 点

proof の JOSE ヘッダーを base64url で復号すると、{"typ":"dpop+jwt","alg":"ES256","jwk":{…},"alg":"none"} でした。

RFC 7515 に沿う扱いはどれですか？

- **A.** 重複はヘッダーの書式の問題にすぎない。ES256 で署名を検証できれば受理する
- **B.** DPoP では jwk の鍵の種類から署名方式が決まる。alg は読まずに、鍵の種類に合う方式で検証してよい
- **C.** 両方の alg の値で、署名をそれぞれ検証する。どちらかが成功すれば受理する
- **D.** 最初に現れた値（ES256）を採用する。その後の alg は無視し、jwk の公開鍵で ES256 の署名を検証して判断する
- **E.** 重複のある JWS として拒否する。最後の値を採るパーサーでも alg=none となり、拒否する

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 7515 §4 は、ヘッダーパラメーター名は一意でなければならず、パーサーは重複のある JWS を拒否するか、ECMAScript 5.1 のように最後の重複だけを返すパーサーを使わなければならないとしています（§10.12 も参照）。最後の値は alg=none なので、RFC 9449 §4.3 の 5 番目で拒否します。D：最初の値を採用する処理は認められていません。パーサーによって解釈が分かれる曖昧さは攻撃に使われます。C：alg は 1 つです。B：RFC 7515 §5.2 は alg が示すアルゴリズムで検証することを求め、RFC 8725 §3.1 も alg と実際の処理の一致を確かめるよう求めています。A：重複の扱いは署名の検証より前の構文の問題で、受理の理由になりません。

**出典：** [RFC 7515 §4: ヘッダーパラメーター名の一意性と未知パラメーターの扱い](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L488-L518) / [RFC 7515 §10.12: 厳格な JSON 解析と重複メンバー・余分な文字](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L1692-L1724) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 8725 §3.1: ライブラリは許可する alg を呼び出し側が指定できるようにする](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L285-L293) / [RFC 7515 §5.2: JWS の検証手順と受け入れる alg の判断](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L847-L943)

</details>

### 2-10. 理解できない crit

知識 / 選択式 / 1 点

proof の JOSE ヘッダーに "crit":["ext"] と "ext":"v1" が含まれています。RS は ext という拡張を実装していません。

RS の扱いとして正しいものはどれですか？

- **A.** ext と crit をヘッダーから取り除いてから、署名を検証する
- **B.** crit に挙げられた拡張を理解できないので、この JWS を無効として拒否する
- **C.** crit は JWE だけで使うパラメーターなので、無視して検証を続ける
- **D.** 理解できないヘッダーパラメーターは無視しなければならないので、ext を無視して受理する
- **E.** RFC 9449 §4.2 が他のヘッダーパラメーターを MAY で認めているので、受理しなければならない

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 7515 §4.1.11 は「If any of the listed extension Header Parameters are not understood and supported by the recipient, then the JWS is invalid」と定めます。理解できないヘッダーパラメーターを無視する原則（§4）は、crit に挙げられていない場合に限ります。E：RFC 9449 が他のパラメーターを許すことは、JWS の処理規則を変えません。C：crit は JWS の登録済みヘッダーパラメーターです。A：ヘッダーを書き換えると署名入力が変わり、検証できなくなります。

**出典：** [RFC 7515 §4.1.11: crit に挙げた拡張を理解できなければ無効](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L735-L761) / [RFC 7515 §4: ヘッダーパラメーター名の一意性と未知パラメーターの扱い](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L488-L518) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-11. HS256 を受理する危険

比較・使い分け / 選択式 / 1 点

DPoP で HS256（HMAC）の proof を受理してしまう実装が、特に危険な理由はどれですか？

- **A.** HS256 の検証は遅い。リプレイを検出する時間窓のあいだに検証が終わらないことがある
- **B.** HS256 の署名値は base64url で表せない。DPoP ヘッダーの token68 の構文に入らない
- **C.** HS256 も SHA-256 を使うので、ath の SHA-256 と衝突する。RS が ath を正しく検証できなくなる
- **D.** 公開鍵は過去の proof から誰でも分かる。それを HMAC の鍵にすれば、秘密鍵なしで proof を作れる
- **E.** HS256 は client_secret のない public client で使えないだけである。confidential client なら安全に使える

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 9449 §4.2 は alg に MAC（共通鍵）のアルゴリズムを禁じ、§11.6 は安全な非対称署名だけを許すよう求めています。MAC は鍵を知る者なら誰でも作れ、作成者を第三者に示せません（RFC 7515 §10.5）。DPoP の jwk は公開鍵で、過去の proof を見た者にも分かります。RFC 8725 §2.1 の攻撃（RSA の公開鍵を HMAC の鍵として使わせる）と同じ形で、攻撃者は盗んだトークンに結び付いた公開鍵を使って、照合を通る proof を作れてしまいます。C・B：HS256 の値も base64url で表せ、ath とは独立です。A：HMAC の計算はむしろ速く、速さは危険の理由ではありません。E：DPoP の鍵はクライアント認証の client_secret とは関係がなく、HS256 はどのクライアントでも禁止です。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§11.6: 安全な非対称署名アルゴリズムのみの許可](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1441-L1446) / [RFC 7515 §10.5: デジタル署名と MAC の違い](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L1553-L1582) / [RFC 8725 §2.1: alg の書き換え（none、RS256→HS256）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L163-L179)

</details>

### 2-12. Ed25519 の jwk と Thumbprint

知識 / 選択式 / 1 点

Ed25519 の公開鍵を DPoP の jwk に入れ、その JWK Thumbprint を計算します。正しいものはどれですか？

- **A.** kty は "OKP"、crv は "Ed25519" で、公開鍵は x に入れる。Thumbprint の入力は crv・kty・x の 3 つ
- **B.** kty は "EC"、crv は "Ed25519" で、x と y を入れる。Thumbprint の入力は crv・kty・x・y の 4 つ
- **C.** kty は "OKP"、crv は "Ed25519" で、x と y を入れる。Thumbprint の入力は crv・kty・x・y の 4 つ
- **D.** kty は "OKP"、crv は "Ed25519" で、d と x を入れる。Thumbprint の入力は crv・d・kty・x の 4 つ
- **E.** kty は "OKP"、crv は "Ed25519" で、x を入れる。Thumbprint の入力は kty・x の 2 つ

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 8037 §2 は鍵の種類 OKP（Octet Key Pair）を定義し、crv と x を必須、d を秘密鍵の場合だけのメンバーとしています。y はありません。Thumbprint の入力は「"crv", "kty", and "x"」の辞書順で、付録 A.3 に例があります。B：Ed25519 の鍵は kty=EC ではありません。C：OKP に y はありません。E：crv も必須メンバーなので入力に含めます。D：d は秘密鍵で、DPoP の jwk に含めてはならず（RFC 9449 §4.2）、Thumbprint の入力にもなりません。

**出典：** [RFC 8037 §2: OKP 鍵の kty・crv・x・d と Thumbprint のメンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8037.txt#L134-L159) / [RFC 8037 付録 A.3: Ed25519 公開鍵の Thumbprint の入力と値](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8037.txt#L484-L495) / [RFC 7638 §3.2: 鍵の種類ごとの必須メンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L287-L315) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-13. 短い RSA 鍵の proof

知識 / 選択式 / 1 点

クライアントが 1024 ビットの RSA 鍵で、alg=PS256 の proof を送ってきました。署名自体は検証できます。RS の許可リストには PS256 が含まれています。

RS の判断として正しいものはどれですか？

- **A.** 鍵長が足りない場合は use_dpop_nonce を返し、別の鍵での再試行をクライアントに求める
- **B.** 2048 ビット以上という制限は RS256 だけにあり、PS256 にはないので、そのまま受理する
- **C.** RFC 9449 は鍵長を規定していないので、署名が検証できれば RS は受理しなければならない
- **D.** 1024 ビットでも、jti と nonce を検証していれば同等の安全性になるので受理する
- **E.** PS256 には 2048 ビット以上の鍵が必要（RFC 7518）なので、ローカルポリシーで受け入れない

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 7518 §3.5 は RSASSA-PSS に「A key of size 2048 bits or larger MUST be used」と定め、§3.3 の RS256 なども同じです（B は誤り）。RFC 9449 §4.3 の 5 番目は、alg が「acceptable per local policy」であることも求め、§11.6 は安全と判断できる非対称署名だけを許すよう求めています。RFC 7515 §5.2 も、検証できてもアルゴリズムを受け入れられない場合は無効とすべき（SHOULD）としています。D：jti や nonce は鍵の強度を補いません。A：use_dpop_nonce は nonce を要求するためのエラーです。

**出典：** [RFC 7518 §3.5: RSASSA-PSS と鍵長](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L541-L551) / [RFC 7518 §3.3: RSASSA-PKCS1-v1_5 は 2048 ビット以上の鍵](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L407-L413) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.6: 安全な非対称署名アルゴリズムのみの許可](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1441-L1446) / [RFC 7515 §5.2: JWS の検証手順と受け入れる alg の判断](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L847-L943)

</details>

### 2-14. jwk の代わりの jku

誤り発見・原因特定 / 選択式 / 1 点

汎用の JWT 検証ライブラリは、ヘッダーに jwk がなく jku（JWK Set の URL）がある場合、その URL から鍵を取得して検証します。RS はこのライブラリで proof を検証しています。

jwk がなく jku だけを含む proof の扱いとして正しいものはどれですか？

- **A.** jku の URL が HTTPS なら安全に取得できる。DPoP の要件も満たすので受理する
- **B.** jwk は proof に必須なので拒否する。jku の URL を自動で取得すること自体にも危険がある
- **C.** jku は AS のメタデータの jwks_uri と同じ役割である。AS の鍵で署名を検証する
- **D.** jku から取得した鍵の Thumbprint が cnf.jkt と一致すれば、jwk の代わりとして受理する
- **E.** RFC 7515 では jwk も jku も任意である。jku から鍵を取得できれば受理する

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 9449 §4.2 は JOSE ヘッダーに typ・alg・jwk を必須とし、§4.3 は jwk の公開鍵で署名を検証することを求めます。RFC 7515 では jwk も jku も任意ですが（§4.1.2・§4.1.3）、DPoP（RFC 9449 §4.2）は jwk を必須にしており、jku で鍵を示す proof は認めていません。RFC 8725 §3.10 は、jku や x5u の任意の URL を盲目的に取得すると SSRF（サーバー側リクエストフォージェリ）につながると注意しています。D：一致を確かめる前に、攻撃者が指定した URL へ RS がアクセスしてしまいます。C：jwks_uri は AS の署名鍵で、proof の鍵ではありません。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 7515 §4.1.2: jku（JWK Set URL）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L551-L570) / [RFC 7515 §4.1.3: jwk ヘッダーパラメーター（JWS では任意）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L572-L577) / [RFC 8725 §3.10: kid・jku・x5u を信用しない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L426-L438)

</details>

### 2-15. JSON の後の余分な文字

誤り発見・原因特定 / 選択式 / 1 点

proof の JOSE ヘッダーを復号すると、{"typ":"dpop+jwt","alg":"ES256","jwk":{…}}xyz のように、正しい JSON オブジェクトの後に余分な文字が続いていました。RS の JSON パーサーは先頭の JSON だけを読み、エラーにしません。

RFC 7515 に沿う扱いはどれですか？

- **A.** 余分な文字を取り除いてから base64url に戻し、署名を検証し直す
- **B.** JSON オブジェクトとして読める部分があるので、余分な文字を無視して検証を続ける
- **C.** 余分な文字を含む入力の JWS は、無効として拒否する
- **D.** 署名入力には元の文字列を使うので、署名が検証できれば受理してよい
- **E.** 余分な文字が base64url の文字だけなら受理する

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 7515 §10.12 は厳格な JSON の検証をセキュリティ上の要件とし、「{"tag":"value"}ABCD」のように正しい JSON の後に余分な文字が続く入力について「Implementations MUST consider JWSs containing such input to be invalid」と定めています。§5.2 の 3 番目も、復号した結果が完全に正しい JSON オブジェクトであることを確かめる手順です。D：署名が検証できても、送信側と検証側で JSON の解釈が食い違う余地が残ります。A：署名入力を作り直すと、元の署名とは一致しません。

**出典：** [RFC 7515 §10.12: 厳格な JSON 解析と重複メンバー・余分な文字](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L1692-L1724) / [RFC 7515 §5.2: JWS の検証手順と受け入れる alg の判断](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L847-L943)

</details>

### 2-16. 乱数の弱い機器での ES256

知識 / 選択式 / 1 点

組み込み機器のクライアントが、品質の低い乱数生成器のまま、同じ P-256 鍵で ES256 の proof を毎日数千件作っています。

この構成の危険と対策として、RFC 8725 の記述に沿うものはどれですか？

- **A.** 決定的 ECDSA は検証側の対応が必要である。RS に新しい alg 値を登録してもらってから使う必要がある
- **B.** ECDSA の署名は毎回同じ値になり、RS がリプレイと区別できない。HS256 に変える
- **C.** 危険なのは jti の乱数だけである。jti を UUID v4 にすれば、ECDSA の署名の乱数の質は問題にならない
- **D.** ECDSA は署名ごとに一意な乱数が必要で、予測できると秘密鍵が漏れ得る。決定的 ECDSA を使う
- **E.** proof の数が多いと鍵が劣化する。proof ごとに鍵を作り直す

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 8725 §3.2 は、ECDSA の署名は「require a unique random value for every message that is signed」とし、乱数が予測できると最悪の場合は秘密鍵が復元され得るため、ライブラリは RFC 6979 の決定的な方式で ECDSA を実装すべき（SHOULD）としています。決定的 ECDSA は既存の検証側と完全に互換で、新しいアルゴリズム識別子は不要です（A は誤り）。C：jti の一意性と署名の乱数は別の問題です。B：通常の ECDSA は署名ごとに乱数を使うので値は毎回変わり、決定的 ECDSA でも jti・iat が違えば署名は変わります。リプレイは jti で検出します（RFC 9449 §4.2）。また MAC は §4.2 で禁止されています。E：DPoP のトークンは鍵に結び付くので、proof ごとに鍵を替えるとトークンを使えなくなります。

**出典：** [RFC 8725 §3.2: 適切なアルゴリズムと決定的 ECDSA](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L295-L338) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719)

</details>

### 2-17. 座標の長さと Thumbprint

誤り発見・原因特定 / 選択式 / 1 点

クライアントは、鍵ストアから取り出した JWK（x は 43 文字）で dpop_jkt を計算しています。一方、proof の jwk は別のライブラリが作っており、座標の先頭の 0x00 を取り除くため、一部の鍵では x が 42 文字（31 バイト）になります。その鍵のときだけ、トークン要求が dpop_jkt の不一致で拒否されます。

原因の説明として最も適切なものはどれですか？

- **A.** P-256 では x の先頭が 0x00 になることはない。鍵の生成そのものが壊れている
- **B.** x・y は座標の全長（32 オクテット）で表す。42 文字の表現では Thumbprint が別の値になる
- **C.** Thumbprint は kid の値から計算する。x の長さはこの不一致の原因にならない
- **D.** 42 文字は 4 の倍数ではないので、base64url として不正である。AS がパディングを補ってから計算すれば一致する
- **E.** Thumbprint は x・y を復号したバイト列から計算する。0x00 の有無は値に影響しない

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 7518 §6.2.1.2 は、x を「the full size of a coordinate for the curve」の長さで表すことを MUST としています（y も同じ）。RFC 7638 は JWK のメンバーの値（base64url の文字列）をそのまま含む JSON から Thumbprint を計算するので（§3）、同じ鍵でも表現が違えば値が変わります。クライアントは x が 43 文字の JWK から dpop_jkt を、AS は x が 42 文字の proof の jwk から Thumbprint を計算するので一致しません。§7 は、表現の正しさを検証しない実装では、同じ鍵に別の Thumbprint が生じると注意しています。D：42 文字は 4 で割った余りが 2 で、31 バイトを表す正しい base64url です（RFC 7515 付録 C）。E・C：Thumbprint は base64url の文字列を含む JSON から計算し、kid は使いません。A：座標の先頭バイトが 0 になることは起こり得ます。

**出典：** [RFC 7518 §6.2.1: EC 公開鍵の crv・x・y と座標の長さ](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L1543-L1603) / [RFC 7638 §7: 表現の検証と、Thumbprint による鍵の除外の限界](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L546-L596) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [RFC 7515 付録 C: パディングなし base64url の実装](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L3031-L3072) / [RFC 7638 §3: JWK Thumbprint の計算手順](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L130-L148)

</details>

### 2-18. proof を作る手順

フロー構築 / 並べ替え / 2 点

ブラウザーで ES256 の DPoP proof を作る手順を並べてください。鍵ペアは作成済みです。

- **A.** typ・alg・jwk を持つ JOSE ヘッダーを作る
- **B.** ヘッダーとペイロードの UTF-8 表現をそれぞれ base64url にして、ピリオドでつなぐ
- **C.** つないだ ASCII 文字列を秘密鍵で ES256 署名し、64 バイトの R||S を得る
- **D.** 公開鍵を JWK としてエクスポートし、秘密鍵のメンバーが含まれないことを確かめる
- **E.** jti・htm・htu・iat（必要なら ath・nonce）を持つペイロードを作る
- **F.** 署名を base64url にしてピリオドに続けて付け、DPoP ヘッダーの値にする

<details>
<summary>解答・解説</summary>

**正解：D → A → E → B → C → F**

次の順序も正解です：D → E → A → B → C → F、E → D → A → B → C → F

ヘッダーの jwk には公開鍵の JWK が必要なので、エクスポートはヘッダーより前です。ペイロードは鍵に依存しないので、ヘッダーの前後どちらで作っても構いません（3 通りの順序を正解とします）。署名入力は RFC 7515 §2 のとおり、base64url にしたヘッダーとペイロードをピリオドでつないだ ASCII 文字列です。ES256 の署名は RFC 7518 §3.4 の 64 バイトの R||S で、RFC 7515 §3.1 の Compact Serialization のとおり 3 つの部分をピリオドでつなぎます。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [RFC 7515 §2: base64url（パディングなし）と JWS Signing Input](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L287-L299) / [RFC 7515 §3.1: JWS Compact Serialization の 3 つの部分](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L376-L390) / [RFC 7518 §3.4: ECDSA 署名は R と S を固定長で連結した値](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L455-L539)

</details>

### 2-19. 壊れた proof の点検

誤り発見・原因特定 / 記述式 / 7 点

RS に届いた proof を復号すると、次のとおりでした。要求は GET https://api.example.com/orders?id=7 で、Authorization: DPoP T が付いています。

```text
ヘッダー:
{"typ":"JWT","alg":"ES256",
 "jwk":{"kty":"EC","crv":"P-256","x":"…","y":"…","d":"…"}}
ペイロード:
{"jti":"1","htm":"get",
 "htu":"https://api.example.com/orders?id=7",
 "iat":1731500000000,
 "ath":"fUHyO2r2+3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo="}
```

この proof の問題をすべて挙げ、それぞれ正しい値や作り方を示してください。

項目ごとに 1 行で構いません。何が誤りで、どう直すかを書いてください。

<details>
<summary>解答・解説</summary>

**解答例**

typ を "dpop+jwt" にする（"JWT" は DPoP proof として受理されない）。jwk から秘密鍵の d を取り除く。jti は同じ文脈・時間窓で他の proof と衝突しない値（96 ビット以上の擬似乱数を符号化した値や UUID v4 など）にする。htm はメソッドと同じ "GET" にする（メソッドは大文字・小文字を区別する）。htu は query を除いた "https://api.example.com/orders" にする。iat は秒単位の NumericDate（例：1731500000）にする。ath は T の ASCII 表現の SHA-256 を base64url で表す。「+」や末尾の「=」を含む base64 の表現は誤り。なお、d を送ってしまった鍵は漏えいしたとみなし、鍵ペアを作り直す（その鍵に結び付いたトークンも使わない）。

**採点基準（各 1 点）**

- typ を dpop+jwt にすると指摘する。
- jwk から秘密鍵の d を取り除き、公開鍵だけにすると指摘する。
- jti を、衝突の確率が無視できる一意な値（96 ビット以上の乱数や UUID v4 など）にすると指摘する。
- htm を GET にする（メソッドは大文字・小文字を区別する）と指摘する。
- htu から query を除き https://api.example.com/orders にすると指摘する。
- iat を秒単位の NumericDate にすると指摘する。
- ath を T の SHA-256 の base64url（「-」「_」を使いパディングなし）にすると指摘する。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§11.5: typ による別用途 JWT の受理防止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1435-L1439) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 9110 §9.1: メソッドトークンは大文字・小文字を区別](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L3728-L3758) / [RFC 7519 §2: NumericDate は秒単位](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7519.txt#L287-L295) / [RFC 7515 §2: base64url（パディングなし）と JWS Signing Input](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L287-L299)

</details>

### 2-20. ライブラリとアプリケーションの分担

ユースケース設計 / 記述式 / 6 点

RS の開発者が、汎用の JOSE ライブラリに「alg の許可リスト」と「検証に使う公開鍵」を渡して署名を検証する部分と、DPoP 固有の処理を分けて実装しようとしています。

JOSE ライブラリに任せられる処理と、DPoP の検証として RS のアプリケーションが自分で行う必要がある処理を分けて説明してください。

箇条書きで構いません。「ライブラリ」と「アプリケーション」に分けて書いてください。

<details>
<summary>解答・解説</summary>

**解答例**

ライブラリ：Compact Serialization の分解、パディングなし base64url の厳格な復号、JSON の厳格な解析（重複の拒否、または最後の値だけを返すパーサーの使用、余分な文字の拒否）、crit の処理、呼び出し側が指定した許可リストの alg と渡した公開鍵による署名の検証。アプリケーション：ライブラリに渡す許可リストを非対称署名の alg に限ること（none や MAC を入れない）。DPoP ヘッダーが 1 つで単一の JWT か、typ=dpop+jwt か（typ の確認は署名の検証に含まれない）。jwk を取り出して検証用の鍵として渡し、秘密鍵を含まないことの確認。§4.2 の必須クレーム（jti・htm・htu・iat、トークンと一緒なら ath）がそろうことと、htm、正規化した htu、iat または nonce による時間窓、nonce、jti の検証。提示されたトークンからの ath の計算と照合、jwk の JWK Thumbprint と cnf.jkt などの照合。

**採点基準（各 1 点）**

- ライブラリ：Compact Serialization の分解、base64url の厳格な復号、JSON の厳格な解析（重複・余分な文字）、crit の処理を挙げる。
- ライブラリ：呼び出し側が指定した許可リストの alg だけで、渡した公開鍵で署名を検証する（許可リストを非対称署名に限るのはアプリケーションの責任。どちらに書いても認める）。
- アプリケーション：DPoP ヘッダーが 1 つか、typ=dpop+jwt かを確認する（typ の確認は JWS の署名検証に含まれない。ライブラリのオプションで確認させる場合も、アプリケーションが指定する）。
- アプリケーション：jwk を検証に使う鍵として取り出し、秘密鍵を含まないことを確認する。
- アプリケーション：必須クレーム（jti・htm・htu・iat、トークンと一緒なら ath）がそろうことと、htm・正規化した htu・時間窓（iat または nonce）・nonce・jti を検証する。
- アプリケーション：ath を計算して照合し、jwk の JWK Thumbprint をトークンの結び付けと照合する。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 7515 §5.2: JWS の検証手順と受け入れる alg の判断](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L847-L943) / [RFC 7515 §4.1.9: typ はアプリケーションが処理し、application/ を省略できる](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L655-L694) / [RFC 8725 §3.1: ライブラリは許可する alg を呼び出し側が指定できるようにする](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L285-L293) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [RFC 7515 §10.12: 厳格な JSON 解析と重複メンバー・余分な文字](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L1692-L1724) / [RFC 7515 §4.1.11: crit に挙げた拡張を理解できなければ無効](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L735-L761) / [§11.6: 安全な非対称署名アルゴリズムのみの許可](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1441-L1446) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

<a id="part-3"></a>

## 第 3 部：鍵の結び付け — JWK Thumbprint・cnf・introspection

20 問・26 点。jkt の計算（RFC 7638）、cnf クレームの意味（RFC 7800）、introspection（RFC 7662）、JWT アクセストークン（RFC 9068）を、RS が結び付けを検証する流れに沿って確かめます。

### 3-01. Thumbprint の入力

知識 / 選択式 / 1 点

proof の jwk は {"kty":"EC","use":"sig","crv":"P-256","kid":"k1","x":"X","y":"Y","alg":"ES256"} でした（X・Y は base64url の座標）。

JWK SHA-256 Thumbprint を計算するとき、SHA-256 に入力する JSON 文字列はどれですか？

- **A.** {"kty":"EC","crv":"P-256","x":"X","y":"Y"}
- **B.** {"alg":"ES256","crv":"P-256","kid":"k1","kty":"EC","use":"sig","x":"X","y":"Y"}
- **C.** {"crv":"P-256","kid":"k1","kty":"EC","x":"X","y":"Y"}
- **D.** {"crv": "P-256", "kty": "EC", "x": "X", "y": "Y"}
- **E.** {"crv":"P-256","kty":"EC","x":"X","y":"Y"}

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 7638 §3 は、鍵を表すのに必須のメンバーだけを含め、空白や改行を入れず、メンバー名の Unicode コードポイントの辞書順に並べた JSON を UTF-8 にしてハッシュすると定めます。EC 鍵の必須メンバーは crv・kty・x・y です（§3.2）。A は元の順序のままです。B・C は任意メンバーを含めています。§3.2.2 のとおり、任意メンバーの有無で値が変わらないように入力から除きます。D は区切りの後に空白があります。RFC 9449 §6.1 の jkt は、このハッシュを base64url にした値です。

**出典：** [RFC 7638 §3: JWK Thumbprint の計算手順](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L130-L148) / [RFC 7638 §3.2: 鍵の種類ごとの必須メンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L287-L315) / [RFC 7638 §3.2.2: 任意メンバーを含めない理由](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L343-L365) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719)

</details>

### 3-02. 鍵の種類ごとの入力メンバー

知識 / 選択式 / 1 点

鍵の種類ごとに、JWK Thumbprint の入力に使うメンバーを入力での並び順で示したとき、正しい組み合わせはどれですか？

- **A.** EC：crv, kty, x, y　RSA：e, n　OKP：crv, x
- **B.** EC：crv, kty, x, y　RSA：e, kty, n　OKP：crv, kty, x
- **C.** EC：crv, kty, x, y　RSA：alg, e, kty, n　OKP：crv, kty, x
- **D.** EC：kty, crv, x, y　RSA：kty, n, e　OKP：kty, crv, x
- **E.** EC：crv, kty, x, y　RSA：e, kty, n　OKP：crv, kty, x, y

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 7638 §3.2 は、EC 公開鍵の必須メンバーを "crv"・"kty"・"x"・"y"、RSA 公開鍵の必須メンバーを "e"・"kty"・"n" と、辞書順で挙げています。OKP は RFC 8037 §2 が「"crv", "kty", and "x"」と定めています。D は JWK を書くときによく使う順序で、辞書順ではありません。E：OKP に y はありません。C：alg は任意メンバーです。A：kty も必須メンバーなので入力に含めます。

**出典：** [RFC 7638 §3.2: 鍵の種類ごとの必須メンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L287-L315) / [RFC 8037 §2: OKP 鍵の kty・crv・x・d と Thumbprint のメンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8037.txt#L134-L159) / [RFC 7638 §3.3: メンバーの順序とエスケープ・数値の表現](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L367-L408)

</details>

### 3-03. kid を変えた jwk

知識 / 選択式 / 1 点

クライアントは同じ鍵ペアを使い続けたまま、proof の jwk の kid を "a" から "b" に変え、"use":"sig" も追加しました。アクセストークンは kid を変える前に取得したものです。

RS での鍵の結び付けの照合はどうなりますか？

- **A.** 一致する。Thumbprint は必須メンバーだけから計算するので、kid や use の有無で値は変わらない
- **B.** 一致しない。kid が変わると Thumbprint も変わるので、新しい kid の鍵でトークンを取り直す必要がある
- **C.** 一致しない。use を追加すると鍵の用途が変わり、RS は同じ鍵でも別の鍵として扱わなければならない
- **D.** 一致するかは、AS が発行時に記録した kid と比べて決める。RS だけでは判断できない
- **E.** 一致しない。kid を含む JWK の Thumbprint では、識別のために kid も入力に加えるため

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 7638 §3.2.2 は、任意メンバーを入力に含めない理由を「so that their absence or presence in the JWK does not alter the resulting value」と述べ、Thumbprint は属性ではなく鍵そのものを指すとしています。RFC 9449 では、RS は proof の jwk から Thumbprint を計算して cnf.jkt などと比べるので（§6.1・§4.3）、kid や use を変えても同じ鍵なら一致します。D：RS は kid ではなく jwk から計算した Thumbprint で比べます。

**出典：** [RFC 7638 §3.2.2: 任意メンバーを含めない理由](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L343-L365) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 3-04. 秘密鍵の JWK から計算した dpop_jkt

誤り発見・原因特定 / 選択式 / 1 点

クライアントは、保存している秘密鍵の JWK（kty・crv・x・y・d を含む）から dpop_jkt を計算するとき、メンバーを辞書順にした {"crv":…,"d":…,"kty":…,"x":…,"y":…} を入力にしていました。AS はトークン要求を、dpop_jkt との不一致で拒否します。

正しい説明はどれですか？

- **A.** 秘密鍵の JWK の Thumbprint は SHA-512 で計算する決まりである。ハッシュ関数を変える
- **B.** 秘密鍵の JWK の Thumbprint は定義されていない。公開鍵だけの JWK を作り直す必要がある
- **C.** d を含めた値が正しい。AS は proof の jwk にも d を含めるよう、クライアントに求めるべきである
- **D.** 秘密鍵の JWK の Thumbprint は、公開鍵の JWK と同じ値になるよう計算する。d は入力に含めない
- **E.** d を含めるかどうかは任意である。AS と取り決めれば、d を含めた値を使ってもよい

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 7638 §3.2.1 は「The JWK Thumbprint of a JWK representing a private key is computed as the JWK Thumbprint of a JWK representing the corresponding public key」と定めます。公開鍵と秘密鍵のどちらからでも同じ値を計算できるよう、秘密鍵の場合の計算も定義しています（B は誤り）。入力は公開鍵の必須メンバーだけです。C：RFC 9449 §4.2 は jwk に秘密鍵を含めることを禁じています。A：そのような決まりはなく、dpop_jkt は SHA-256 です。E：AS は proof の公開鍵から計算するので、d を含めた値は一致しません。

**出典：** [RFC 7638 §3.2.1: 秘密鍵の Thumbprint は公開鍵と同じ](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L317-L331) / [RFC 7638 §3.2: 鍵の種類ごとの必須メンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L287-L315) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 3-05. Thumbprint の拒否リスト

比較・使い分け / 選択式 / 1 点

AS は、漏えいが判明した DPoP 鍵の JWK Thumbprint を拒否リストに登録し、トークン要求の proof の鍵の Thumbprint がリストにあれば拒否しています。

この対策の評価として正しいものはどれですか？

- **A.** Thumbprint の比較は大文字・小文字を区別しないので、表現の違う同じ鍵も同じ値として検出できる
- **B.** Thumbprint は任意メンバーを含まないので、鍵の表現を変えても同じ値になり、確実に排除できる
- **C.** 同じ鍵でも、表現の違い（e を "AAEAAQ" と書くなど）や鍵の変形で値が変わり得るので、確実には排除できない
- **D.** SHA-256 は第二原像計算困難性を持つので、拒否リストに載せた鍵の使用を、表現によらず確実に排除できる
- **E.** 拒否リストは不要で、認可要求に dpop_jkt を使わせれば、漏えいした鍵は自動的に使えなくなる

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 7638 §7 は、e を "AQAB" ではなく "AAEAAQ" と表すように表現の正しさを検証しない実装では、同じ鍵に別の Thumbprint が生じると述べています。法 N を 3N にした鍵のような変形もあり、「comparing thumbprint values is not a reliable means of excluding (blacklisting) the use of particular keys」としています。D：RFC 9449 §11.8 の第二原像計算困難性は、別の鍵で同じ Thumbprint を作れないことに関する性質で、同じ鍵から別の Thumbprint を作れないことは保証しません。B：必須メンバー自体の表現が変わり得ます。E：dpop_jkt は認可コードを鍵に結び付ける仕組みです。A：base64url は大文字・小文字を区別します。

**出典：** [RFC 7638 §7: 表現の検証と、Thumbprint による鍵の除外の限界](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L546-L596) / [§11.8: JWK の第二原像計算困難性と ath の衝突耐性](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1466-L1480) / [RFC 7518 §6.3.1: RSA 公開鍵の n・e（Base64urlUInt）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L1637-L1660)

</details>

### 3-06. cnf クレームの意味

単語の意味 / 選択式 / 1 点

**用語：cnf（confirmation）クレーム**

JWT の cnf クレームが宣言している内容はどれですか？

- **A.** JWT を暗号化して送るときに発行者が使う、受信者の公開鍵の識別子
- **B.** JWT の署名を受信者が検証するときに使う、発行者（AS）の公開鍵そのもの
- **C.** リソースオーナーが同意画面で、クライアントのアクセスを確認したこと
- **D.** 発行時に AS がクライアントの鍵を確認済みなので、受信者は所持を確認しなくてよいこと
- **E.** JWT の提示者が特定の鍵を所持しており、受信者がその所持を暗号的に確認できること

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 7800 §3 は「By including a "cnf" (confirmation) claim in a JWT, the issuer of the JWT declares that the presenter possesses a particular key and that the recipient can cryptographically confirm that the presenter has possession of that key」と述べています。DPoP では cnf.jkt が、提示者（クライアント）の公開鍵の Thumbprint を表します（RFC 9449 §6.1）。B：アクセストークン自体の署名は AS の鍵で検証します。cnf の鍵は提示者の鍵で、取り違えやすい点です。D：受信者が確認できることを宣言するもので、確認を省いてよいという意味ではありません。

**出典：** [RFC 7800 §3: cnf が宣言する内容と提示者](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7800.txt#L267-L301) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719)

</details>

### 3-07. 2 つの鍵で 1 つのトークン

ユースケース設計 / 選択式 / 1 点

同じユーザーが使う 2 つのクライアントインスタンス（それぞれ別の DPoP 鍵を持つ）で、1 つのアクセストークンを共有したいという要望がありました。

DPoP による送信者制約を保ったまま要望に応えるとき、RFC 7800 と RFC 9449 に沿う設計はどれですか？

- **A.** cnf を省いて、どちらのインスタンスからでも同じように使えるトークンにして発行する
- **B.** cnf に一方の鍵の jkt と、もう一方の鍵の jwk を入れて、1 つのトークンで 2 つの鍵を表す
- **C.** cnf.jkt を配列にして 2 つの鍵の Thumbprint を並べ、どちらの proof でも照合を通るようにする
- **D.** cnf は 1 つの鍵だけを表すので、インスタンスの鍵ごとに、それぞれ別のトークンを発行する
- **E.** 2 つの鍵の Thumbprint を連結して SHA-256 をとった値を jkt に入れ、両方の鍵に結び付ける

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 7800 §3.1 は「The "cnf" claim value MUST represent only a single proof-of-possession key」と定めます。DPoP の jkt は、その 1 つの鍵の Thumbprint です（RFC 9449 §6.1）。RFC 7800 §3.1 は cnf 以外のクレーム名で追加の鍵を表す方法も挙げていますが、RFC 9449 はそのようなクレームを定義しておらず、RS は cnf.jkt の 1 つの鍵と照合します（§6.1・§4.3）。C：jkt は 1 つの文字列です。B：表現の方法を変えても、1 つの cnf に 2 つの鍵を入れることはできません。A：RFC 9449 §5 のとおり AS は Bearer のトークンを発行することもできますが、cnf がなければ DPoP-bound ではなく、送信者制約を保つという条件に合いません。E：RS は proof の jwk から計算した Thumbprint と比べるので、どちらの鍵でも一致しません。

**出典：** [RFC 7800 §3.1: cnf は 1 つの鍵を表し、理解できないメンバーは無視する](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7800.txt#L303-L346) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 3-08. DPoP を知らない RS が受理する理由

知識 / 選択式 / 1 点

DPoP を知らない RS（RFC 6750 だけに対応）が、cnf.jkt を含む JWT アクセストークンを Bearer として受理し得る理由として、RFC 9449 が挙げているものはどれですか？

- **A.** JWT は理解できないクレームを無視し、introspection も追加のメンバーに機能上の要件を課さないため
- **B.** AS が、DPoP を知らない RS 向けの introspection 応答からは cnf を取り除いて返すため
- **C.** RFC 6750 が、Bearer トークンに含まれる cnf クレームは無視するよう、RS に明記して求めているため
- **D.** cnf.jkt は AS が暗号化して埋め込むので、DPoP を知らない RS には中身が読めず、確かめようがないため
- **E.** RFC 9449 が、DPoP を知らない RS に、DPoP-bound トークンの Bearer としての受理を求めているため

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 9449 §7.2 は、RFC 6750 だけに対応する RS が DPoP-bound トークンを Bearer として受理するだろう理由として「JWT [RFC7519] says to ignore unrecognized claims, Introspection [RFC7662] says that other parameters might be present while placing no functional requirements on their presence, and [RFC6750] is effectively silent on the content of the access token」を挙げています。RFC 7519 §4 は、アプリケーションが特に処理を求めていなければ、理解できないクレームを無視しなければならない（MUST）とし、RFC 7800 §3.1 も同じ条件で理解できない確認メンバーを無視するとしています。そのため RFC 7800 §4 は、所持の証明を必要とするアプリケーションに cnf の処理の実装を求めています。C：RFC 6750 はトークンの中身に事実上触れていません。E：RFC 9449 は受理を求めているのではなく、そうなるだろうと説明しています。

**出典：** [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [RFC 7519 §4: クレーム名の一意性と理解できないクレームの無視](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7519.txt#L425-L442) / [RFC 7800 §3.1: cnf は 1 つの鍵を表し、理解できないメンバーは無視する](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7800.txt#L303-L346) / [RFC 7800 §4: 所持証明とオーディエンス制限は別の保護](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7800.txt#L531-L576)

</details>

### 3-09. 所持の証明とオーディエンス制限

比較・使い分け / 選択式 / 1 点

RFC 9449 §2 は、悪意のある RS がトークンを別のエンドポイントで使う問題には、オーディエンス制限より送信者制約のほうが堅牢だと述べています。一方 RFC 7800 §4 は、所持の証明と一緒にオーディエンス制限も使うよう勧めています。両者と一致する理解はどれですか？

- **A.** DPoP-bound のトークンには aud を含めてはならない。RFC 9449 が、送信者制約との重複を禁じている
- **B.** DPoP の proof は URI に結び付かない。そのため、エンドポイントの区別には aud が必須である
- **C.** 所持の証明は権限のない送信者を、オーディエンス制限は宛先の違うトークンを拒否する。併用できる
- **D.** aud を検証すれば、別の RS での使用は防げる。proof の htu と ath の検証は省略できる
- **E.** DPoP を使えば aud は意味を持たなくなる。RFC 7800 の勧めは、DPoP のトークンには当てはまらない

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 7800 §4 は「Proof of possession can be used by recipients to reject messages from unauthorized senders. Audience restriction can be used by recipients to reject messages intended for different recipients」と両者の違いを述べています。RFC 9449 §2 は、オーディエンス制限は多くのデプロイメントで運用が難しかったとして送信者制約を勧めていますが、aud を禁止してはいません。たとえば正規のクライアントが誤って別の RS へトークンを送った場合は、aud が防ぎます。B：proof は htm・htu で、メソッドと URI に結び付きます（§4.2）。D：aud は proof の検証の代わりになりません。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [RFC 7800 §4: 所持証明とオーディエンス制限は別の保護](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7800.txt#L531-L576) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 3-10. introspection で分かること

知識 / 選択式 / 1 点

DPoP-bound のアクセストークンの introspection について、RFC 9449 と RFC 7662 の記述と一致するものはどれですか？

- **A.** Bearer として提示された DPoP-bound トークンを RS が問い合わせると、AS は active=false を返す
- **B.** RS は自身の認証情報で問い合わせ、応答の cnf.jkt を使って、結び付けを自分で検証する
- **C.** introspection 応答には token_type を必ず含める。その値は DPoP でなければならない
- **D.** RS はクライアントの proof を introspection 要求に転送する。AS が結び付けを検証し、結果を active で返す
- **E.** AS は応答の cnf に jwk 全体を入れる。Thumbprint だけでは、proof の鍵と比べられないため

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 9449 §6.2 は、鍵のハッシュを introspection 応答のトップレベルの cnf.jkt で伝え、「the resource server does not send a DPoP proof with the introspection request, and the authorization server does not validate an access token's DPoP binding」と述べています。RS はその情報でローカルに検証します。「If the token_type member is included in the introspection response, it MUST contain the value DPoP」なので、含めること自体は必須ではありません（C は誤り）。RFC 7662 §2.1 は、introspection エンドポイントに呼び出し側の認可（クライアント認証など）を求めています。A：AS は、RS がどの方式でトークンを受け取ったかを知りません。

**出典：** [§6.2: introspection 応答と RS によるローカルな鍵照合](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L742-L762) / [RFC 7662 §2.1: introspection 要求と呼び出し側の認可](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L186-L244) / [RFC 7662 §2.2: 応答メンバー、キャッシュ、非アクティブなトークン](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L287-L437)

</details>

### 3-11. introspection 結果のキャッシュ

誤り発見・原因特定 / 選択式 / 1 点

RS が introspection の結果（active と cnf.jkt）をトークン値ごとに 5 分間キャッシュし、キャッシュがある間は「このトークンは検証済み」として DPoP proof の検証を省略しています。

正しい修正はどれですか？

- **A.** introspection の代わりに、最初の proof の jti をキャッシュし、同じトークンの以降の要求を通す
- **B.** DPoP-bound のトークンでは、introspection の結果をキャッシュしてはならない。毎回問い合わせる
- **C.** キャッシュの有効期間を proof の時間窓より短くすれば、キャッシュがある間は proof の検証を省いてよい
- **D.** キャッシュがある間は ath の照合だけを省き、署名や htm・htu など、それ以外の proof の検証を行う
- **E.** キャッシュしてよいのはトークンの状態や cnf.jkt などで、proof の検証は要求ごとに必ず行う

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 7662 §2.2 は、性能のために応答をキャッシュしてよいが、判断に使う情報の鮮度と引き換えになると述べています（B は誤り）。キャッシュできるのはトークンのメタ情報です。proof は要求ごとに一意で（RFC 9449 §4）、RS は §4.3 の検証を含むすべての検証に成功するまでアクセスを許可できません（§7.1）。D：ath を省くと、同じ鍵に結び付いた別のトークン用の proof を使い回せます（§7）。A・C：要求ごとの proof の検証の代わりにはなりません。

**出典：** [RFC 7662 §2.2: 応答メンバー、キャッシュ、非アクティブなトークン](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L287-L437) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 3-12. 4 つのハッシュ値の入力

比較・使い分け / 選択式 / 1 点

次の値はどれも「SHA-256 の結果を base64url にしたもの」です。それぞれのハッシュの入力として正しい組み合わせはどれですか？

- **A.** ath：アクセストークンの値の ASCII　jkt：公開鍵の DER（SubjectPublicKeyInfo）　dpop_jkt：jkt と同じ計算　code_challenge（S256）：code_verifier の ASCII
- **B.** ath：アクセストークンの値の ASCII　jkt：必須メンバーだけの JWK の JSON（UTF-8）　dpop_jkt：jkt と同じ計算　code_challenge（S256）：code_verifier の ASCII
- **C.** ath：Authorization ヘッダーの値「DPoP &lt;トークン>」の ASCII　jkt：必須メンバーだけの JWK の JSON（UTF-8）　dpop_jkt：jkt と同じ計算　code_challenge（S256）：code_verifier の ASCII
- **D.** ath：JWT アクセストークンを復号したペイロードの JSON　jkt：必須メンバーだけの JWK の JSON（UTF-8）　dpop_jkt：jkt と同じ計算　code_challenge（S256）：code_verifier の ASCII
- **E.** ath：アクセストークンの値の ASCII　jkt：必須メンバーだけの JWK の JSON（UTF-8）　dpop_jkt：AS の署名鍵の Thumbprint　code_challenge（S256）：code_verifier の ASCII

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 9449 §4.2 の ath は「the SHA-256 [SHS] hash of the ASCII encoding of the associated access token's value」、§6.1 の jkt は RFC 7638 の JWK SHA-256 Thumbprint、§10 の dpop_jkt は jkt と同じ値です。RFC 7636 §4.2 の S256 は「BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))」です。C：スキーム名は含めません。D：トークンの形式に関係なく、提示する文字列そのものをハッシュします。A：DER の SPKI をハッシュする方式とは別で、JWK Thumbprint は JSON 表現から計算します。E：dpop_jkt はクライアントの DPoP 鍵の Thumbprint です。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [RFC 7636 §4.2: code_challenge の作り方（S256）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7636.txt#L424-L460) / [RFC 7638 §3: JWK Thumbprint の計算手順](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L130-L148)

</details>

### 3-13. 2 つの JWT と検証の鍵

知識 / 選択式 / 1 点

RS が、RFC 9068 の JWT アクセストークン（cnf.jkt を含む）と DPoP proof の 2 つの JWT を受け取りました。

それぞれの署名の検証に使う鍵として、正しい組み合わせはどれですか？

- **A.** アクセストークン：AS が提供する鍵　proof：クライアント登録時の jwks の鍵（kid で選ぶ）
- **B.** アクセストークン：cnf.jkt が指すクライアントの鍵　proof：proof の jwk の公開鍵
- **C.** アクセストークン：AS が提供する鍵（jwks_uri など）　proof：proof の jwk の公開鍵
- **D.** アクセストークン：proof の jwk の公開鍵　proof：AS が提供する鍵（jwks_uri など）
- **E.** アクセストークン：AS が提供する鍵　proof：AS が提供する鍵（kid で選ぶ）

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9068 §4 は、RS が JWT アクセストークンの typ が at+jwt（または application/at+jwt）であることを確かめ、AS の提供する鍵（AS メタデータの jwks_uri など）で署名を検証するよう定めています。proof は RFC 9449 §4.3 のとおり jwk の公開鍵で検証し、その鍵の Thumbprint をアクセストークンの cnf.jkt と照合します。B：cnf.jkt はクライアントの鍵の Thumbprint で、アクセストークンの署名鍵ではありません。A：§4.3 の 6 番目のとおり、proof の署名は jwk ヘッダーの公開鍵で検証します。2 つの JWT は typ（at+jwt と dpop+jwt）でも区別します。

**出典：** [RFC 9068 §4: JWT アクセストークンの検証と Bearer 以外のスキーム](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9068.txt#L364-L434) / [RFC 9068 §2.1: JWT アクセストークンの typ=at+jwt](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9068.txt#L158-L180) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719)

</details>

### 3-14. jkt の値の形式

知識 / 選択式 / 1 点

次のうち、jkt（または dpop_jkt）の値として正しい形式のものはどれですか？

- **A.** 0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I=
- **B.** sha-256:0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I
- **C.** d1970e08e459358cbe0d6a6aab7d236722461d33747761e0941577ba282e0382
- **D.** 0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I
- **E.** 0ZcOCORZNYy+DWpqq30jZyJGHTN0d2HglBV3uiguA4I=

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 9449 §6.1 は、jkt を JWK SHA-256 Thumbprint の base64url（RFC 7515 の定義）としています。RFC 7515 §2 の base64url は「-」「_」を使い、末尾の「=」を省くので、32 バイトのハッシュは 43 文字になります。D は RFC 9449 の例の値です。E は base64（「+」とパディング）、A はパディング付き、C は同じハッシュの 16 進表現で、どれも文字列として一致しません。B：値に接頭辞は付けません。§10 の dpop_jkt も jkt と同じ値です。

**出典：** [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [RFC 7515 §2: base64url（パディングなし）と JWS Signing Input](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L287-L299) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

### 3-15. Thumbprint を計算するコード

誤り発見・原因特定 / 選択式 / 1 点

RS の実装で、proof の EC 公開鍵 jwk から jkt を計算する式の候補が 5 つあります。sha256 は UTF-8 文字列の SHA-256 をバイト列で返し、b64url はパディングなしの base64url を、hex は 16 進文字列を返します。jwk には kid などの任意メンバーが含まれることがあります。JavaScript の JSON.stringify は、replacer を指定しない場合、crv のような整数の形でないキーを追加した順に出力します。

cnf.jkt と比べる値を正しく計算する式はどれですか？

- **A.** b64url(sha256(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })))
- **B.** b64url(sha256(JSON.stringify(jwk, Object.keys(jwk).sort())))
- **C.** hex(sha256(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })))
- **D.** b64url(sha256(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y })))
- **E.** b64url(sha256(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }, null, 1)))

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 7638 §3 は、必須メンバーだけを辞書順に並べ、空白なしで JSON にすることを求めます。§4 は「JSON.stringify() cannot be counted on to lexicographically sort the members of JSON objects」と注意し、並べ替えには別のコードが必要になると述べています。A は必須メンバーだけを辞書順に追加した新しいオブジェクトを作るので正しい入力になります。B はすべてのキーを並べるので、kid などの任意メンバーも含めてしまいます。D は順序が辞書順ではありません。E は第 3 引数のために改行と字下げが入ります。C は 16 進表現で、RFC 9449 §6.1 の base64url ではありません。

**出典：** [RFC 7638 §3: JWK Thumbprint の計算手順](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L130-L148) / [RFC 7638 §4: JSON.stringify と並べ替えの注意](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L439-L493) / [RFC 7638 §3.3: メンバーの順序とエスケープ・数値の表現](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L367-L408) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719)

</details>

### 3-16. active=false の introspection 応答

知識 / 選択式 / 1 点

RS が、Authorization: DPoP で受け取ったトークンの introspection を要求したところ、HTTP 200 で {"active": false} だけが返りました。

正しい解釈と RS の対応はどれですか？

- **A.** cnf が含まれていないので、DPoP-bound ではないトークンとみなす。Bearer のトークンとして扱い、受理する
- **B.** RS の introspection 用の認証情報が無効だという意味である。RS の設定を見直して再試行する
- **C.** introspection に失敗したことを示すエラー応答である。RS は時間をおいて、同じ introspection を再試行する
- **D.** 有効でないトークンを示す正常な応答で、RS は 401 の DPoP の challenge（invalid_token）で拒否する
- **E.** AS が無効の理由を返していないのは仕様違反である。RS は AS に理由を含めるよう求める

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 7662 §2.2 は、トークンが有効でない、存在しない、または RS が知ることを許されていない場合、AS が active を false にした応答を返し（MUST）、理由などの追加情報は含めるべきではない（SHOULD NOT）としています。§2.3 のとおり、これはエラー応答ではありません。RS の認証情報が無効な場合は 401 のエラー応答になります（B）。RS はクライアントに RFC 9449 §7.1 の challenge を返し、error には RFC 6750 の invalid_token を使えます。A：active が false のトークンは受理できません。

**出典：** [RFC 7662 §2.2: 応答メンバー、キャッシュ、非アクティブなトークン](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L287-L437) / [RFC 7662 §2.3: エラー応答と active=false の区別](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L439-L467) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [RFC 6750 §3.1: invalid_request・invalid_token・insufficient_scope](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6750.txt#L463-L498)

</details>

### 3-17. JWT アクセストークンと DPoP

知識 / 選択式 / 1 点

RFC 9068 の JWT アクセストークンと DPoP の関係として正しいものはどれですか？

- **A.** RFC 9068 のトークンも DPoP-bound にでき、Authorization: DPoP で送れる。他のスキームは妨げられない
- **B.** DPoP で使うときは、アクセストークンの typ を at+jwt から dpop+jwt に変えて区別する必要がある
- **C.** RFC 9068 のトークンでは cnf.jkt を使わない。proof の ath だけで、鍵との結び付けを確かめる
- **D.** DPoP で使うときは proof の typ を確かめるので、RS は at+jwt の typ の確認を省略してよい
- **E.** RFC 9068 のトークンは Bearer 専用である。DPoP-bound にするには opaque なトークンにする必要がある

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 9068 §4 は、検証に失敗したら invalid_token を返すよう定めたうえで「this requirement does not prevent JWT access tokens from using authentication schemes other than "Bearer"」と述べています。DPoP-bound の JWT アクセストークンは RFC 9449 §6.1 の cnf.jkt を含みます。B：dpop+jwt は proof の型で、アクセストークンの typ は at+jwt のままです（RFC 9068 §2.1）。D：typ の確認は RFC 9068 の必須の検証です。C：ath はトークンと proof の結び付けで、鍵との結び付けは cnf.jkt で確かめます。

**出典：** [RFC 9068 §4: JWT アクセストークンの検証と Bearer 以外のスキーム](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9068.txt#L364-L434) / [RFC 9068 §2.1: JWT アクセストークンの typ=at+jwt](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9068.txt#L158-L180) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 3-18. Thumbprint の照合手順

フロー構築 / 並べ替え / 2 点

RS が proof の jwk（EC 鍵）から Thumbprint を計算し、アクセストークンの cnf.jkt と照合する手順を並べてください。

- **A.** 結果をパディングなしの base64url にして、cnf.jkt と完全に一致するか比べる
- **B.** proof の JOSE ヘッダーから jwk を取り出し、秘密鍵のメンバーがないことを確かめる
- **C.** JSON 文字列を UTF-8 のバイト列にする
- **D.** バイト列の SHA-256 を計算する
- **E.** crv・kty・x・y の 4 つのメンバーだけを取り出す
- **F.** メンバー名の辞書順に並べ、空白も改行も入れずに JSON にする

<details>
<summary>解答・解説</summary>

**正解：B → E → F → C → D → A**

RFC 7638 §3 の手順です。必須メンバーを選び（§3.2）、辞書順に並べて空白なしの JSON にし（§3.3）、その UTF-8 のバイト列を SHA-256 でハッシュします。RFC 9449 §6.1 の jkt はその結果を base64url にした値なので、同じ形式にしてから比べます。秘密鍵を含む jwk は、§4.3 の 7 番目の検証で拒否します。

**出典：** [RFC 7638 §3: JWK Thumbprint の計算手順](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L130-L148) / [RFC 7638 §3.2: 鍵の種類ごとの必須メンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L287-L315) / [RFC 7638 §3.3: メンバーの順序とエスケープ・数値の表現](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L367-L408) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 3-19. 結び付けの確認の設計

ユースケース設計 / 記述式 / 6 点

RS は、JWT 形式のアクセストークン（RFC 9068、cnf.jkt を含む場合がある）と、opaque なアクセストークン（introspection で確かめる）の両方を受け取ります。すべての API で DPoP-bound のトークンを必須にする方針です。

トークンの種類ごとの結び付けの情報源、鍵の照合方法、introspection の結果のキャッシュ、DPoP-bound でないトークンの扱い、失敗時の応答を設計してください。

箇条書きで構いません。

<details>
<summary>解答・解説</summary>

**解答例**

JWT は typ=at+jwt（または application/at+jwt）・iss・aud・exp と AS の鍵による署名を検証してから、cnf.jkt を信頼できる結び付けとして使う。opaque トークンは RS 自身の認証情報で introspection を要求し、active と cnf.jkt（token_type があれば DPoP）を得る。結び付けの検証は AS に任せず RS が行う。proof の jwk から RFC 7638 の Thumbprint（SHA-256、base64url）を計算し、jkt と完全一致で比べる。cnf.jkt のないトークンは方針に従って拒否し、Bearer として届いた DPoP-bound トークンも拒否する。introspection の応答（active・cnf.jkt などのメタ情報）は exp を超えない短い時間に限ってキャッシュしてよいが、proof は要求ごとに検証する。失敗時は 401 と WWW-Authenticate: DPoP の challenge を返す（例：トークンや鍵の結び付けの不備は error="invalid_token"、proof 自体の不備は error="invalid_dpop_proof"）。

**採点基準（各 1 点）**

- JWT は typ（at+jwt または application/at+jwt）・iss・aud・exp・AS の鍵による署名を検証してから cnf.jkt を使う。
- opaque トークンは RS 自身の認証情報で introspection し、active と cnf.jkt を得る。結び付けの検証は RS が行う。
- proof の jwk から RFC 7638 の Thumbprint を計算し、jkt と完全一致で比べる。
- cnf.jkt のないトークンを方針に従って拒否し、Bearer として届いた DPoP-bound トークンも拒否する。
- introspection の応答（active・cnf.jkt などのメタ情報）は exp を超えない短い時間に限ってキャッシュしてよく、proof の検証は要求ごとに行う。
- 失敗時は 401 と DPoP の challenge で応答する（例：トークンや鍵の結び付けの不備は error="invalid_token"、proof 自体の不備は error="invalid_dpop_proof"）。

**出典：** [RFC 9068 §4: JWT アクセストークンの検証と Bearer 以外のスキーム](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9068.txt#L364-L434) / [§6.2: introspection 応答と RS によるローカルな鍵照合](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L742-L762) / [RFC 7638 §3: JWK Thumbprint の計算手順](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L130-L148) / [§6: RS が取得する鍵の結び付け情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L684-L699) / [RFC 7662 §2.2: 応答メンバー、キャッシュ、非アクティブなトークン](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L287-L437) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [RFC 7662 §2.1: introspection 要求と呼び出し側の認可](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L186-L244) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [RFC 7662 §4: introspection の応答のキャッシュと exp](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7662.txt#L706-L736) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [§7.1: 認証なしの 401 と鍵の結び付け失敗の 401 の例](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L938-L956)

</details>

### 3-20. refresh token の結び付けの実装

知識 / 選択式 / 1 点

public client の refresh token を DPoP 鍵に結び付ける方法について、RFC 9449 の記述と一致するものはどれですか？

- **A.** 結び付けの検証は任意である。AS は発行時に鍵を記録しておけば、使用時に照合しなくてよい
- **B.** refresh token は JWT にして、cnf.jkt を含めなければならない。RS と同じ形式で検証できるようにするため
- **C.** RS も refresh token の結び付けを検証できるよう、introspection で cnf.jkt を返さなければならない
- **D.** クライアントは refresh 要求で dpop_jkt を送る。AS はその値と proof の鍵で結び付けを確かめる
- **E.** 結び付けの実装の詳細は AS に任されている。作成も検証も AS が行うので、形式の相互運用は問題にならない

<details>
<summary>解答・解説</summary>

**正解：E**

§5 は「The implementation details of the binding of the refresh token are at the discretion of the authorization server. Since the authorization server both produces and validates its refresh tokens, there is no interoperability consideration in the specific details of the binding」と述べています。A：結び付けは「MUST be validated when the refresh token is later presented」です。D：dpop_jkt は認可要求のパラメーターで、refresh 要求では同じ鍵で作った proof を示します。C：refresh token は RS に提示しません。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

<a id="part-4"></a>

## 第 4 部：HTTP の細部 — メソッド・URI・認証ヘッダー・状態コード

20 問・26 点。htm と htu の照合、URI の正規化（RFC 3986）、認証スキームと challenge の構文（RFC 9110）、Bearer との違い（RFC 6750）を、実際の HTTP メッセージで確かめます。

### 4-01. htm の大文字・小文字

誤り発見・原因特定 / 選択式 / 1 点

クライアントが GET の要求に、htm を "get" とした proof を付けました。他の検証はすべて成功します。

RS の判断として正しいものはどれですか？

- **A.** htm は小文字で書く決まりなので、"get" が正しい値である。受理する
- **B.** RFC 9449 は htm も htu と同じく正規化して比べることを勧めているので、大文字にして受理する
- **C.** HTTP のメソッドは大文字・小文字を区別するので、"get" は GET と一致しない。拒否する
- **D.** HTTP のメソッドは大文字・小文字を区別しないので、"get" も GET と一致する。受理する
- **E.** htm の不一致は ath が一致していれば問題にならないので、アクセストークンが有効なら受理する

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9110 §9.1 は「The method token is case-sensitive」と定め、標準のメソッドは慣例で大文字です。RFC 9449 §4.3 の 8 番目は、htm が現在の要求のメソッドと一致することを求めます。§4.3 が正規化を勧めているのは htu だけです（B は誤り）。A：そのような決まりはありません。E：ath はトークンとの結び付けで、メソッドへの結び付けの代わりになりません（§7）。

**出典：** [RFC 9110 §9.1: メソッドトークンは大文字・小文字を区別](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L3728-L3758) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 4-02. 正規化しても一致しない URI

知識 / 選択式 / 1 点

RFC 9449 が勧める正規化（RFC 3986 の構文ベース・スキームベース）の後でも、一致しない組み合わせはどれですか？

- **A.** https://api.example.com/Orders と https://api.example.com/orders
- **B.** https://api.example.com:443/orders と https://api.example.com/orders
- **C.** https://API.Example.COM/orders と https://api.example.com/orders
- **D.** https://api.example.com/%7Euser と https://api.example.com/~user
- **E.** https://api.example.com と https://api.example.com/

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 3986 §6.2.2.1 は、スキームとホストは大文字・小文字を区別せず、その他の部分は区別するとしています。パスの Orders と orders は別の URI です。RFC 9110 §4.2.3 のとおり、https の既定のポート（443）は省き、空のパスは（OPTIONS 要求の対象でない限り）「/」と同じで、非予約文字（~ など）とそのパーセントエンコーディングは同じです。したがって E・C・B・D は、§4.3 の SHOULD に従った正規化の後で一致します。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 3986 §6.2.2: 構文ベースの正規化](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2197-L2257) / [RFC 3986 §6.2.3: スキームベースの正規化](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2259-L2321) / [RFC 9110 §4.2.3: http(s) URI の正規化と比較](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L1158-L1197)

</details>

### 4-03. 末尾のスラッシュ

知識 / 選択式 / 1 点

proof の htu は https://api.example.com/v1/data/ で、要求の URI は https://api.example.com/v1/data でした。このサーバーは /v1/data/ への要求を /v1/data へリダイレクトしています。

RFC 9449 が勧める正規化に従って照合した結果と、その理由として正しいものはどれですか？

- **A.** 一致する。空のパスと「/」が等しいという規則は、パスの末尾にあるスラッシュにも同じように当てはまる
- **B.** 一致する。スキームベースの正規化では、パスの末尾のスラッシュを取り除いてから比べることになっている
- **C.** 一致する。リダイレクトで同じリソースだと分かるので、サーバーは等しいとみなさなければならない
- **D.** 一致しない。htu は正規化せずに、文字列として完全に比べることが MUST だから
- **E.** 一致しない。末尾のスラッシュを同じとみなすのはプロトコルベースの正規化で、勧められた正規化ではない

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 9449 §4.3 が SHOULD とするのは、RFC 3986 の構文ベース（§6.2.2）とスキームベース（§6.2.3）の正規化です。末尾のスラッシュの違いを、リダイレクトの結果から同じとみなすのは §6.2.4 のプロトコルベースの正規化で、ウェブクローラーなどが使う手法です。A：空のパスを「/」とする規則は、パスが空の場合だけに当てはまります。D：正規化しない比較は MUST ではなく、正規化が SHOULD です。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 3986 §6.2.4: プロトコルベースの正規化（末尾のスラッシュ）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2323-L2341) / [RFC 3986 §6.2.3: スキームベースの正規化](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2259-L2321) / [RFC 9110 §4.2.3: http(s) URI の正規化と比較](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L1158-L1197)

</details>

### 4-04. パーセントエンコーディングの正規化

知識 / 選択式 / 1 点

htu を比べる前のパーセントエンコーディングの扱いとして、RFC 3986 の構文ベースの正規化に沿うものはどれですか？

- **A.** %7e は ~ に戻す。ただし 16 進の大文字・小文字は区別されるので、%3a と %3A は別の URI になる
- **B.** %2F は / に戻すが、%7e は予約文字なので戻さない。16 進は小文字にそろえる
- **C.** パーセントエンコーディングは一切変えない。16 進の大文字・小文字も含め、文字列のまま比べる
- **D.** %7e は ~ に戻し、予約文字（/）を表す %2F は戻さない。16 進の小文字（%3a）は大文字にそろえる
- **E.** %7e も %2F も、対応する文字（~ と /）に戻す。16 進の大文字・小文字はそのまま比べる

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 3986 §6.2.2.1 は、パーセントエンコーディングの 16 進の数字は大文字・小文字を区別しないので大文字にそろえるとし、§6.2.2.2 は非予約文字（英字、数字、-、.、_、~）に当たるものだけを復号するとしています。「/」は予約文字で、RFC 3986 §2.2 は予約文字とそのパーセントエンコーディングを置き換えた URI は同じではないとしています。%2F を / に戻すとパスの区切りが変わります。C：§4.3 は、正当な proof を誤って拒否すること（偽陰性）を減らすために、この正規化を勧めています（SHOULD）。

**出典：** [RFC 3986 §6.2.2: 構文ベースの正規化](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2197-L2257) / [RFC 3986 §2.3: 非予約文字とパーセントエンコーディング](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L718-L745) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 3986 §2.2: 予約文字とパーセントエンコーディングは同じではない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L656-L695)

</details>

### 4-05. TLS を終端するプロキシの後ろの RS

誤り発見・原因特定 / 選択式 / 1 点

RS は TLS を終端するロードバランサーの後ろにあり、アプリケーションには http://10.0.0.12:8080/v1/orders として要求が届きます。クライアントは htu を https://api.example.com/v1/orders にして proof を作るので、htu の照合が失敗します。

最も適切な対応はどれですか？

- **A.** ロードバランサーの後ろでは htu を正しく照合できない。この構成に限り、htu の検証を省く
- **B.** 設定した外部のスキームとホスト、または信頼できるプロキシの情報から、元の target URI を組み立てる
- **C.** クライアントに内部の URL（http://10.0.0.12:8080/v1/orders）を知らせ、htu にはその URL を入れてもらう
- **D.** スキームとホストは環境によって変わるので照合しない。パスだけを比べ、一致すれば受理する
- **E.** 要求に付いている X-Forwarded-Host ヘッダーを、送信元を確かめずにそのまま使って URI を組み立てる

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 9449 §4.3 の 9 番目は、htu が proof を受け取った要求の URI と一致することを求めます。RFC 9110 §7.1 は「a server reconstructs the target URI from the received components in accordance with their local configuration and incoming connection context」と述べており、TLS を終端する構成では外部の URI を組み立てる必要があります。D：同じパスを持つ別のホスト向けの proof を流用できてしまいます。DPoP は proof を URI に結び付けて、別のエンドポイントでの使用を防ぎます（§11）。C：クライアントは内部の URL を知らず、知るべきでもありません。E：利用者が付けたヘッダーは偽れるので、信頼できるプロキシが付けた値だけを使います。A：§4.3 の検証は MUST です。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 9110 §7.1: target URI とサーバーによる再構成](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L2370-L2410) / [§11: URI・メソッドへの結び付けと TLS 方式との違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1310-L1320)

</details>

### 4-06. 小文字の認証スキーム

知識 / 選択式 / 1 点

要求に「Authorization: dpop Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU」と、正しい DPoP ヘッダーが付いています。

RS の扱いとして正しいものはどれですか？

- **A.** RFC 9449 の ABNF は "DPoP" と大文字で書いている。"dpop" は別のスキームとして拒否する
- **B.** スキーム名が小文字の場合は Bearer スキームとみなす。DPoP の proof は検証しない
- **C.** スキーム名もトークンの値も、大文字・小文字を区別しない。トークンを小文字にしてから照合する
- **D.** スキーム名を DPoP に書き換えた値「DPoP Kz~8…」から ath を計算し直し、proof と照合する
- **E.** スキーム名は大文字・小文字を区別しないので、DPoP スキームとして扱う。トークンの値は区別する

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 9110 §11.1 は「It uses a case-insensitive token to identify the authentication scheme」と定めています。一方、トークンの値（token68 の部分）は変えずに扱い、ath もトークンの値だけから計算します（RFC 9449 §4.2）。なお §4.1 の「case is significant in the header field value」は DPoP ヘッダー（proof）についての記述で、Authorization ヘッダーのスキーム名には当てはまりません。D：ath の入力にスキーム名は含めません。

**出典：** [RFC 9110 §11.1: 認証スキームは大文字・小文字を区別しない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4859-L4875) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§4.1: DPoP HTTP ヘッダーの構文と大文字・小文字](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L359-L391) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 4-07. 結合された DPoP ヘッダー

誤り発見・原因特定 / 選択式 / 1 点

RS のフレームワークは、同じ名前のヘッダーが複数あると「, 」でつないだ 1 つの値にします。ある要求で、DPoP ヘッダーの値が「eyJ…(JWT A), eyJ…(JWT B)」でした。RS の実装は最初の「,」より前を proof として検証しています。

正しい修正はどれですか？

- **A.** 「, 」で分割してそれぞれ検証する。どちらかの JWT が有効であれば、その proof で受理する
- **B.** 後から付けたヘッダーが優先される。「,」より後にある最後の JWT を、proof として検証する
- **C.** 2 つの JWT がどちらも有効で、内容も完全に同じであれば、重複とはみなさずに受理する
- **D.** DPoP ヘッダーが複数ある要求として拒否する。token68 は「,」を含まないので、結合や不正な値と分かる
- **E.** RFC 9110 ではフィールドの順序に意味がある。最初の JWT だけを検証する今の実装で、仕様に合っている

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 9449 §4.3 の 1 番目は DPoP ヘッダーが 2 つ以上ないこと、2 番目は値が単一の正しい JWT であることです。RFC 9110 §5.3 は、受信側が同じ名前のフィールド行をカンマでつないでよいとし、リスト構文でないフィールドを送信者が複数行で送ることを禁じています。DPoP の値は token68 で（§4.1）カンマを含まないので、カンマがあれば、結合された値か不正な値なので、どちらにしても拒否します。C：同じ内容でも、ヘッダーが 2 つある要求は 1 番目の検証で拒否します。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 9110 §5.3: 同名のフィールド行の結合](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L1515-L1545) / [§4.1: DPoP HTTP ヘッダーの構文と大文字・小文字](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L359-L391)

</details>

### 4-08. challenge のパラメーターの書き方

知識 / 選択式 / 1 点

クライアントが「WWW-Authenticate: DPoP error=use_dpop_nonce, ALGS="ES256 PS256"」を受け取りました。

この challenge の解釈として正しいものはどれですか？

- **A.** error の値が引用符で囲まれていないので、challenge 全体が不正な値になる。クライアントはこの challenge を無視しなければならない
- **B.** error の値は token 形式で正しい。パラメーター名は区別しないので、ALGS は algs で 2 つの alg を示す
- **C.** パラメーター名は大文字・小文字を区別するので、ALGS は未知のパラメーターである。無視する
- **D.** algs の値は「ES256 PS256」という 1 つの alg 名である。スペースを含む名前として扱う
- **E.** algs はカンマで区切るリストなので、スペースで区切られた値は不正である。無視する

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 9110 §11.2 は、パラメーター名を大文字・小文字を区別せずに照合し、値は token と quoted-string のどちらでもよく、受信側は両方を受け付ける必要があるとしています。RFC 9449 §7.1 の algs は、JWS の alg 値をスペースで区切ったリストです。C：ALGS は algs と同じ名前なので、未知のパラメーターではありません。

**出典：** [RFC 9110 §11.2: token68 と auth-param（token / quoted-string）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4877-L4907) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936)

</details>

### 4-09. error はどの challenge のものか

知識 / 選択式 / 1 点

RS の 401 応答に「WWW-Authenticate: Bearer realm="api", DPoP algs="ES256", error="invalid_token"」が含まれていました。

error="invalid_token" はどの challenge のパラメーターですか？

- **A.** DPoP の challenge。DPoP の後の auth-param は、次のスキーム名までその challenge に属する
- **B.** 両方の challenge。error は WWW-Authenticate の値全体に適用されるパラメーターである
- **C.** どちらにも属さない。1 つのフィールドに複数の challenge を書くことは、HTTP で禁止されている
- **D.** Bearer の challenge。error は、どこに書いても先頭の challenge に属するパラメーターである
- **E.** Bearer の challenge。realm を持つ challenge が、その後のカンマ区切りのパラメーターをすべて受け取る

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 9110 §11.6.1 は、WWW-Authenticate の値に複数の challenge を含められ、各 challenge がカンマ区切りの auth-param を持つと述べています。§11.3 の構文（challenge = auth-scheme [ 1*SP ( token68 / #auth-param ) ]）では、スキーム名の後のパラメーターがその challenge に属します。RFC 9449 §7.2 の Figure 19 も、DPoP の後に algs・error・error_description を続けています。C：同じ行に複数の challenge を書くことは禁止されていません（相互運用性への注意はあります）。

**出典：** [RFC 9110 §11.6.1: WWW-Authenticate の複数 challenge](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L5018-L5060) / [RFC 9110 §11.3: challenge の構文](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4909-L4935) / [§7.2: 複数 challenge と 2 方式同時使用の 400 の例](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1023-L1057)

</details>

### 4-10. 状態コードとエラーの組み合わせ

知識 / 選択式 / 1 点

Bearer と DPoP の両方に対応する RS の応答として、RFC 9449（例を含む）と RFC 6750 に沿う組み合わせはどれですか？  
(1) 認証情報のない要求  
(2) 有効な DPoP-bound トークンと proof だが、スコープが足りない  
(3) Authorization: Bearer と Authorization: DPoP の両方がある  
(4) RS が nonce を要求する

- **A.** (1) 401・error なし　(2) 403・insufficient_scope　(3) 401・invalid_token　(4) 401・use_dpop_nonce
- **B.** (1) 401・error なし　(2) 403・insufficient_scope　(3) 400・invalid_request　(4) 400・use_dpop_nonce
- **C.** (1) 401・error なし　(2) 403・insufficient_scope　(3) 400・invalid_request　(4) 401・use_dpop_nonce
- **D.** (1) 401・error なし　(2) 401・insufficient_scope　(3) 400・invalid_request　(4) 401・use_dpop_nonce
- **E.** (1) 401・invalid_token　(2) 403・insufficient_scope　(3) 400・invalid_request　(4) 401・use_dpop_nonce

<details>
<summary>解答・解説</summary>

**正解：C**

(1) RFC 9449 §7.2 と RFC 6750 §3.1 は、認証情報のない要求にはエラーコードを含めるべきではない（SHOULD NOT）としています。(2) RFC 9449 §7.1 は、十分なトークンがない要求に 401 の challenge で応じられると書いていますが、RFC 6750 §3.1 は insufficient_scope に 403 を使うべきである（SHOULD）とし、RFC 9110 §11.4 も、有効だがアクセスに足りない認証情報には 403 を勧めています。両方に沿うのは 403 です（D は誤り）。(3) Figure 19 は、複数の方法でトークンを送った要求に 400 と invalid_request を返しています。RFC 6750 §3.1 の invalid_request も「uses more than one method for including an access token」を含みます。(4) §9 で RS は 401、WWW-Authenticate: DPoP の error="use_dpop_nonce"、DPoP-Nonce を使います。B の 400 は、§8 の AS のトークンエンドポイントでの形式です。

**出典：** [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [§7.2: 複数 challenge と 2 方式同時使用の 400 の例](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1023-L1057) / [RFC 6750 §3.1: invalid_request・invalid_token・insufficient_scope](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6750.txt#L463-L498) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [RFC 9110 §11.4: 認証情報と 401・403](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4937-L4979) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936)

</details>

### 4-11. フォーム本文で届いたトークン

誤り発見・原因特定 / 選択式 / 1 点

Bearer と DPoP の両方に対応する RS に、DPoP-bound のアクセストークンが RFC 6750 のフォーム本文（access_token=…）で届きました。要求には有効な DPoP ヘッダー（ath もそのトークンと一致）も付いています。

RS の扱いとして正しいものはどれですか？

- **A.** proof が有効で ath も一致するので、DPoP として受理する
- **B.** Bearer の方法で受け取った DPoP-bound トークンなので拒否する
- **C.** POST の要求なら受理する。フォーム本文の方法は POST でしか使えないため
- **D.** フォーム本文の方法は Authorization ヘッダーより優先されるので受理する
- **E.** DPoP ヘッダーがあるので、フォーム本文のトークンを DPoP スキームで送られたものとして受理する

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 9449 §7.1 は、DPoP-bound のアクセストークンを Authorization ヘッダーの DPoP スキームで送ると定めています。フォーム本文（RFC 6750 §2.2）は Bearer の送り方で、§7.2 は両方に対応する RS に「MUST reject a DPoP-bound access token received as a bearer token per [RFC6750]」と求めています。有効な proof が付いていても、Bearer として受け取ったことは変わりません。ダウングレードを防ぐための規定です。

**出典：** [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [RFC 6750 §2.2: フォーム本文の access_token](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6750.txt#L260-L310) / [RFC 6750 §2: 1 つの要求で複数の方法を使わない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6750.txt#L216-L220)

</details>

### 4-12. query を含めた jti の記録

ユースケース設計 / 選択式 / 1 点

RS は「要求の URI（query を含む）と jti」の組をキーにして jti を記録し、重複を拒否しています。攻撃者が GET /orders?status=open の要求からトークンと proof を盗み、時間窓のうちに GET /orders?status=all として送りました。

この状況の説明と対応として最も適切なものはどれですか？

- **A.** proof は query に結び付かず、query 込みのキーでは重複も見つからない。jti は query を除いた単位以上で記録する
- **B.** ath は query を含めた要求全体から計算するハッシュである。ath の照合で拒否される
- **C.** htu には query が含まれていないので、要求の URI と一致しない。htu の照合で拒否される
- **D.** jti の記録は「can」とされた任意の対策にすぎない。RFC 9449 には、query を変えたこの再送を防ぐ方法は書かれていない
- **E.** クライアントに query まで含めた htu を作らせる。そうすれば、query を変えた再送は htu の照合で拒否できるようになる

<details>
<summary>解答・解説</summary>

**正解：A**

§4.2 の htu は query と fragment を除いた URI で、§4.3 の 9 番目も query を無視して照合します。§11.1 は「In the context of the target URI」で jti を記録し、同じ URI への 2 回目を拒否する方法を挙げています。ただし RFC 9110 §7.1 の target URI は query を含むので、query 込みのキーで実装すると、query を変えた再送を見逃します。RFC 9449 は記録の単位を htu とは定めていませんが、proof が結び付くのは query を除いた htu なので、その単位か、より広い単位で記録するのが安全です。C：query は無視されるので照合は通ります。B：ath はトークンだけのハッシュです。D：jti の記録は任意（can）ですが §11.1 に書かれた方法で、単位を htu 以上にすればこの再送を拒否できます。E：§4.2 に反します。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§11.7: 本文・一般のヘッダーの完全性と TLS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1448-L1464) / [RFC 9110 §7.1: target URI とサーバーによる再構成](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L2370-L2410)

</details>

### 4-13. Authorization: DPoP に入れられる値

知識 / 選択式 / 1 点

Authorization: DPoP で送るアクセストークンの値として、RFC 9449 の ABNF（token68）に合うものはどれですか？

- **A.** Kz~8mXK1EalYznwH-LC-1fBAo 4Ljp~zsPE_NeO.gxU
- **B.** Kz~8mXK1EalYznwH-LC-1fBAo:4Ljp~zsPE_NeO.gxU
- **C.** Kz~8mXK1EalYznwH-LC-1fBAo,4Ljp~zsPE_NeO.gxU
- **D.** Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU
- **E.** Kz~8mXK1EalYznwH-LC-1fBAo==4Ljp~zsPE_NeO.gxU

<details>
<summary>解答・解説</summary>

**正解：D**

§7.1 の credentials は「"DPoP" 1*SP token68」で、token68 は「1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="」です。D は §5 の例のトークンです。B の「:」、A のスペース、C の「,」は使えない文字です。E：「=」は末尾にだけ置けます。Authorization: DPoP で送る以上、トークンの値は token68 に収まる必要があります（RFC 9449 が AS の要件として明記しているわけではありません）。

**出典：** [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§5: トークン応答と refresh_token グラントの要求例](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L572-L608) / [RFC 9110 §11.2: token68 と auth-param（token / quoted-string）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4877-L4907)

</details>

### 4-14. WWW-Authenticate のない 401

誤り発見・原因特定 / 選択式 / 1 点

RS は nonce を要求するとき、401 の本文に {"error":"use_dpop_nonce"} を入れ、DPoP-Nonce ヘッダーを付けて返しています。WWW-Authenticate ヘッダーは付けていません。

正しい指摘はどれですか？

- **A.** nonce は DPoP-Nonce ヘッダーではなく、JSON の本文の nonce メンバーに入れて返すべきである
- **B.** RS が nonce を要求するときは 400 で返すべきで、401 を使っている点が誤りである。本文はこのままでよい
- **C.** AS のトークンエンドポイントと同じく、JSON の本文でエラーを返す形式なので、この応答に問題はない
- **D.** nonce の要求には 403 を使い、WWW-Authenticate は付けずに DPoP-Nonce ヘッダーだけを返す
- **E.** 401 には WWW-Authenticate が必須で、RS は WWW-Authenticate: DPoP error="use_dpop_nonce" で要求する

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 9110 §15.5.2 は「The server generating a 401 response MUST send a WWW-Authenticate header field」と定めます。RFC 9449 §9 で RS は、401 と WWW-Authenticate: DPoP（error="use_dpop_nonce"）と DPoP-Nonce で nonce を要求します。エラーの伝え方は §7.1 のとおりです。C・B：400 と JSON の本文（RFC 6749 §5.2 の形式）は、AS のトークンエンドポイントの方法です。A：nonce は DPoP-Nonce ヘッダーで渡します。

**出典：** [RFC 9110 §15.5.2: 401 には WWW-Authenticate が必須](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L7548-L7563) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118)

</details>

### 4-15. 403 を受けた後の再試行

知識 / 選択式 / 1 点

クライアントが有効な DPoP-bound トークンと proof で要求したところ、403 と「WWW-Authenticate: DPoP error="insufficient_scope", scope="orders:write"」が返りました。

クライアントの対応として正しいものはどれですか？

- **A.** トークンが無効になったことを示している。refresh token で、同じスコープのトークンを取り直す
- **B.** nonce が足りないことを示している。DPoP-Nonce を受け取ってから、同じトークンで再試行する
- **C.** 同じトークンで proof だけ作り直しても結果は変わらない。必要なスコープのトークンを得てから要求する
- **D.** Bearer 方式に切り替える。同じトークンでも、Bearer なら DPoP の検証を通らないので、スコープの不足も問われずに再試行できる
- **E.** 新しい jti の proof を作る。同じトークンでも、proof を作り直せば受理される見込みがある

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9110 §15.5.4 は、403 は認証情報が不十分なことを示し、クライアントは同じ認証情報で自動的に再試行すべきでない（SHOULD NOT）としています。RFC 6750 §3.1 の insufficient_scope は、より高い権限が必要なことを示し、必要なスコープを scope で示せます。proof を作り直してもトークンの権限は変わりません。A：invalid_token とは別のエラーで、同じスコープで取り直しても足りません。D：両方に対応する RS は、Bearer として届いた DPoP-bound トークンを拒否します（RFC 9449 §7.2）。

**出典：** [RFC 9110 §15.5.4: 403 と同じ認証情報での再試行](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L7569-L7585) / [RFC 6750 §3.1: invalid_request・invalid_token・insufficient_scope](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6750.txt#L463-L498) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021)

</details>

### 4-16. リダイレクトと proof

誤り発見・原因特定 / 選択式 / 1 点

クライアントの HTTP ライブラリは、307 の応答を受けると同じヘッダーのまま Location の URI へ自動で再送します。GET https://api.example.com/v1/orders に付けた proof が、https://api2.example.com/v1/orders への再送にもそのまま使われ、拒否されました。

正しい対応はどれですか？

- **A.** 自動の再送をやめ、送り先が意図した RS かを確かめたうえで、新しい URI と jti で proof を作り直す
- **B.** メソッドとトークンが同じなので、proof を作り直す必要はない。ath を計算し直して付けるだけでよい
- **C.** htu に、リダイレクト元とリダイレクト先の両方の URI を入れておく。どちらでも照合を通るようにする
- **D.** リダイレクト先には DPoP ヘッダーを外して送る。Authorization: DPoP だけで送れば受理される
- **E.** リダイレクト元の RS が案内した URI である。リダイレクト先の RS は、htu の不一致を許容すべきである

<details>
<summary>解答・解説</summary>

**正解：A**

§4 は「Each HTTP request requires a unique DPoP proof」とし、§4.2 の htu は proof を付ける要求の target URI です。リダイレクト後の要求は target URI が違うので、§4.3 の 9 番目に合う新しい proof（新しい jti）が必要です。リダイレクトで別のホストにトークンを送ることになる場合は、その送り先にトークンを渡してよいかも確かめます。C：htu は 1 つの URI です。B：ath は同じでも、htu が合いません。D：§7 は、保護されたリソースへの要求に proof を必須としています。

**出典：** [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 4-17. 認証付きのフォワードプロキシ

知識 / 選択式 / 1 点

社内のフォワードプロキシが認証を求めます（407）。クライアントは同時に、外部の RS へ DPoP-bound のトークンを送る必要があります。

RFC 9449 に沿う構成はどれですか？

- **A.** プロキシに DPoP の秘密鍵を預ける。プロキシが要求ごとに proof を作り、RS へ送る
- **B.** Proxy-Authorization: DPoP にアクセストークンを入れる。プロキシから RS へ、そのまま転送してもらう
- **C.** プロキシにも Proxy-Authorization: DPoP を使う。htu をプロキシの URI にした proof を別に作って付ければ、両方で検証できる
- **D.** DPoP はプロキシ経由では使えない。プロキシを通す要求に限り、Bearer 方式に切り替える
- **E.** プロキシには Proxy-Authorization で別のスキームを使い、RS には Authorization: DPoP と DPoP ヘッダーを送る

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 9449 §7.1 は「This authentication scheme is for origin-server authentication only. Therefore, this authentication scheme MUST NOT be used with the Proxy-Authenticate or Proxy-Authorization header fields」と定めています。プロキシの認証は RFC 9110 §11.3 の 407 と Proxy-Authorization の仕組みで、DPoP とは別に行います。A：秘密鍵を預けると、鍵の所持で送信者を限る意味がなくなります。D：そのような制限はありません。

**出典：** [§7.1: CORS でのヘッダー公開とプロキシ認証への使用禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L958-L968) / [RFC 9110 §11.3: challenge の構文](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4909-L4935)

</details>

### 4-18. HEAD と GET

誤り発見・原因特定 / 選択式 / 1 点

クライアントが、GET 用に作った proof（htm="GET"）を同じ URI への HEAD 要求に付けました。

RS の判断と、その理由として正しいものはどれですか？

- **A.** HEAD は GET と同じ意味を持つメソッドである。htm=GET の proof でも、同じ要求とみなして受理してよい
- **B.** 安全なメソッドでは htm の照合を省いてよい。HEAD も GET も安全なメソッドなので受理する
- **C.** htm は要求のメソッドと一致しなければならない。HEAD 要求に htm=GET の proof は使えないので拒否する
- **D.** HEAD は本文を返さないメソッドである。proof もアクセストークンも、この要求には要らない
- **E.** HEAD の場合は htm を省いた proof を使う決まりである。htm=GET の proof はその点で拒否する

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9449 §4.3 の 8 番目は「The htm claim matches the HTTP method of the current request」です。HEAD は GET に近い意味を持ちますが、メソッドトークンは別で（RFC 9110 §9.1）、htm には proof を付ける要求のメソッドそのものを入れます（§4.2）。D：保護されたリソースへの要求には proof とトークンが必要です（§7）。B：そのような例外はありません。E：htm は必須クレームです。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [RFC 9110 §9.1: メソッドトークンは大文字・小文字を区別](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L3728-L3758) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 4-19. RS の nonce と再送

フロー構築 / 並べ替え / 2 点

RS が nonce を要求する場合の、保護されたリソースへのアクセスの流れを並べてください。トークンは有効で、他の検証はすべて成功します。

- **A.** RS が 401、WWW-Authenticate: DPoP error="use_dpop_nonce"、DPoP-Nonce: N1 を返す
- **B.** クライアントがトークンと、nonce を含まない proof（ath あり）を RS に送る
- **C.** クライアントが N1 を、この RS 向けの nonce として保存する
- **D.** クライアントは、この RS への次の要求の proof に N2 を使う
- **E.** RS が 200 の応答に DPoP-Nonce: N2 を付けて返す
- **F.** クライアントが nonce=N1 と新しい jti を含む proof を作り、同じトークンで再送する

<details>
<summary>解答・解説</summary>

**正解：B → A → C → F → E → D**

§9 で RS は 401 と WWW-Authenticate: DPoP と DPoP-Nonce で nonce を要求し、§8 と同じ方法で nonce を提供します。nonce は発行したサーバーでだけ使うので、送信元ごとに保存します。§8.2 のとおり、成功応答で新しい nonce を受け取ったら、次の要求からその値を使います。再送の proof にも新しい jti を使います（§4）。

**出典：** [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 4-20. クライアントの challenge 処理

ユースケース設計 / 記述式 / 6 点

SPA が 1 つの AS と 2 つの RS を使います。RS は Bearer と DPoP の challenge を同時に返すことがあり、AS も RS も nonce を要求することがあります。

クライアントが受け取る 401・403・400 の応答と、WWW-Authenticate・DPoP-Nonce をどう解釈し、どう再試行するかを設計してください。

箇条書きで構いません。条件ごとの対応を書いてください。

<details>
<summary>解答・解説</summary>

**解答例**

WWW-Authenticate は複数の challenge と複数のフィールド行を含み得るので、スキームごとに分けて解析する。パラメーター名は大文字・小文字を区別せず、値は token と quoted-string の両方を受け付ける。DPoP の challenge の algs（スペース区切り）で使える alg を確かめ、未知のパラメーターは無視する。RS の 401 の use_dpop_nonce なら、DPoP-Nonce を送信元のサーバーごとに保存し、その値を nonce クレームに入れた新しい jti の proof で再試行する。200 の応答の DPoP-Nonce でも更新する。AS のトークンエンドポイントの 400 は、WWW-Authenticate ではなく JSON 本文の error で判断する。use_dpop_nonce なら DPoP-Nonce を AS 用に保存して再試行し、invalid_dpop_proof なら proof を見直す。RS の invalid_token ではトークンの更新や再認可を検討し、invalid_dpop_proof なら proof の作り方を見直す。403（insufficient_scope）では同じトークンで自動的に再試行せず、必要なスコープのトークンを取得する。RS の 400（invalid_request）では送り方を直し、DPoP-bound トークンを Bearer に切り替えて再試行しない。SPA では、AS と RS が Access-Control-Expose-Headers で WWW-Authenticate と DPoP-Nonce を公開していないと読めない。

**採点基準（各 1 点）**

- WWW-Authenticate を challenge ごとに分けて解析し、パラメーター名の大文字・小文字を区別せず、token と quoted-string の両方を受け付ける。
- DPoP の challenge の algs（スペース区切り）を使い、未知のパラメーターは無視する。
- use_dpop_nonce では DPoP-Nonce を送信元ごとに保存し、その値を nonce クレームに入れた新しい jti の proof で再試行する。200 の応答の DPoP-Nonce でも更新する（SPA では、これらのヘッダーが公開されている必要があることに触れてもよい）。
- invalid_token ではトークンの更新や再認可、invalid_dpop_proof では proof の作り方の見直しというように、エラーで対応を分ける。
- 403（insufficient_scope）では同じトークンで自動的に再試行せず、必要なスコープのトークンを取得する。
- AS の 400 は JSON 本文の error（use_dpop_nonce・invalid_dpop_proof）で判断し、RS の 400（invalid_request）は送り方の誤りとして直す。DPoP-bound トークンを Bearer に切り替えて再試行しない。

**出典：** [RFC 9110 §11.6.1: WWW-Authenticate の複数 challenge](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L5018-L5060) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [RFC 6750 §3.1: invalid_request・invalid_token・insufficient_scope](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6750.txt#L463-L498) / [RFC 9110 §15.5.4: 403 と同じ認証情報での再試行](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L7569-L7585) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [RFC 9110 §11.2: token68 と auth-param（token / quoted-string）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4877-L4907) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§7.2: 複数 challenge と 2 方式同時使用の 400 の例](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1023-L1057) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§7.1: CORS でのヘッダー公開とプロキシ認証への使用禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L958-L968) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159)

</details>

<a id="part-5"></a>

## 第 5 部：相互運用 — メタデータ・登録・PAR・PKCE

20 問・28 点。AS・RS・クライアントのメタデータ（RFC 8414・9728・7591）、PAR（RFC 9126）、PKCE（RFC 7636）、token_type（RFC 6749）を組み合わせたとき、どこで何が決まるかを確かめます。

### 5-01. DPoP のメタデータの持ち主

比較・使い分け / 選択式 / 1 点

DPoP に関するメタデータの名前・持ち主・意味の組み合わせとして正しいものはどれですか？

- **A.** クライアントの dpop_bound_access_tokens_required=true：AS は DPoP ヘッダーのないトークン要求を拒否する　RS の dpop_bound_access_tokens=true：RS は常に DPoP-bound トークンを求める
- **B.** クライアントの dpop_bound_access_tokens=true：AS は DPoP ヘッダーのないトークン要求を拒否する　RS の dpop_bound_access_tokens_required=true：RS は常に DPoP-bound トークンを求める
- **C.** クライアントの dpop_bound_access_tokens（省略時は true）：AS は DPoP ヘッダーのないトークン要求を拒否する　RS の dpop_bound_access_tokens_required（省略時は true）
- **D.** AS の dpop_bound_access_tokens=true：AS はすべてのクライアントに DPoP を求める　RS の dpop_bound_access_tokens_required=true：RS は常に DPoP-bound トークンを求める
- **E.** クライアントの dpop_bound_access_tokens=true：AS は DPoP ヘッダーのないトークン要求を拒否する　RS の dpop_signing_alg_values_supported：RS が応答の署名に使う alg

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 9449 §5.2 のクライアントのメタデータ dpop_bound_access_tokens は、省略時 false の真偽値で、true なら AS はそのクライアントの DPoP ヘッダーのないトークン要求を拒否しなければなりません（MUST）。RFC 9728 §2 は RS のメタデータとして、dpop_bound_access_tokens_required（省略時 false）と、proof の検証に使える alg の dpop_signing_alg_values_supported を定めています。応答の署名の alg は resource_signing_alg_values_supported で、E はこれと混同しています。RFC 9449 が AS のメタデータとして定めるのは dpop_signing_alg_values_supported だけです（§5.1）。A：クライアントと RS の名前が逆です。C：どちらも省略時は false です。

**出典：** [§5.2: dpop_bound_access_tokens の既定値と要求](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L662-L682) / [RFC 9728 §2: bearer_methods_supported から DPoP 関連メタデータまで](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L227-L288) / [§5.1: dpop_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L651-L660)

</details>

### 5-02. 空の dpop_signing_alg_values_supported

知識 / 選択式 / 1 点

DPoP に対応していない AS が、メタデータに "dpop_signing_alg_values_supported": [] を載せています。

RFC 8414 と RFC 9449 に照らした評価として正しいものはどれですか？

- **A.** 空の配列は「DPoP に対応していない」ことを表す、標準の書き方である。この記載は正しい
- **B.** RFC 9449 は、DPoP に対応しない AS にも、この項目を空の配列で載せることを求めている
- **C.** 空の配列は「alg を制限しない」ことを表す。クライアントは、自分の選んだ任意の alg を proof に使える
- **D.** 空の配列は、AS が alg=none の proof だけを受け付けることを、明示的に表している
- **E.** 要素が 0 個のメタデータは省略しなければならない。DPoP に対応しない AS は、この項目を載せない

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 8414 §3.2 は「Claims that return multiple values are represented as JSON arrays. Claims with zero elements MUST be omitted from the response」と定めます。RFC 9449 §5.1 の dpop_signing_alg_values_supported は、DPoP への対応と、proof に使える alg を示す配列です。C・D：そのような意味はなく、none は proof に使えません（§4.2）。なお RFC 9728 の bearer_methods_supported は、空の配列で「Bearer の送り方に対応しない」ことを示せると個別に定めています。項目ごとの定義を確かめる必要があります。

**出典：** [RFC 8414 §3.2: 要素数 0 のメタデータは省略する](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8414.txt#L511-L524) / [§5.1: dpop_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L651-L660) / [RFC 9728 §2: bearer_methods_supported から DPoP 関連メタデータまで](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L227-L288)

</details>

### 5-03. DPoP だけを受け付ける RS のメタデータ

ユースケース設計 / 選択式 / 1 点

ある RS は DPoP-bound のトークンだけを受け付け、Bearer の送り方（ヘッダー・本文・クエリー）はどれも受け付けません。この方針を、保護されたリソースのメタデータ（RFC 9728）で示します。

適切な記載はどれですか？

- **A.** "dpop_bound_access_tokens": true と "dpop_signing_alg_values_supported": [] を載せる
- **B.** "dpop_bound_access_tokens_required": true を載せ、bearer_methods_supported を省略して「対応なし」を示す
- **C.** "bearer_methods_supported": ["dpop"] を載せて、DPoP だけに対応することを示す
- **D.** "dpop_bound_access_tokens_required": true と "bearer_methods_supported": [] を載せる
- **E.** "dpop_bound_access_tokens_required": false を載せ、DPoP だけに対応することは challenge で示す

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 9728 §2 の bearer_methods_supported は RFC 6750 の送り方（header・body・query）の配列で、「The empty array [] can be used to indicate that no bearer methods are supported. If this entry is omitted, no default bearer methods supported are implied, nor does its absence indicate that they are not supported」と定めます（B は誤り）。§3.2 には「Parameters with zero values MUST be omitted from the response」という一般の規則がありますが、bearer_methods_supported については §2 が空の配列 [] に「Bearer の送り方に対応しない」という意味を個別に与えているので、D の [] はこの定めに基づく記載です。dpop_bound_access_tokens_required は、常に DPoP-bound のトークンを求めるかを表す真偽値です。C：値は Bearer の送り方です。A：dpop_bound_access_tokens はクライアントのメタデータです。dpop_signing_alg_values_supported の空の配列には §2 で意味が与えられていないので、§3.2 のとおり省略します。E：方針と逆の値です。

**出典：** [RFC 9728 §2: bearer_methods_supported から DPoP 関連メタデータまで](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L227-L288) / [RFC 9728 §3.2: 値のないパラメーターは省略する](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L433-L444)

</details>

### 5-04. RS が受け付けない alg の鍵

ユースケース設計 / 選択式 / 1 点

AS の dpop_signing_alg_values_supported は ["ES256","PS256"] です。クライアントは EC 鍵（ES256）の proof でアクセストークンを取得しました。ところが、使いたい RS の challenge は algs="PS256" でした。

クライアントの対応として正しいものはどれですか？

- **A.** 新しい RSA 鍵で PS256 の proof を作る。今のトークンと一緒に、その proof を RS へ送る
- **B.** AS が ES256 を受け付けている。同じ AS のトークンなので、RS も ES256 の proof を受理しなければならない
- **C.** RSA 鍵を用意し、その鍵の PS256 の proof でトークンを取得し直す。トークンは取得時の鍵に結び付く
- **D.** この RS には proof を付けない。Authorization: DPoP だけでトークンを送れば受理される
- **E.** 今の EC 鍵のまま、JOSE ヘッダーの alg だけを PS256 にする。署名の方式は鍵に合わせて自動で変わる

<details>
<summary>解答・解説</summary>

**正解：C**

§5・§6 のとおり、アクセストークンはトークン要求の proof の公開鍵に結び付き、RS は proof の鍵がその鍵と一致することを確かめます（§4.3 の 12 番目）。A：新しい鍵の proof は結び付けの照合を通りません。E：PS256 は RSA の鍵で使うアルゴリズムで、EC 鍵とは組み合わせられません。RFC 8725 §3.1 も alg と実際の処理の一致を求めています。B：RS が受け付ける alg は RS のローカルポリシーで決まり（§4.3 の 5 番目）、challenge の algs で示されます（§7.1）。D：proof は必須です（§7）。

**出典：** [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§5.1: dpop_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L651-L660) / [RFC 8725 §3.1: ライブラリは許可する alg を呼び出し側が指定できるようにする](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L285-L293)

</details>

### 5-05. DPoP ヘッダーのない refresh 要求

知識 / 選択式 / 1 点

confidential client のメタデータに dpop_bound_access_tokens: true が登録されています。このクライアントが、クライアント認証は正しく行ったうえで、DPoP ヘッダーのない refresh_token グラントの要求を送りました。

AS の扱いとして正しいものはどれですか？

- **A.** 拒否する。このクライアントの DPoP ヘッダーのないトークン要求は、grant type に関係なく拒否する
- **B.** 受理し、前回のアクセストークンと同じ鍵に結び付けたアクセストークンを発行する
- **C.** 受理して Bearer のアクセストークンを発行する。refresh 要求は dpop_bound_access_tokens の対象外である
- **D.** クライアント認証が mTLS の場合に限り、DPoP ヘッダーがなくても受理する
- **E.** 受理する。confidential client の refresh token は DPoP 鍵に結び付いていないので、proof は要らない

<details>
<summary>解答・解説</summary>

**正解：A**

§5.2 は、dpop_bound_access_tokens が true なら「the authorization server MUST reject token requests from the client that do not contain the DPoP header」と定めます。§5 のとおり、トークン要求には refresh_token グラントを含むすべての grant type が含まれます。E：confidential client の refresh token が鍵に結び付かないこと（§5）は、トークン要求に DPoP ヘッダーを求めるこのメタデータとは別の話です。B：AS は proof の鍵に結び付けますが、この要求には proof がありません。

**出典：** [§5.2: dpop_bound_access_tokens の既定値と要求](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L662-L682) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

### 5-06. proof のないコードの引き換え

知識 / 選択式 / 1 点

認可要求に dpop_jkt を含めて得た認可コードを、クライアントが DPoP ヘッダーなしでトークンエンドポイントに送りました。PKCE の code_verifier は正しい値です。

AS の扱いとして正しいものはどれですか？

- **A.** 受理する。PKCE の検証に成功していれば、dpop_jkt の確認は省略できる
- **B.** 拒否する。proof がなければ、その鍵の Thumbprint が dpop_jkt と一致することを確かめられない
- **C.** 受理して Bearer のトークンを発行する。DPoP ヘッダーがないのは、DPoP を使わないという意味である
- **D.** クライアントが public client の場合に限り拒否する
- **E.** 受理し、dpop_jkt の鍵に結び付けたトークンを発行する。proof がなくても Thumbprint は分かるため

<details>
<summary>解答・解説</summary>

**正解：B**

§10 は、トークン要求を受けた AS が proof の公開鍵の JWK Thumbprint を計算して dpop_jkt と比べ、一致しなければ拒否しなければならない（MUST）としています。proof がなければ一致を確かめられません。§10.1 は、PAR 要求の DPoP ヘッダーを「as if the contained public key's thumbprint was provided using dpop_jkt」として扱い、その意味を「reject the subsequent token request unless a DPoP proof for the same key is provided」と説明しています。dpop_jkt を示した場合も、同じ鍵の proof がなければ拒否します。C：コードを鍵に結び付けた意味がなくなります（§11.9）。A：dpop_jkt と PKCE はそれぞれ別に検証します。E：鍵を持つ証明なしに結び付けても、正規の鍵の持ち主であることは確かめられません。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [§11.9: 認可コードの盗難・再利用と dpop_jkt](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1482-L1514)

</details>

### 5-07. PAR 要求の proof の htu

知識 / 選択式 / 1 点

クライアントは PAR エンドポイント https://as.example.com/as/par に DPoP ヘッダーを付けて PAR 要求を送ります。後で使うトークンエンドポイントは https://as.example.com/token です。

PAR 要求に付ける proof の htm と htu として正しいものはどれですか？

- **A.** htm=POST、htu=https://as.example.com/as/par?client_id=…（送るパラメーターを query に含めた URI）
- **B.** htm=POST、htu=https://as.example.com/token（コードを後で引き換える、DPoP の結び付けを使う先なので）
- **C.** htm=POST、htu=https://as.example.com（AS の issuer 識別子で、どのエンドポイントにも共通の値）
- **D.** htm=GET、htu=https://as.example.com/authorize（PAR 要求は、認可要求の代わりに送るものなので）
- **E.** htm=POST、htu=https://as.example.com/as/par（PAR 要求そのもののメソッドと、query を除いた URI）

<details>
<summary>解答・解説</summary>

**正解：E**

§10.1 で、PAR 要求に付けた proof は AS が §4.3 に従って検証します（MUST）。htm は要求のメソッド、htu は要求の URI です。RFC 9126 §2.1 の PAR 要求は、PAR エンドポイントへのフォーム本文の POST です。B：トークン要求の proof は、トークン要求のときに別に作ります。A：htu には query を含めず（§4.2）、PAR のパラメーターは本文で送ります。

**出典：** [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 9126 §2.1: PAR 要求のパラメーターとクライアント認証](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9126.txt#L284-L307)

</details>

### 5-08. PAR のクライアント認証と DPoP

知識 / 選択式 / 1 点

confidential client が private_key_jwt でクライアント認証を行い、PAR 要求に DPoP ヘッダーも付けます。

正しい理解はどれですか？

- **A.** DPoP ヘッダーを付けた PAR 要求では、鍵の所持が示されるので client_assertion を省略できる
- **B.** PAR 要求の proof の iss に client_id を入れれば、その proof がクライアント認証として扱われる
- **C.** PAR エンドポイントでもクライアント認証が必要で、DPoP の proof はその代わりにならない
- **D.** DPoP の proof の鍵と、クライアント認証の JWT の鍵は、同じ鍵でなければならない
- **E.** PAR 要求でクライアント認証を行う場合は、DPoP ヘッダーを付けてはならない

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9126 §2.1 は、PAR エンドポイントが「Authenticate the client in the same way as at the token endpoint」と定めます。RFC 9449 §1 のとおり DPoP はクライアント認証の方式ではなく、private_key_jwt などと併用できます。D：同じ鍵にする要件はなく、§11.11 は DPoP とクライアント認証が暗号的には結び付かないと述べています。E：§10.1 は PAR 要求への DPoP ヘッダーを認めています。B：proof は所持の証明で、クライアント認証ではありません。

**出典：** [RFC 9126 §2.1: PAR エンドポイントの処理](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9126.txt#L340-L366) / [RFC 9126 §2.1: PAR 要求のパラメーターとクライアント認証](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9126.txt#L284-L307) / [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [§11.11: クライアント認証との暗号学的な結び付きの限界](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1536-L1548)

</details>

### 5-09. DPoP ヘッダーのほうが強い理由

比較・使い分け / 選択式 / 1 点

PAR で DPoP の鍵を伝える 2 つの方法のうち、RFC 9449 が DPoP ヘッダーの方法を「より強い結び付け」と呼ぶ理由はどれですか？

- **A.** dpop_jkt は認可コードに結び付くが、DPoP ヘッダーはアクセストークンだけに直接結び付くから
- **B.** DPoP ヘッダーは暗号化されて届くが、PAR の本文に入れる dpop_jkt は暗号化されずに届くから
- **C.** dpop_jkt は SHA-1 で計算する値だが、DPoP ヘッダーの方法では SHA-256 を使って結び付けるから
- **D.** DPoP ヘッダーには秘密鍵を持つ証明が含まれるが、dpop_jkt は Thumbprint を示すだけだから
- **E.** DPoP ヘッダーの方法を使うと、後のトークン要求で proof を付けなくてよくなるから

<details>
<summary>解答・解説</summary>

**正解：D**

§10.1 は「it provides a stronger binding, as the DPoP header contains a proof of possession of the private key」と述べています。DPoP ヘッダーの方法でも、AS は dpop_jkt が示されたものとして扱い、同じ鍵の proof のないトークン要求を拒否します（A・E は誤り）。B：どちらも TLS で守られ、DPoP は暗号化の仕組みではありません。C：dpop_jkt も、SHA-256 で計算する JWK Thumbprint です（§10）。

**出典：** [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

### 5-10. 小文字の token_type

知識 / 選択式 / 1 点

AS のトークン応答が {"access_token":"…","token_type":"dpop","expires_in":300} でした。

クライアントの解釈として正しいものはどれですか？

- **A.** token_type の値は大文字・小文字を区別しないので、DPoP の token type として扱う
- **B.** RFC 9449 は "DPoP" と書いているので、"dpop" は別の token type として扱い、応答を破棄する
- **C.** 理解できない token type なので、Bearer として扱う
- **D.** token_type の大文字・小文字の違いに合わせて、ath の計算方法を変える
- **E.** "dpop" は DPoP-bound ではないことを示すので、Bearer 方式で送る

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 6749 §5.1 は token_type について「Value is case insensitive」と定めています。"dpop" は RFC 9449 §5 の token type「DPoP」です。RFC 6749 §7.1 は、クライアントが理解できない token type のトークンを使ってはならないとしていますが、この値は理解できる token type です。C：理解できない場合も Bearer として使ってよいわけではありません。D：ath の計算は token_type に関係しません。

**出典：** [RFC 6749 §5.1: token_type は大文字・小文字を区別しない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6749.txt#L2386-L2397) / [RFC 6749 §7.1: 理解できない token type は使わない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc6749.txt#L2695-L2728) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570)

</details>

### 5-11. 同じ鍵を使い回す Web アプリと注入攻撃

ユースケース設計 / 選択式 / 1 点

confidential client（Web サーバー）が、すべての利用者のセッションで同じ DPoP 鍵を使い、認可要求に dpop_jkt を付けています。PKCE も OpenID Connect の nonce も使っていません。攻撃者は被害者の認可コードを盗み、自分のブラウザーでこのクライアントとの認可フローを始め、返ってきたコードを盗んだコードに差し替えました（認可コードの注入）。

この攻撃に対する評価として正しいものはどれですか？

- **A.** 攻撃者は DPoP の秘密鍵を持たない。そのため、dpop_jkt によってコードの引き換えは失敗する
- **B.** 攻撃者のセッションの state と一致しない。クライアントがリダイレクトの段階で拒否する
- **C.** クライアントが同じ鍵で引き換えるので dpop_jkt は一致する。PKCE などフローに結び付く対策が要る
- **D.** 認可コードはこのクライアントに発行されたものである。差し替えても、攻撃者は被害者の権限を得られない
- **E.** dpop_jkt は PKCE と同じ保護を常に提供する。この構成のままで十分である

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9700 §4.5.1 の注入攻撃では、攻撃者自身はコードを引き換えず、正規のクライアントが自分の認証情報でコードを引き換えます。この構成ではクライアントの鍵は 1 つなので、dpop_jkt の照合は成功します。RFC 9449 §10 は「The dpop_jkt authorization request parameter only provides similar protections when a unique DPoP key is used for each authorization request」と述べています。PKCE なら、コードは被害者のフローの code_challenge に結び付いているので、攻撃者のセッションの code_verifier では引き換えに失敗します（RFC 9700 §4.5.3.1）。B：攻撃者は自分で始めたフローの state を使うので一致します。D：攻撃者のセッションが被害者のリソースに結び付くことが、この攻撃の目的です。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [RFC 9700 §4.5・§4.5.1: 認可コードの注入攻撃の流れ](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L1157-L1203) / [RFC 9700 §4.5.3.1: PKCE による注入攻撃への対策](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L1270-L1288)

</details>

### 5-12. PAR で受け取った nonce

知識 / 選択式 / 1 点

AS は、PAR エンドポイントへの DPoP ヘッダー付きの要求に、400 の use_dpop_nonce と DPoP-Nonce: N1 を返しました。クライアントは N1 を含む proof で PAR 要求を再送して成功し、続いてトークン要求を送ります。

トークン要求の proof の nonce について、RFC 9449 の記述と矛盾しない扱いはどれですか？

- **A.** N1 を含む proof の htu は PAR エンドポイントなので、トークン要求でも htu を PAR エンドポイントにする
- **B.** N1 は同じ AS が提供した nonce なので、新しい値を受け取るまではトークン要求にも N1 を含める
- **C.** トークン要求の前に、トークンエンドポイントから別の nonce を必ず取得しなければならない
- **D.** PAR の後は nonce が不要になるので、トークン要求の proof では nonce を省略する
- **E.** N1 は PAR エンドポイント専用なので、トークン要求の proof には nonce を含めない

<details>
<summary>解答・解説</summary>

**正解：B**

§8.2 は「The client is expected to use the existing supplied nonce in DPoP proofs until the server supplies a new nonce value」と述べています。PAR エンドポイントもトークンエンドポイントも同じ AS なので、新しい値を受け取るまでは N1 を使います。§9 のとおり、nonce は発行したサーバーでだけ受理されます。N1 は AS が提供した nonce で、§4.2 は、サーバーが DPoP-Nonce を提供したら proof に nonce を含めることを MUST とし、§11.3 は nonce を提供した後に nonce のない proof を受理することを禁じています（E・D は誤り）。新しい nonce が必要なら、AS は use_dpop_nonce で提供でき、この仕組みは自己修復的です（§8）。A：トークン要求の proof の htu はトークンエンドポイントです。C：トークンエンドポイント用の nonce を事前に取得する手順はなく、既存の nonce を使い続けるという §8.2 の想定と食い違います。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [§11.3: nonce 提供後の nonce なし proof の受理禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1393-L1396) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203)

</details>

### 5-13. DPoP の challenge と resource_metadata

知識 / 選択式 / 1 点

DPoP の challenge と、RFC 9728 の resource_metadata パラメーターについて正しいものはどれですか？

- **A.** resource_metadata を受け取ったクライアントは、メタデータを取得せずに AS へ認可要求を送る
- **B.** DPoP の challenge では resource_metadata を使わず、algs のパラメーターにメタデータの URL を入れる
- **C.** resource_metadata は Bearer の challenge 専用であり、DPoP の challenge には含めてはならない
- **D.** resource_metadata を含む challenge には、algs など他のパラメーターを含めてはならない
- **E.** resource_metadata は Bearer 以外のスキームでも使え、DPoP の challenge にも含められる

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 9728 §5.1 は「This parameter MAY also be used in WWW-Authenticate responses using authorization schemes other than "Bearer" [RFC6750], such as the DPoP scheme defined by [RFC9449]」と述べています。RFC 9449 §7.1 も、challenge に追加のパラメーターを使ってよく（MAY）、未知のパラメーターは受信側が無視しなければならない（MUST）としているので、RFC 9728 を知らないクライアントとも共存できます。A：RFC 9728 §5 の流れでは、クライアントはメタデータを取得して検証します。D：RFC 9728 §5.1 は、resource_metadata を他の拡張のパラメーターと組み合わせてよい（MAY）としています。

**出典：** [RFC 9728 §5.1: WWW-Authenticate の resource_metadata](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L618-L643) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [RFC 9728 §5: WWW-Authenticate からメタデータを辿る流れ](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L517-L616)

</details>

### 5-14. 登録応答にない dpop_bound_access_tokens

誤り発見・原因特定 / 選択式 / 1 点

クライアントが動的クライアント登録で "dpop_bound_access_tokens": true を要求しました。登録応答には、このメタデータが含まれていませんでした。

正しい解釈はどれですか？

- **A.** 登録したメタデータはすべて返されるので、含まれていなければ既定値の false と考え、必要なら対処する
- **B.** 含まれていなければ、AS はこのクライアントに Bearer のトークンを一切発行できなくなる
- **C.** 要求した値はすべてそのまま登録される。応答に含まれていなくても、要求どおり true として扱ってよい
- **D.** dpop_bound_access_tokens は、登録応答には含めない決まりである。したがって問題はない
- **E.** 応答に含めないのは AS の仕様違反である。エラーとして扱い、登録をやり直さなければならない

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 7591 §3.2.1 は、AS は登録したメタデータをすべて返さなければならず（MUST）、要求された値を拒否したり別の値に置き換えたりできる（MAY）としています。クライアントは応答を見て、登録が使える状態か判断します。RFC 9449 §5.2 の dpop_bound_access_tokens は省略時 false です。したがって AS は、このクライアントからの DPoP ヘッダーのないトークン要求を、このメタデータを理由には拒否しません。E：AS は理解できないメタデータを無視しなければならず（RFC 7591 §2）、要求された値を拒否することもできるので（§3.2.1）、含まれていないこと自体は仕様違反ではありません。その後の対応は範囲外とされ、再登録は選択肢の 1 つにすぎません。

**出典：** [RFC 7591 §3.2.1: 登録済みメタデータの返却と値の置き換え](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7591.txt#L1096-L1110) / [§5.2: dpop_bound_access_tokens の既定値と要求](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L662-L682) / [RFC 7591 §2: 理解できないメタデータの無視と値の置き換え](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7591.txt#L641-L650)

</details>

### 5-15. クライアント認証と DPoP の alg

知識 / 選択式 / 1 点

AS のメタデータは "token_endpoint_auth_signing_alg_values_supported": ["RS256"]、"dpop_signing_alg_values_supported": ["ES256"] です。confidential client は private_key_jwt でクライアント認証を行い、DPoP も使います。

クライアントの構成として正しいものはどれですか？

- **A.** dpop_signing_alg_values_supported はクライアント認証にも適用されるので、両方を ES256 にする
- **B.** AS は RS256 を受け付けているので、DPoP の proof も同じ RSA 鍵の RS256 で署名する
- **C.** DPoP の proof をクライアント認証にも使えば、RS256 の鍵は不要になる
- **D.** クライアント認証の JWT は RS256（RSA 鍵）で、DPoP の proof は ES256（EC 鍵）で署名する
- **E.** DPoP の鍵とクライアント認証の鍵は同じにしなければならないので、両方を ES256 にする

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 8414 §2 の token_endpoint_auth_signing_alg_values_supported は、private_key_jwt などでクライアント認証に使う JWT の alg です。RFC 9449 §5.1 の dpop_signing_alg_values_supported は proof の alg で、両者は別の一覧です（B・A は誤り）。E：同じ鍵にする要件はなく、§11.11 は DPoP とクライアント認証が暗号的には結び付かないと述べています。C：DPoP はクライアント認証に使うものではありません（§1）。

**出典：** [§5.1: dpop_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L651-L660) / [RFC 8414 §2: token_endpoint_auth_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8414.txt#L262-L271) / [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§11.11: クライアント認証との暗号学的な結び付きの限界](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1536-L1548)

</details>

### 5-16. URL に現れる dpop_jkt

知識 / 選択式 / 1 点

フロントチャネルの認可要求（ブラウザーの URL）に dpop_jkt を含めるので、その値がブラウザーの履歴やログに残ります。

この点の評価として正しいものはどれですか？

- **A.** 問題にならない。公開鍵の Thumbprint で、知られても秘密鍵がなければ一致する proof を作れない
- **B.** 問題になる。dpop_jkt は秘密の値なので、認可要求ではなくトークン要求のパラメーターとして送る
- **C.** 問題になる。攻撃者が Thumbprint を自分のトークン要求の dpop_jkt に入れれば、被害者のコードを引き換えられる
- **D.** 問題になる。Thumbprint から公開鍵と秘密鍵を計算できるので、PAR や JAR で値を隠す必要がある
- **E.** 問題になる。Thumbprint を知った攻撃者は、その値を jkt に入れた proof を作ってトークン要求に使える

<details>
<summary>解答・解説</summary>

**正解：A**

§10 の dpop_jkt は公開鍵の JWK Thumbprint です。AS は、トークン要求の proof の jwk から Thumbprint を計算して比べ、その proof の署名も検証するので、一致する proof を作るには対応する秘密鍵が必要です。§11.9 が「The same JWK Thumbprint considerations apply」とするとおり、別の鍵で同じ Thumbprint を作れないことは §11.8 の第二原像計算困難性に依存しています。D：dpop_jkt は公開鍵のハッシュで秘密の値ではなく、ハッシュから鍵は計算できません。C：dpop_jkt は認可要求で示す値で（§10）、AS はそれをトークン要求の proof の鍵と照合します。攻撃者がトークン要求に値を入れても、照合には使われません。E：proof には jkt というクレームはなく、AS は jwk から計算します。B：dpop_jkt は秘密の値ではなく、§10 のとおり認可要求で送ります。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§11.8: JWK の第二原像計算困難性と ath の衝突耐性](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1466-L1480) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.9: 認可コードの盗難・再利用と dpop_jkt](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1482-L1514)

</details>

### 5-17. DPoP に対応しているか分からない AS

誤り発見・原因特定 / 選択式 / 1 点

public client が、DPoP に対応しているか分からない AS に DPoP ヘッダー付きでトークン要求を送りました。応答は token_type=Bearer で、refresh token も含まれていました。AS のメタデータに dpop_signing_alg_values_supported はありません。

正しい理解はどれですか？

- **A.** メタデータに記載がないのは、AS がすべての alg を受け付けるという意味である。DPoP は有効に働いている
- **B.** AS が DPoP ヘッダーを無視した可能性があり、鍵への結び付けは期待できない。保護が重要なら破棄する
- **C.** 有効な proof を示したので、§5 により refresh token は必ず鍵に結び付いている。refresh には同じ鍵を使う
- **D.** token_type=Bearer でも、DPoP ヘッダーを送った。アクセストークンも DPoP で保護されている
- **E.** token_type を DPoP と読み替える。Authorization: DPoP で使えば、保護が得られる

<details>
<summary>解答・解説</summary>

**正解：B**

§5 の refresh token の結び付け（MUST）は「When an authorization server supporting DPoP issues a refresh token to a public client that presents a valid DPoP proof」の場合で、DPoP に対応しない AS は、知らない DPoP ヘッダーを通常は無視します（RFC 9110 §5.1、C は誤り）。AS の DPoP への対応は §5.1 のメタデータで示されます。§5 は、token_type が DPoP でなければ DPoP による保護はなく、保護を重要とするなら応答を破棄しなければならないとしています。E：結び付けは AS が行うもので、クライアントが読み替えても生じません。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§5.1: dpop_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L651-L660) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [RFC 9110 §5.1: 認識できないヘッダーは無視する](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L1480-L1489)

</details>

### 5-18. PKCE と dpop_jkt の両方

知識 / 選択式 / 1 点

認可要求に code_challenge（S256）と dpop_jkt の両方を含めました。

トークン要求での AS の検証として正しいものはどれですか？

- **A.** code_verifier の検証に成功すれば十分である。dpop_jkt の不一致は、警告として記録するだけでよい
- **B.** dpop_jkt を使う場合は、code_challenge_method を S256 ではなく plain にしなければならない
- **C.** 両方を独立に検証する。code_verifier と dpop_jkt のどちらかの照合に失敗すれば、要求を拒否する
- **D.** proof の鍵の Thumbprint が dpop_jkt と一致すれば十分である。code_verifier の検証は省略できる
- **E.** code_challenge と dpop_jkt を同じ認可要求に含めることは、RFC 9449 で禁止されている

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9449 §10 は、dpop_jkt を PKCE と組み合わせてよい（MAY）とし、AS は proof の鍵の Thumbprint が dpop_jkt と一致しなければ拒否しなければならない（MUST）としています。RFC 7636 §4.6 は、code_verifier から計算した値が code_challenge と一致しなければ invalid_grant を返さなければならない（MUST）としています。2 つの仕組みは独立に検証します。B：RFC 7636 §4.2 は、S256 を使えるクライアントは S256 を使わなければならないとしています。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [RFC 7636 §4.2: code_challenge の作り方（S256）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7636.txt#L424-L460) / [RFC 7636 §4.6: トークンエンドポイントでの code_verifier の検証](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7636.txt#L533-L555)

</details>

### 5-19. メタデータを辿るアクセスの流れ

フロー構築 / 並べ替え / 2 点

クライアントが RS を事前に知らない状態から、DPoP-bound のトークンでリソースにアクセスするまでの流れを並べてください。

- **A.** クライアントが AS のメタデータを取得し、dpop_signing_alg_values_supported を確かめる
- **B.** クライアントがトークンを付けずに RS に要求する
- **C.** RS が 401 と WWW-Authenticate: DPoP algs="ES256", resource_metadata="…" を返す
- **D.** クライアントが保護されたリソースのメタデータを取得・検証し、authorization_servers と dpop_bound_access_tokens_required を確かめる
- **E.** Authorization: DPoP と、ath を含む新しい proof を付けて RS に再び要求する
- **F.** 認可コードを ES256 の proof 付きのトークン要求で引き換え、token_type=DPoP を確かめる

<details>
<summary>解答・解説</summary>

**正解：B → C → D → A → F → E**

RFC 9728 §5 の流れは、トークンなしの要求、resource_metadata を含む WWW-Authenticate、保護されたリソースのメタデータの取得と検証、AS のメタデータの取得、OAuth のフロー、トークン付きの再要求の順です。resource_metadata は DPoP の challenge にも含められます（§5.1）。DPoP の部分は、AS のメタデータで alg を確かめ（RFC 9449 §5.1）、proof 付きのトークン要求で token_type を確かめ（§5）、RS には ath を含む新しい proof を付けて送ります（§7）。

**出典：** [RFC 9728 §5: WWW-Authenticate からメタデータを辿る流れ](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L517-L616) / [RFC 9728 §5.1: WWW-Authenticate の resource_metadata](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L618-L643) / [RFC 9728 §2: bearer_methods_supported から DPoP 関連メタデータまで](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9728.txt#L227-L288) / [§5.1: dpop_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L651-L660) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 5-20. PAR・PKCE・DPoP を使う SPA の proof

ユースケース設計 / 記述式 / 8 点

SPA（public client）が PAR・PKCE・DPoP を使います。AS の PAR エンドポイントは https://as.example.com/par、トークンエンドポイントは https://as.example.com/token、RS は https://api.example.com/v1/items です。AS も RS も nonce を要求します。

PAR 要求、コードの引き換え、refresh、RS への要求のそれぞれで、DPoP の proof に入れる値（htm・htu・ath・nonce と、jti・iat の扱い）と、要求ごとに確かめる点（SPA としてブラウザーで必要になる設定を含む）を説明してください。

要求ごとに箇条書きで構いません。

<details>
<summary>解答・解説</summary>

**解答例**

PAR：htm=POST、htu=https://as.example.com/par、ath なし。PAR 要求に DPoP ヘッダーを付けると、dpop_jkt と同じくコードが鍵に結び付く（dpop_jkt も送るなら同じ鍵の Thumbprint）。code_challenge（S256）を送り、AS が要求したら nonce を含める。引き換え：htm=POST、htu=https://as.example.com/token、同じ鍵、AS の最新の nonce、code_verifier を送る。ath なし。応答の token_type=DPoP を確かめる。DPoP でなければ、保護を重要とするこの構成では応答を破棄する。refresh：htm=POST、htu はトークンエンドポイント、同じ鍵（public client の refresh token は鍵に結び付く）、AS の nonce。ath なし。RS：htm は実際のメソッド、htu=https://api.example.com/v1/items（query なし）、ath はアクセストークンのハッシュ、nonce は RS が提供した値（AS の nonce とは別）。すべての要求で新しい jti と現在の iat を使う。トークンは Authorization: DPoP で送り、Bearer に切り替えない。CORS では DPoP-Nonce と WWW-Authenticate を公開してもらう。

**採点基準（各 1 点）**

- PAR：htm=POST、htu=PAR エンドポイント、ath なし。DPoP ヘッダーでコードが鍵に結び付く（dpop_jkt を併記するなら同じ鍵）。
- PAR：code_challenge（S256）を送り、AS が要求したら nonce を含める。
- 引き換え：htm=POST、htu=トークンエンドポイント、同じ鍵、AS の nonce、code_verifier。ath なし。
- 応答の token_type が DPoP かを確かめる。DPoP でなければアクセストークンは DPoP で保護されないので、保護を重要とするなら応答を破棄する（§5）。
- refresh：htm=POST、htu=トークンエンドポイント、同じ鍵（refresh token が鍵に結び付く）、AS の nonce。ath なし。
- RS：実際のメソッド、query なしの htu、ath、RS が提供した nonce（AS とは別）。
- すべての要求で新しい jti と現在の iat を使い、proof を使い回さない。
- Authorization: DPoP で送り Bearer に切り替えない。CORS で DPoP-Nonce と WWW-Authenticate を公開してもらう。

**出典：** [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [RFC 9126 §2.1: PAR 要求のパラメーターとクライアント認証](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9126.txt#L284-L307) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§7.1: CORS でのヘッダー公開とプロキシ認証への使用禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L958-L968) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159)

</details>

<a id="part-6"></a>

## 第 6 部：方式比較と脅威モデル — mTLS・Bearer・セキュリティ BCP

20 問・32 点。mTLS（RFC 8705）や Bearer との違い、OAuth のセキュリティ BCP（RFC 9700）の推奨を踏まえ、DPoP が守る範囲と守らない範囲を、攻撃者の能力ごとに判断します。

### 6-01. 証明書の更新と結び付け

比較・使い分け / 選択式 / 1 点

クライアントが、同じ鍵ペアのまま証明書だけを更新しました（有効期限の延長）。mTLS（RFC 8705）で証明書に結び付いたアクセストークンと、DPoP で同じ鍵に結び付いたアクセストークンを持っています。

更新後の扱いとして正しいものはどれですか？

- **A.** どちらも使えなくなる。どちらの結び付けも、証明書の有効期限を含めた値をハッシュしているから
- **B.** mTLS のトークンは鍵が同じなので使える。DPoP のトークンは、証明書を更新したことを AS に伝えるまで使えない
- **C.** どちらも使える。x5t#S256 も jkt も、証明書ではなく公開鍵だけをハッシュした値で、鍵は同じだから
- **D.** mTLS のトークンは使えなくなる（x5t#S256 は証明書全体のハッシュ）。DPoP のトークンは同じ鍵なので使える
- **E.** mTLS のトークンは、新しい証明書の x5t#S256 をクライアントが cnf に追加すれば、そのまま使える

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 8705 §3.1 の x5t#S256 は「a base64url-encoded [RFC4648] SHA-256 [SHS] hash ... of the DER encoding [X690] of the X.509 certificate」で、証明書全体のハッシュです。§6.3 は「access tokens are invalidated when a client updates the certificate」と述べています。RFC 9449 の jkt は公開鍵の JWK Thumbprint で（§6.1）、証明書を使いません。C：RFC 9700 §4.10.1 は mTLS を「the fingerprint of its public key」で説明していますが、RFC 8705 §3.1 の x5t#S256 は証明書全体のハッシュなので、同じ鍵でも証明書を更新すれば値が変わります。A：jkt は公開鍵の JWK Thumbprint で、証明書の有効期限は入りません。B：DPoP の結び付けは証明書に関係せず、更新を AS に伝える仕組みもありません。E：cnf は AS が署名したトークンの中身で、クライアントは変更できません。

**出典：** [RFC 8705 §3.1: cnf の x5t#S256 は証明書全体の SHA-256](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L444-L477) / [RFC 8705 §6.3: 証明書の更新とアクセストークン](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L701-L709) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [RFC 9700 §4.10.1: 送信者制約の仕組みと限界](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L1597-L1659)

</details>

### 6-02. mTLS を求めるタイミング

比較・使い分け / 選択式 / 1 点

RFC 8705 の仕組みで、証明書に結び付いたトークンを扱う RS が、DPoP の RS にはない制約として抱えるものはどれですか？

- **A.** TLS のハンドシェイクで証明書と照合するので、アクセストークンの cnf を確かめるまでハンドシェイクを始められない
- **B.** cnf に証明書のハッシュを入れる必要があるので、証明書に結び付いたトークンは JWT 形式でなければならない
- **C.** 証明書の情報は TLS 層にしかないので、証明書に結び付いたトークンは introspection で結び付けの情報を得られない
- **D.** トークンは RS ごとに結び付くので、RS ごとに、トークンエンドポイントとは別のクライアント証明書を使う必要がある
- **E.** クライアント証明書を求めるかはハンドシェイクで決まるので、アクセストークンを見てから mTLS を求められない

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 8705 §3 は、RS は mTLS を使うことを事前に知っている必要があり、アクセストークンは TLS から見るとハンドシェイクの後のアプリケーションデータなので、mTLS を求めるかの判断に使えないと述べています。そのため、すべてのリソースで mTLS を求めるか、ホスト名とポートを分けることが多いとされます。TLS 1.2 の再ネゴシエーションや TLS 1.3 の post-handshake 認証で後から証明書を示す機会もあり得ますが、RFC 8705 はその利用を定めていません。DPoP は要求ごとにアプリケーション層で proof を検証します（RFC 9449 §1・§4）。A：ハンドシェイクは要求より先に行われ、RS は TLS 層から得た証明書をトークンと照合します（§3）。D：トークンエンドポイントで使ったものと同じ証明書を使います（§3）。C：§3.2 は、introspection の応答で cnf の x5t#S256 を返す方法を定めています。B：§3.1 は JWT で表す場合の書き方で、§3.2 には introspection での表現もあります。

**出典：** [RFC 8705 §3: 証明書に結び付いたアクセストークンと RS の事前準備](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L390-L442) / [RFC 8705 §3.1: cnf の x5t#S256 は証明書全体の SHA-256](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L444-L477) / [RFC 8705 §3.2: introspection の応答での x5t#S256](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L479-L494) / [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 6-03. public client の refresh token の結び付け

比較・使い分け / 選択式 / 1 点

public client に発行する refresh token の送信者制約について、RFC 9449（DPoP に対応する AS が有効な proof を受け取った場合）と RFC 8705（mTLS）の要件の強さの組み合わせとして正しいものはどれですか？

- **A.** DPoP：鍵に結び付けなければならない（MUST）　mTLS：証明書に結び付けるべきである（SHOULD）
- **B.** DPoP：鍵に結び付けなければならない（MUST）　mTLS：証明書に結び付けてはならない（MUST NOT）
- **C.** DPoP：鍵に結び付けてもよい（MAY）　mTLS：証明書に結び付けるべきである（SHOULD）
- **D.** DPoP：鍵に結び付けるべきである（SHOULD）　mTLS：証明書に結び付けなければならない（MUST）
- **E.** DPoP：鍵に結び付けなければならない（MUST）　mTLS：証明書に結び付けなければならない（MUST）

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 9449 §5 は、DPoP に対応する AS が有効な proof を示した public client に refresh token を発行するとき、鍵への結び付けを MUST とし、使用時の検証も MUST としています。RFC 8705 §4 は「When the authorization server issues a refresh token to such a client, it SHOULD also bind the refresh token to the respective certificate」です。confidential client については、どちらもクライアント認証による制約に任せています（RFC 9449 §5、RFC 8705 §7.1）。なお RFC 9700 §4.14.2 は、public client の refresh token に送信者制約かローテーションのどちらかを求めています。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [RFC 8705 §4: public client と refresh token の結び付け（SHOULD）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L548-L573) / [RFC 8705 §7.1: confidential client の refresh token](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L737-L750) / [RFC 9700 §4.14.2: refresh token の保護（送信者制約またはローテーション）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L1965-L2009)

</details>

### 6-04. TLS を終端するプロキシ

比較・使い分け / 選択式 / 1 点

AS と RS の前に、TLS を終端するリバースプロキシがあります。

mTLS（RFC 8705）と DPoP を比べた説明として正しいものはどれですか？

- **A.** mTLS も DPoP も、プロキシで TLS を終端すると送信者制約が使えなくなる。どちらも、TLS の接続そのものにトークンの鍵を結び付ける仕組みだから
- **B.** mTLS は、プロキシが受け取った証明書の情報をアプリへ安全に渡す方法が別に要る。DPoP の proof はヘッダーで届き、htu は外部の URI で照合する
- **C.** mTLS では、プロキシが証明書を検証すれば、アプリはトークンとの結び付けを確かめなくてよい。DPoP は htu を内部の URI で照合する
- **D.** DPoP の proof は TLS のセッションに結び付くので、プロキシで TLS を終端すると検証できない。この構成で使えるのは mTLS だけである
- **E.** DPoP では、プロキシがクライアントの代わりに、内部の URI に合わせて proof を作り直す。mTLS では、証明書の情報はアプリに要らない

<details>
<summary>解答・解説</summary>

**正解：B**

RFC 8705 §6.5 は、TLS をロードバランサーなどで終端してよいが、証明書の情報を中間装置からアプリケーションへ安全に伝える方法は範囲外だと述べています。DPoP はアプリケーション層の仕組みで（RFC 9449 §1）、proof は DPoP ヘッダーで届きます。ただし htu は要求の URI と照合します（§4.3）。RFC 9110 §7.1 のとおりサーバーは受け取った要素とローカルの設定から target URI を再構成するので、プロキシの後ろでは、クライアントが使った外部の URI を再構成するよう設定する必要があります。A：DPoP はアプリケーション層の仕組みで、TLS の接続に鍵を結び付けません。D：proof は TLS のセッションに結び付かず、プロキシの後ろでも検証できます。C：RS はトークンに結び付いた証明書との一致を確かめなければなりません（RFC 8705 §3）。E：プロキシは秘密鍵を持ちません。

**出典：** [RFC 8705 §6.5: TLS 終端と証明書情報の受け渡し](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L727-L733) / [RFC 8705 §3: 証明書に結び付いたアクセストークンと RS の事前準備](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L390-L442) / [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 9110 §7.1: target URI とサーバーによる再構成](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L2370-L2410)

</details>

### 6-05. セキュリティ BCP と refresh token

知識 / 選択式 / 1 点

RFC 9700（OAuth 2.0 セキュリティ BCP）の、public client の refresh token に関する要件として正しいものはどれですか？

- **A.** public client には refresh token を発行してはならず、必要なら再認可を求めなければならない
- **B.** DPoP による送信者制約を使わなければならない。ローテーションは、送信者制約の代わりにならない
- **C.** 送信者制約か refresh token のローテーションの、少なくともどちらかを使わなければならない
- **D.** 送信者制約と refresh token のローテーションの両方を、同時に使わなければならない
- **E.** confidential client の refresh token にも、mTLS や DPoP による送信者制約が必要である

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9700 §2.2.2 は「Refresh tokens for public clients MUST be sender-constrained or use refresh token rotation」と定め、§4.14.2 は AS がそのどちらかの方法で refresh token のリプレイを検出しなければならないとし、送信者制約の例に RFC 8705 と RFC 9449 を挙げています。A：refresh token を発行するかは、AS がリスク評価で決めます。E：confidential client の refresh token は、RFC 6749 がすでに発行先のクライアントだけが使えるよう求めています。

**出典：** [RFC 9700 §2.2: アクセストークンと refresh token の送信者制約](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L369-L389) / [RFC 9700 §4.14.2: refresh token の保護（送信者制約またはローテーション）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L1965-L2009) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

### 6-06. implicit グラントのトークン

知識 / 選択式 / 1 点

SPA が implicit グラント（response_type=token）でアクセストークンを受け取っています。このトークンを DPoP で送信者制約したいと考えています。

正しい評価はどれですか？

- **A.** RS へ最初に proof を付けて送る。RS がそのときの鍵に、受け取ったトークンを結び付ける
- **B.** ブラウザーの遷移で送る認可要求に、DPoP ヘッダーを付ける。返るアクセストークンが、その鍵に結び付く
- **C.** 認可要求の dpop_jkt に鍵の Thumbprint を入れる。フラグメントで返るアクセストークンも、その鍵に結び付けられる
- **D.** implicit グラントのままでよい。認可応答で token_type=DPoP が返れば、送信者制約されている
- **E.** 認可応答のトークンを送信者制約する標準の方法はない。認可コードフローでトークンエンドポイントから受け取る

<details>
<summary>解答・解説</summary>

**正解：E**

RFC 9700 §2.1.2 は「no standardized method for sender-constraining exists to bind access tokens to a specific client ... when the access tokens are issued in the authorization response」と述べ、認可コードなどトークンエンドポイントでトークンを発行する方式を勧めています。RFC 9449 の結び付けは、proof を付けたトークン要求で AS が行います（§5）。C：dpop_jkt が結び付けるのは認可コードです（§10）。B：RFC 9449 が AS への DPoP ヘッダーを定めているのは、トークンエンドポイント（§5）や PAR（§10.1）へクライアントが直接送る要求です。ブラウザーの遷移では任意のヘッダーを付けられません。A：結び付けは発行時に AS が決めます。D：認可応答で token_type=DPoP を返して結び付ける標準の仕組みはありません。

**出典：** [RFC 9700 §2.1.2: implicit グラントのトークンは送信者制約できない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L340-L367) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308)

</details>

### 6-07. DPoP が防がないもの

比較・使い分け / 選択式 / 1 点

非抽出の鍵（WebCrypto）を使う SPA で、DPoP が防がない（RFC 9449 の範囲外とされる）ものはどれですか？（RS はすべて DPoP に対応しているものとします）

- **A.** 攻撃者がクライアントのオリジンでコードを実行し、オンラインのクライアントの鍵で proof を作って使うこと
- **B.** XSS で持ち出された refresh token だけを、XSS の修正後に、攻撃者が自分の端末から使うこと
- **C.** 悪意のある RS が、クライアントから受け取ったトークンと proof を、DPoP に対応した別の RS へ送って使うこと
- **D.** サーバーのログから漏れたアクセストークンを、攻撃者が自分の端末から、自分の鍵の proof を付けて使うこと
- **E.** 圧縮を使った攻撃（CRIME・BREACH など）で TLS の通信から漏れたトークンを、攻撃者が使うこと

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 9449 §2 は、XSS がクライアントの実行環境で署名鍵を使い、トークンと一緒に使う proof を作れることを挙げ、「there is most likely no feasible defense against this threat except generally preventing XSS; therefore, it is considered out of scope for DPoP」と述べています。D：攻撃者の鍵の proof は、トークンに結び付いた鍵と一致しません（§4.3）。E・B：トークンだけが漏れた場合は、鍵がないので使えません（§2）。C：悪意のある RS は別の RS 向けの proof を作れず、proof は URI に結び付きます（§2・§11）。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433) / [§11: URI・メソッドへの結び付けと TLS 方式との違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1310-L1320) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 6-08. public client の鍵の入れ替え

ユースケース設計 / 選択式 / 1 点

public client の SPA が、定期的に DPoP の鍵ペアを新しくしたいと考えています。現在のアクセストークンと refresh token は古い鍵に結び付いています。

鍵を入れ替えるときの扱いとして正しいものはどれですか？

- **A.** RFC 9449 が定める鍵の更新用のパラメーターを使う。AS に新しい鍵の Thumbprint を登録し、トークンを新しい鍵へ移す
- **B.** 鍵は proof ごとに新しくするのが最も安全である。要求のたびに鍵を替えて、同じトークンを使い続ける
- **C.** 新しい鍵のトークンは、新しい鍵の proof を付けた再認可などで得る。古い refresh token は新しい鍵では使えない
- **D.** 新しい鍵の proof を付けて古い refresh token を使う。AS が新しい鍵に結び付け直すので、再認可は要らない
- **E.** 古い鍵で署名した proof の jwk に、新しい公開鍵を入れて送る。AS が、両方の鍵にトークンを結び付ける

<details>
<summary>解答・解説</summary>

**正解：C**

§5 により、public client の refresh token は発行時の鍵に結び付き、使うたびに同じ鍵の proof を示さなければなりません（MUST）。新しい鍵の proof では使えません（D）。RFC 9449 に鍵の更新の仕組みはありません（A）。E：§4.3 の 6 番目のとおり、署名は jwk の鍵で検証します。B：トークンは 1 つの鍵に結び付くので、要求ごとに鍵を替えると使えなくなります。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 6-09. 同じ鍵で作る 2 種類の JWT

ユースケース設計 / 選択式 / 1 点

confidential client が、private_key_jwt のクライアント認証と DPoP の proof に同じ EC 鍵を使っています。AS の担当者は、同じ鍵で署名した 2 種類の JWT が取り違えられないかを心配しています。

取り違えを防ぐ考え方として、仕様の記述と一致するものはどれですか？

- **A.** クライアント認証の JWT にも typ=dpop+jwt を付ける。どちらの検証処理でも受理されるので、取り違えが問題にならない
- **B.** proof には jwk ヘッダーがある。そのため、どの検証処理でも、クライアント認証の JWT と取り違えられることはない
- **C.** 同じ鍵を使うことは RFC 9449 で禁止されているので、鍵を分けるしかない。検証規則の工夫では防げない
- **D.** DPoP は typ=dpop+jwt と htm・htu を、クライアント認証は aud などを検証する。相互排他的な検証規則で防ぐ
- **E.** 同じ鍵を使えば、DPoP とクライアント認証が暗号的に結び付く。そのため、取り違えは問題にならない

<details>
<summary>解答・解説</summary>

**正解：D**

RFC 8725 §3.12 は、同じ発行者が複数の種類の JWT を発行する場合、検証規則を相互排他的にしなければならない（MUST）とし、明示的な型付け、必須クレームの違い、鍵の使い分け、aud の違いなどを方法として挙げています。DPoP の検証は typ と htm・htu などを確かめ（RFC 9449 §4.3・§11.5）、クライアント認証の JWT の検証は aud などを確かめます（RFC 7523 §3）。C：RFC 9449 に禁止の規定はありません。B：ヘッダーの違いは、そのヘッダーを確かめる検証処理でしか区別に使えません。クライアント認証の JWT の検証（RFC 7523 §3）は jwk ヘッダーを見ないので、jwk があるだけでは「どの検証処理でも」とは言えません（typ について RFC 8725 §3.11 が述べる注意と同じです）。A：両方の検証処理で受理されることこそが取り違えで、型は種類を区別するために付けます。E：§11.11 のとおり、DPoP とクライアント認証は暗号的に結び付きません。

**出典：** [RFC 8725 §3.12: 種類ごとに相互排他的な検証規則](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L471-L512) / [§11.5: typ による別用途 JWT の受理防止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1435-L1439) / [RFC 7523 §3: クライアント認証の JWT に必須の iss・sub・aud・exp](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7523.txt#L271-L329) / [§11.11: クライアント認証との暗号学的な結び付きの限界](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1536-L1548) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 8725 §3.11: 明示的な型付けとその限界](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8725.txt#L440-L469)

</details>

### 6-10. ログから盗まれた proof

ユースケース設計 / 選択式 / 1 点

RS の前の API ゲートウェイが、要求ヘッダーをすべてログに記録していました。攻撃者はログから、アクセストークンと DPoP proof の組を入手しました。proof の受理期間は 60 秒で、RS は jti を記録していません。

攻撃者ができることと対策の組み合わせとして正しいものはどれですか？

- **A.** 受理期間のうちでも、同じ proof の再送はできない。iat の照合だけで、2 回目を拒否できる
- **B.** 同じメソッド・URI への同じ proof の再送は、受理期間のうちなら通り得る。jti の記録で 2 回目を拒否できる
- **C.** ath がトークンと proof を結び付けるので、同じ proof の再送も拒否される。追加の対策は要らない
- **D.** proof の jwk を使えば、盗んだトークンで新しい proof を作り、任意の API を呼べる。nonce を使えば、これを防げる
- **E.** proof は htu と異なる URI へも再送できる。RS が htu の照合を厳しくすれば、この再送を防げる

<details>
<summary>解答・解説</summary>

**正解：B**

§11.1 は、proof を入手した攻撃者は同じエンドポイントで再送できるとし、サーバーは生成後の限られた時間だけ proof を受理しなければならず（MUST）、対象 URI の文脈で jti を記録すれば 2 回目を拒否できると述べています。D：jwk は公開鍵で、秘密鍵がないので新しい proof は作れません。E：proof は htm・htu でメソッドと URI に結び付き、RS はそれを照合します（§4.3）。C：§7 は「the ath field alone does not prevent replay of the DPoP proof」と述べています。A：iat は時刻の範囲を限るだけです。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 6-11. 悪意のある RS によるトークンの転用

知識 / 選択式 / 1 点

悪意のある RS-A が、クライアントから受け取ったアクセストークンと proof を、同じトークンを受け付ける、DPoP に対応した別の RS-B に、DPoP 方式のまま送りました。

RS-B での結果として正しいものはどれですか？

- **A.** RS-A が proof の htu を RS-B の URI に書き換えれば、署名を作り直さなくても受理される
- **B.** proof の htu が RS-A の URI なので拒否される。RS-A は鍵を持たず、RS-B 向けの proof も作れない
- **C.** RS-B は RS-A からの接続を信頼しないので、トークンを検証する前に、TLS の段階で接続を拒否する
- **D.** ath がトークンと一致するので受理される。aud でトークンを制限しない限り、この転用は防げない
- **E.** jwk の公開鍵がトークンの結び付けと一致するので受理される。nonce を使わない限り防げない

<details>
<summary>解答・解説</summary>

**正解：B**

§2 は、送信者制約で、別のエンドポイントでのトークンの再利用を防げると述べています。§11 はその仕組みを、サーバーの認証と、proof を特定の URI とメソッドに結び付けることだと説明しています。RS-A は受け取った proof の htu を変えられず（変えると署名が合いません：A）、秘密鍵がないので新しい proof も作れません。D：ath はトークンと proof の結び付けで、URI の照合を省く理由になりません。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§11: URI・メソッドへの結び付けと TLS 方式との違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1310-L1320) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 6-12. Bearer で送ったトークンの漏えい

比較・使い分け / 選択式 / 1 点

クライアントは、WWW-Authenticate: Bearer だけを返す DPoP を知らない RS-X に、DPoP-bound のアクセストークンを Bearer 方式で送っています。同じトークンは、Bearer と DPoP の両方に対応する RS-Y でも使えます。

RS-X からトークンが漏れた場合の評価として正しいものはどれですか？

- **A.** RS-X で Bearer として使われた時点で、AS がトークンを失効させる。そのため、どの RS でも使えない
- **B.** RS-X への要求に付いていた proof がある。攻撃者はそれを使って、RS-Y に DPoP 方式でアクセスできる
- **C.** DPoP-bound のトークンである。攻撃者は鍵を持たないので、RS-X を含め、どの RS でも使えない
- **D.** RS-X のような RS では使える。RS-Y は Bearer で届いた DPoP-bound トークンを拒否するので使えない
- **E.** RS-Y でも Bearer 方式で送れば使える。RS-Y はトークンが DPoP-bound かどうかを判断できないから

<details>
<summary>解答・解説</summary>

**正解：D**

§7.2 は、DPoP を知らない RS は DPoP-bound トークンを Bearer として受理すると考えられ、Bearer と DPoP の両方に対応する RS は Bearer として届いた DPoP-bound トークンを拒否しなければならない（MUST）と述べています。したがって DPoP の保護は、DPoP を理解する RS でだけ働きます。RFC 7800 §4 も、cnf を理解しない受信者があり得るので、所持の証明を必要とするアプリケーションは処理を実装するよう求めています。A：RFC 9449 に、そのような失効の仕組みはありません。B：Bearer 方式で送る要求には通常 proof を付けません。付いていたとしても、proof の htu は RS-X の URI なので RS-Y では照合に失敗し（§4.3）、攻撃者は新しい proof も作れません。

**出典：** [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [RFC 7800 §4: 所持証明とオーディエンス制限は別の保護](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7800.txt#L531-L576) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 6-13. サーバーの時刻を入れた nonce

ユースケース設計 / 選択式 / 1 点

AS は、サーバーの時刻を暗号化して完全性も保護した値を nonce として配り、受け取った nonce を復号して 5 分以内なら有効とする設計にしました。nonce の状態はサーバーに保存しません。

この設計について、RFC 9449 の記述と一致するものはどれですか？

- **A.** nonce はクライアントが解析して、有効期限を知るためのものである。時刻は平文で入れる
- **B.** nonce にサーバーの時刻が入るので、iat は不要になる。proof の iat クレームは省略してよい
- **C.** nonce は 1 回しか使えない値である。同じ nonce の proof が 2 回届いたら、jti が違っても拒否する
- **D.** 時刻を入れた nonce は予測できる値になる。暗号化しても、予測できない値を求める RFC 9449 の要件に反する
- **E.** nonce 内の時刻で proof の寿命を制限でき、時計のずれにも強い。再送は、その期間 jti を記録して防ぐ

<details>
<summary>解答・解説</summary>

**正解：E**

§11.1 は、サーバーの時刻を含む nonce で proof の寿命を制限でき（MAY）、大きな時計のずれがあっても同じ結果になると述べています。また、暗号の nonce と違い、同じ nonce を複数回使うことも受理することも許容され、nonce の有効期間のあいだ jti を記録して重複を拒否すれば、リプレイの危険は増えないとしています（C は誤り）。D：§8 の「予測できない」は値についての要件で、時刻を暗号化すれば予測できない値にできます。B：iat は必須クレームです（§4.2）。A：nonce はクライアントにとって opaque です（§8）。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 6-14. Bearer・mTLS・DPoP の違い

比較・使い分け / 選択式 / 1 点

Bearer・mTLS（RFC 8705）・DPoP の性質の組み合わせとして正しいものはどれですか？

- **A.** Bearer：持っていれば使える　mTLS：要求ごとに署名した proof で鍵を証明する　DPoP：TLS 接続でクライアント証明書の鍵を証明する
- **B.** Bearer：client_secret と一緒に使う　mTLS：TLS 接続でクライアント証明書の鍵を証明する　DPoP：要求ごとに署名した proof で鍵を証明する
- **C.** Bearer：持っていれば使える　mTLS：TLS 接続でクライアント証明書の鍵を証明する　DPoP：要求ごとに署名した proof で鍵を証明する
- **D.** Bearer：持っていれば使える　mTLS：TLS 接続でクライアント証明書の鍵を証明する　DPoP：アクセストークンを公開鍵で暗号化して送る
- **E.** Bearer：持っていれば使える　mTLS：証明書そのものをアクセストークンに埋め込んで送る　DPoP：要求ごとに署名した proof で鍵を証明する

<details>
<summary>解答・解説</summary>

**正解：C**

RFC 9449 §2 は、Bearer トークンは持っている者なら誰でも使え、DPoP は発行時にトークンを公開鍵に結び付けて、使うときに秘密鍵の所持を証明させると述べています。proof は要求ごとに作ります（§4）。RFC 8705 §3 では、RS は TLS 層からクライアント証明書を取得し、トークンに結び付いた証明書と一致するかを確かめます。トークンに入るのは証明書のハッシュ（x5t#S256）です（E は誤り）。D：DPoP はトークンを暗号化しません。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [RFC 8705 §3: 証明書に結び付いたアクセストークンと RS の事前準備](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L390-L442) / [RFC 8705 §3.1: cnf の x5t#S256 は証明書全体の SHA-256](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L444-L477)

</details>

### 6-15. 送信者制約の限界

知識 / 選択式 / 1 点

RFC 9700 §4.10.1 は、送信者制約されたトークンの保護が損なわれる場合について何と述べていますか？

- **A.** トークンと鍵の両方を得られると損なわれる。鍵がモジュールにあれば、クライアントのオフライン中の利用は防げる
- **B.** 送信者制約が守るのはアクセストークンだけである。refresh token の保護には当てはまらない
- **C.** トークンだけが漏れた場合に損なわれる。送信者制約されたトークンも、鍵がなくてもすぐに悪用される
- **D.** 鍵がセキュリティモジュールにあれば安全である。XSS などでクライアントが侵害されても、トークンの悪用はすべて防げる
- **E.** 送信者制約で、トークンの転用は防げる。そのため、オーディエンス制限は不要になると述べている

<details>
<summary>解答・解説</summary>

**正解：A**

RFC 9700 §4.10.1 は「the security of sender-constrained tokens is undermined when an attacker gets access to the token and the key material」とし、鍵がハードウェアやソフトウェアのセキュリティモジュールにある場合などは「sender-constrained tokens at least protect against the use of the token when the client is offline」と述べ、これはアクセストークンにも refresh token にも当てはまるとしています。D：クライアントが侵害されてオンラインのあいだは鍵を使われます（RFC 9449 §11.4）。ただし DPoP で nonce を使わない場合、攻撃者がクライアントを操作できたあいだに事前生成した proof があれば、クライアントがオフラインでもトークンを使われ得ます（RFC 9449 §11.2・§11.4）。C：トークンだけでは鍵がないので使えません。E：§4.10 は、AS がアクセストークンを送信者制約し、かつオーディエンス制限すべきである（SHOULD）としています。

**出典：** [RFC 9700 §4.10.1: 送信者制約の仕組みと限界](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L1597-L1659) / [RFC 9700 §4.10: アクセストークンの送信者制約とオーディエンス制限（SHOULD）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9700.txt#L1585-L1595) / [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433) / [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391)

</details>

### 6-16. 持ち出された proof で使える期間

ユースケース設計 / 選択式 / 1 点

一時的な XSS で、攻撃者が現在のアクセストークン（有効期間 5 分）、refresh token（有効期間 30 日）、AS と RS 向けに 30 日分の iat で事前生成した proof を持ち出しました。AS も RS も nonce を使っていません。XSS はすぐに修正されました。鍵は抽出できません。

修正後に攻撃者ができることとして正しいものはどれですか？

- **A.** RS 向けの proof を ath なしで事前生成しておく。そうすれば、新しいアクセストークンとも組み合わせて使える
- **B.** 事前生成した proof と refresh token で新しいアクセストークンを得続け、30 日間 RS にアクセスし続けられる
- **C.** 盗んだトークンは期限の 5 分まで使える。新しく得たトークン用の proof（ath）はないので、RS では使えない
- **D.** 鍵を抽出できないので、盗んだアクセストークンも事前生成した proof も、XSS の修正後は一度も使えない
- **E.** 持ち出した refresh token を、自分の鍵の proof で使い直す。AS が攻撃者の鍵に結び付け直し、30 日間使える

<details>
<summary>解答・解説</summary>

**正解：C**

§11.2 は、ath によって事前生成した proof の利用はアクセストークンの有効期間に限られ、nonce を使わないデプロイメントは長命のアクセストークンを発行すべきでない（SHOULD NOT）としています。攻撃者は refresh token で新しいアクセストークンを得る proof は事前生成できても、新しく発行されたアクセストークン用の proof は現実的に作れません。D：現在のトークンの ath を含む proof は事前に作れるので、トークンの期限までは使えます。A：RS は ath を必須とします（§7）。E：public client の refresh token は発行時の鍵に結び付いています（§5）。

**出典：** [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391) / [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

### 6-17. SPA で DPoP を使う理由

知識 / 選択式 / 1 点

RFC 9449 §1 が、ブラウザーで動く SPA で mTLS ではなく DPoP を使う理由として挙げているものはどれですか？

- **A.** ブラウザーでの TLS クライアント認証は使い勝手が悪く、HTTP の Token Binding もサポートされていないため
- **B.** ブラウザーは秘密鍵を安全に扱えないので、DPoP では鍵を AS が生成して管理するため
- **C.** mTLS では、ブラウザーで動く public client の refresh token を送信者制約できないため
- **D.** DPoP は HTTPS を使わずアプリケーション層だけで動き、ブラウザーでの TLS クライアント認証の制約を受けないため
- **E.** RFC 8705 が、public client で証明書に結び付いたトークンを使うことを、明示的に禁止しているため

<details>
<summary>解答・解説</summary>

**正解：A**

§1 は「due to a sub-par user experience of TLS client authentication in user agents and a lack of support for HTTP token binding, neither mechanism can be used if an OAuth client is an application that is dynamically downloaded and executed in a web browser」と述べています。E：RFC 8705 §4 は public client での証明書に結び付いたトークンを説明しています。D：DPoP は常に HTTPS と併用しなければなりません（§2）。C：RFC 8705 §4 は refresh token の結び付けを SHOULD としています。B：秘密鍵はクライアントが持ちます。

**出典：** [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [RFC 8705 §4: public client と refresh token の結び付け（SHOULD）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L548-L573) / [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253)

</details>

### 6-18. TLS ベースの方式とのリプレイ対策の違い

比較・使い分け / 選択式 / 1 点

DPoP では proof の受理期間・jti・nonce によるリプレイ対策が必要になる一方、mTLS のような TLS ベースの方式は、こうした対策を別に設けていません。RFC 9449 §11 の説明に沿う理由はどれですか？

- **A.** mTLS では RS が同じアクセストークンを 1 回しか受理しないので、アクセストークンの再送が起きないため
- **B.** DPoP の proof は TLS の外で送るので HTTPS で保護されず、途中で盗まれやすく、再送されやすいため
- **C.** DPoP の proof は暗号化されずに送られるが、mTLS で使うアクセストークンは、証明書の鍵で暗号化されて送られるため
- **D.** mTLS のクライアント証明書には jti に相当する値が含まれ、ハンドシェイクごとに更新されるので、再送を検出できるため
- **E.** TLS ベースの方式は TLS 層とアプリケーション層の統合で再送を防げるが、DPoP の proof は入手した者が再送できるため

<details>
<summary>解答・解説</summary>

**正解：E**

§11 は「DPoP has a somewhat different nature of protection than TLS-based methods」とし、「TLS-based mechanisms can leverage a tight integration between the TLS layer and the application layer to achieve strong message integrity, authenticity, and replay protection」と述べています。§11.1 のとおり、proof を入手した者は同じエンドポイントで再送できます。D・A：そのような仕組みはありません。C：どちらも TLS で保護され、mTLS がアクセストークンを証明書の鍵で暗号化する仕組みはありません。B：DPoP は常に HTTPS と併用します（§2）。

**出典：** [§11: URI・メソッドへの結び付けと TLS 方式との違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1310-L1320) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253)

</details>

### 6-19. 攻撃者ごとの保護範囲

ユースケース設計 / 記述式 / 8 点

SPA（非抽出の鍵）と API で DPoP を使います。AS も RS も nonce を使わず、アクセストークンの有効期間は 10 分、refresh token は 7 日です。同じ AS が発行したアクセストークンは、DPoP に対応していない古い API も Bearer として受け付けます。

次の 4 つの攻撃者について、DPoP が防ぐ範囲と防げない範囲、追加で必要な対策を説明してください。  
(1) サーバーのログからトークンだけを入手した攻撃者  
(2) ログからトークンと proof の組を入手した攻撃者  
(3) 一時的に XSS を実行できた攻撃者  
(4) 悪意のある RS

番号ごとに 1〜3 行で構いません。

<details>
<summary>解答・解説</summary>

**解答例**

(1) DPoP に対応した API では、鍵がないので proof を作れず、トークンは使えない。ただし DPoP に対応していない古い API は DPoP-bound のトークンを Bearer として受け付けると考えられるので（§7.2）、そこでは使われ得る。aud でトークンの宛先を限る（RFC 7800 §4）か、古い API を DPoP に対応させる。(2) 同じメソッド・URI への同じ proof の再送は、受理期間のうちなら通り得る。jti を記録して 2 回目を拒否する（複数台なら共有の状態が必要）。受理期間の短縮や nonce も再送の機会を減らす。(3) XSS の実行中は鍵を使って proof を作れるので防げない（範囲外）。CSP などで XSS を防ぐ。RS 向けに事前生成した proof は、ath によりそのアクセストークンの期間（10 分）に限られ、新しく得たトークンには使えない。ただし AS 向けに事前生成した proof と refresh token で、新しいトークンを得ることはできる。さらに防ぐには nonce で proof の寿命を制限する。silent な認可で攻撃者の鍵に結び付いたトークンは、XSS の修正後も refresh token の有効期間（7 日）のあいだ使われ得る。(4) 受け取った proof は htu が自分の URI なので、DPoP に対応した別の RS では使えず、新しい proof も作れない。ただし古い API では Bearer として使われ得るので、(1) と同じ対策が要る。

**採点基準（各 1 点）**

- (1) DPoP に対応した API では、トークンだけでは proof を作れないので使えないと説明する。
- (2) 同じメソッド・URI への同じ proof の再送は受理期間のうちなら通り得ると説明する。
- (2) 対策として、jti の記録による 2 回目の拒否（複数台では状態の共有が必要）を挙げる。受理期間の短縮や nonce を併せて挙げてもよい。
- (3) XSS の実行中は鍵で proof を作れるので防げず、XSS の防止（CSP など）が必要だと説明する。
- (3) RS 向けに事前生成した proof は、ath によりそのアクセストークンの期間に限られ、新しく得たトークンには使えないと説明する。
- (3) nonce で proof の寿命を制限する対策、または silent な認可で攻撃者の鍵に結び付いたトークンが XSS の修正後も使われ得ることを挙げる。
- (4) proof は RS の URI に結び付き、RS は新しい proof を作れないので、DPoP に対応した別の RS では使えないと説明する。
- (1)・(4) DPoP に対応していない古い API ではトークンが Bearer として使われ得ると説明し、aud による制限や古い API の DPoP 対応などの対策を挙げる。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433) / [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391) / [§11: URI・メソッドへの結び付けと TLS 方式との違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1310-L1320) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021) / [RFC 7800 §4: 所持証明とオーディエンス制限は別の保護](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7800.txt#L531-L576)

</details>

### 6-20. DPoP と mTLS の使い分け

ユースケース設計 / 記述式 / 6 点

次の 3 つの環境で、送信者制約の方式を選びます。  
(1) ブラウザーで動く SPA  
(2) 企業の閉じたネットワークで動くバッチ処理のサーバー。クライアント証明書の配布基盤があり、AS も RS もアプリケーションで直接 TLS を終端する  
(3) TLS を終端する CDN の後ろにある API を呼ぶネイティブアプリ

それぞれ DPoP と mTLS のどちらが適しているか（どちらでもよい場合を含む）を、理由と、選んだ方式で注意すべき点とともに説明してください。

環境ごとに、方式・理由・注意点を 1〜2 行で構いません。

<details>
<summary>解答・解説</summary>

**解答例**

(1) DPoP。ブラウザーでの TLS クライアント認証は使い勝手が悪く、SPA は TLS 層を扱えない。非抽出の鍵を使えば、トークン単体の持ち出しを無力化できる。ただし XSS は防げないので、XSS 対策が前提。(2) mTLS が適する（DPoP でもよい）。証明書の基盤があり、TLS 層との統合でリプレイにも強く、クライアント認証も兼ねられる。RS が事前に mTLS を求める必要があることと、証明書の更新でトークンが使えなくなることに注意する。(3) DPoP が適する。TLS を終端する中間装置の後ろでは、mTLS の証明書の情報をアプリケーションへ安全に渡す方法を別に用意する必要がある。DPoP では RS が外部の URI で htu を照合し、受理期間・jti などでリプレイを防ぐ。

**採点基準（各 1 点）**

- (1) DPoP を選び、ブラウザーでの TLS クライアント認証の使い勝手の悪さなどを理由に挙げる。
- (1) DPoP でも XSS は防げないので、XSS 対策が前提になると述べる。
- (2) mTLS（またはどちらでもよい）とし、証明書の配布基盤や TLS 層との統合による保護を理由に挙げる。DPoP を選ぶ場合も、この環境の条件に即した理由があれば認める。
- (2) RS が事前に mTLS を求める必要や、証明書の更新でトークンが使えなくなる点に触れる。
- (3) DPoP を選び（条件付きで mTLS も可とする答えも認める）、TLS を終端する中間装置では、mTLS の証明書の情報をアプリへ安全に渡す方法が別に必要になることを理由に挙げる。
- (3) RS が外部の URI で htu を照合し、受理期間や jti でリプレイを防ぐと述べる。

**出典：** [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [RFC 8705 §3: 証明書に結び付いたアクセストークンと RS の事前準備](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L390-L442) / [RFC 8705 §6.5: TLS 終端と証明書情報の受け渡し](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L727-L733) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433) / [§11: URI・メソッドへの結び付けと TLS 方式との違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1310-L1320) / [RFC 8705 §6.3: 証明書の更新とアクセストークン](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8705.txt#L701-L709)

</details>

<a id="part-7"></a>

## 第 7 部：実装 — DPoP の処理を自分で書く（スマホではコード読解）

8 問・50 点。PC では、ケースと制約を満たす関数を JavaScript で書きます。スマホでは同じ関数のコードを読み、正しい補助関数を選びます。参考実装とスマホ版の選択肢は、すべてのケースで動作を確かめてあります。

### 7-01. Authorization ヘッダーから ath を求める

ケースに基づく実装 / コード実装 / 6 点

RS のミドルウェアで、Authorization ヘッダーの値からアクセストークンを取り出し、proof の ath と比べるためのハッシュを計算します。Node.js 22 で動かし、node:crypto を使えます。

ケースを満たす athFromAuthorization(value) を実装してください。値が「スキーム名、1 つ以上のスペース、資格情報」の形でなければ TypeError を投げ、スキームが DPoP 以外なら資格情報の構文は確かめずに null を返し、DPoP なら token68 の構文を確かめて（合わなければ TypeError）{ token, ath } を返してください。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
import { createHash } from "node:crypto";

// value: Authorization ヘッダーの値（文字列）
// 「スキーム名、1 つ以上のスペース、資格情報」の形でなければ TypeError を投げる
// スキームが DPoP 以外なら、資格情報の構文は確かめずに null を返す
// DPoP なら資格情報を token68 として確かめ（合わなければ TypeError）、{ token, ath } を返す
function athFromAuthorization(value) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **RFC 9449 の例**

   ```text
   入力: "DPoP Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU"
   期待: {"token":"Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU","ath":"fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo"}
   ```

2. **スキーム名が小文字**

   ```text
   入力: "dpop Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU"
   期待: {"token":"Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU","ath":"fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo"}
   ```

3. **区切りのスペースが 3 つ**

   ```text
   入力: "DPoP   Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU"
   期待: {"token":"Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU","ath":"fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo"}
   ```

4. **Bearer スキーム**

   ```text
   入力: "Bearer Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU"
   期待: null
   ```

5. **末尾の「=」**

   ```text
   入力: "DPoP YWJj=="
   期待: {"token":"YWJj==","ath":"6I3RPJYVAWclt4vISOkevFmM5yUVuoaQYTFY_cBuFEg"}
   ```

6. **token68 で使えない「:」**

   ```text
   入力: "DPoP Kz~8mXK1Eal:YznwH"
   期待: TypeError を投げる
   ```

7. **途中の「=」**

   ```text
   入力: "DPoP YWJj==ZGVm"
   期待: TypeError を投げる
   ```

8. **トークンがない**

   ```text
   入力: "DPoP"
   期待: TypeError を投げる
   ```

**スマホ版の問い**

athFromAuthorization が呼ぶ extractDpopToken として、すべてのケースを満たすものはどれですか？

```javascript
import { createHash } from "node:crypto";

function athFromAuthorization(value) {
  const token = extractDpopToken(value);
  if (token === null) return null;
  const ath = createHash("sha256").update(token, "ascii").digest("base64url");
  return { token, ath };
}

```

- **A.** function extractDpopToken(value) {  
  const match = /^(\S+) +(.+)$/.exec(value);  
  if (!match) throw new TypeError("credentials are missing");  
  if (match[1].toLowerCase() !== "dpop") return null;  
  if (!/^[A-Za-z0-9\-._~+/]+=*$/.test(match[2])) throw new TypeError("token68");  
  return match[2];  
}
- **B.** function extractDpopToken(value) {  
  const match = /^(\S+) +(.+)$/.exec(value);  
  if (!match) throw new TypeError("credentials are missing");  
  if (match[1] !== "DPoP") return null;  
  if (!/^[A-Za-z0-9\-._~+/]+=*$/.test(match[2])) throw new TypeError("token68");  
  return match[2];  
}
- **C.** function extractDpopToken(value) {  
  const match = /^(\S+) +(.+)$/.exec(value);  
  if (!match) throw new TypeError("credentials are missing");  
  if (match[1].toLowerCase() !== "dpop") return null;  
  if (!/^[A-Za-z0-9\-._~+/=]+$/.test(match[2])) throw new TypeError("token68");  
  return match[2];  
}
- **D.** function extractDpopToken(value) {  
  const [scheme, token] = value.split(" ");  
  if (scheme.toLowerCase() !== "dpop") return null;  
  if (!/^[A-Za-z0-9\-._~+/]+=*$/.test(token ?? "")) throw new TypeError("token68");  
  return token;  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：A**

A は、スキーム名を小文字にして比べ、1 つ以上のスペースを区切りとし、token68 の正規表現で「=」を末尾だけに限ります。B は "DPoP" との完全一致で比べるので、小文字の dpop で null を返します。C は「=」を途中でも許すので、YWJj==ZGVm を受理してしまいます。D は 1 つのスペースで分割するので、スペースが 3 つある場合にトークンが空になり TypeError を投げます。

**解説**

RFC 9449 §7.1 の credentials は「"DPoP" 1*SP token68」で、RFC 9110 §11.1 のとおりスキーム名は大文字・小文字を区別しません。token68 は「=」を末尾にだけ許します。ath は RFC 9449 §4.2 のとおり、トークンの値の ASCII を SHA-256 でハッシュし、base64url にした値です。base64url は末尾の「=」を省きます（RFC 7515 §2）。Node.js では createHash("sha256").update(token, "ascii").digest("base64url") で計算でき、RFC 9449 の例のトークンから fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo が得られます。

**参考実装**

```javascript
import { createHash } from "node:crypto";

const TOKEN68 = /^[A-Za-z0-9\-._~+/]+=*$/;

function athFromAuthorization(value) {
  if (typeof value !== "string") throw new TypeError("Authorization must be a string");
  // credentials = auth-scheme 1*SP token68
  const match = /^(\S+) +(.+)$/.exec(value);
  if (!match) throw new TypeError("credentials are missing");
  const [, scheme, token] = match;
  // 認証スキーム名は大文字・小文字を区別しない（RFC 9110 §11.1）
  if (scheme.toLowerCase() !== "dpop") return null;
  // token68: 「=」は末尾だけ（RFC 9449 §7.1）
  if (!TOKEN68.test(token)) throw new TypeError("token68 syntax error");
  // ath = BASE64URL(SHA-256(ASCII(token)))（RFC 9449 §4.2）
  const ath = createHash("sha256").update(token, "ascii").digest("base64url");
  return { token, ath };
}

```

**採点基準（各 2 点）**

- スキーム名を大文字・小文字を区別せずに比べ、1 つ以上のスペースで区切られたトークンを取り出す。DPoP 以外のスキームでは null を返す。
- トークンを token68 の構文（使える文字、末尾だけの「=」）で検証し、合わない場合やトークンがない場合は TypeError を投げる。
- ath を、トークンの ASCII の SHA-256 をパディングなしの base64url にして計算する（RFC 9449 の例の値と一致する）。

**出典：** [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [RFC 9110 §11.1: 認証スキームは大文字・小文字を区別しない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4859-L4875) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.1: DPoP HTTP ヘッダーの構文と大文字・小文字](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L359-L391) / [RFC 7515 §2: base64url（パディングなし）と JWS Signing Input](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7515.txt#L287-L299)

</details>

### 7-02. proof の jwk の Thumbprint

ケースに基づく実装 / コード実装 / 6 点

RS が、proof の jwk から JWK SHA-256 Thumbprint を計算し、アクセストークンの cnf.jkt と比べます。EC・RSA・OKP の鍵に対応し、秘密鍵のメンバーを含む jwk や共通鍵は DPoP の鍵として受け付けません。Node.js 22 で動かします。

ケースを満たす dpopJwkThumbprint(jwk) を実装してください。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
import { createHash } from "node:crypto";

// jwk: proof の JOSE ヘッダーの jwk（解析済みのオブジェクト）
// 戻り値: JWK SHA-256 Thumbprint を base64url（パディングなし）にした文字列
// 秘密鍵のメンバー・未対応の kty・必須メンバーの欠落は TypeError
function dpopJwkThumbprint(jwk) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **RFC 9449 の例の EC 鍵**

   ```text
   入力: {"kty":"EC","x":"l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs","y":"9VE4jf_Ok_o64zbTTlcuNJajHmt6v9TDVrU0CdvGRDA","crv":"P-256"}
   期待: "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I"
   ```

2. **任意メンバー（kid・use・alg）付き**

   ```text
   入力: {"kty":"EC","use":"sig","kid":"k1","alg":"ES256","crv":"P-256","x":"l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs","y":"9VE4jf_Ok_o64zbTTlcuNJajHmt6v9TDVrU0CdvGRDA"}
   期待: "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I"
   ```

3. **RFC 7638 の RSA 鍵**

   ```text
   入力: {"kty":"RSA","n":"0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw","e":"AQAB","alg":"RS256","kid":"2011-04-29"}
   期待: "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"
   ```

4. **RFC 8037 の Ed25519 鍵**

   ```text
   入力: {"kty":"OKP","crv":"Ed25519","x":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}
   期待: "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k"
   ```

5. **秘密鍵の d を含む**

   ```text
   入力: {"kty":"EC","crv":"P-256","x":"l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs","y":"9VE4jf_Ok_o64zbTTlcuNJajHmt6v9TDVrU0CdvGRDA","d":"jpsQnnGQmL-YBIffH1136cspYG6-0iY7X1fCE9-E9LI"}
   期待: TypeError を投げる
   ```

6. **共通鍵（kty=oct）**

   ```text
   入力: {"kty":"oct","k":"GawgguFyGrWKav7AX4VKUg"}
   期待: TypeError を投げる
   ```

7. **y がない EC 鍵**

   ```text
   入力: {"kty":"EC","crv":"P-256","x":"l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs"}
   期待: TypeError を投げる
   ```

**スマホ版の問い**

dpopJwkThumbprint が呼ぶ thumbprintMembers として、すべてのケースを満たすものはどれですか？

```javascript
import { createHash } from "node:crypto";

const PRIVATE = ["d", "p", "q", "dp", "dq", "qi", "oth"];

function dpopJwkThumbprint(jwk) {
  if (PRIVATE.some((name) => Object.hasOwn(jwk, name))) throw new TypeError("private key");
  const input = {};
  for (const name of thumbprintMembers(jwk.kty)) {
    if (typeof jwk[name] !== "string" || jwk[name] === "") throw new TypeError(`missing ${name}`);
    input[name] = jwk[name];
  }
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("base64url");
}

```

- **A.** function thumbprintMembers(kty) {  
  const table = { EC: ["kty", "crv", "x", "y"], RSA: ["kty", "n", "e"], OKP: ["kty", "crv", "x"] };  
  if (!Object.hasOwn(table, kty)) throw new TypeError("unsupported kty");  
  return table[kty];  
}
- **B.** function thumbprintMembers(kty) {  
  const table = { EC: ["crv", "kty", "x", "y"], RSA: ["e", "kty", "n"], OKP: ["crv", "kty", "x"], oct: ["k", "kty"] };  
  if (!Object.hasOwn(table, kty)) throw new TypeError("unsupported kty");  
  return table[kty];  
}
- **C.** function thumbprintMembers(kty) {  
  const table = { EC: ["crv", "kty", "x", "y"], RSA: ["e", "kty", "n"], OKP: ["crv", "kty", "x"] };  
  if (!Object.hasOwn(table, kty)) throw new TypeError("unsupported kty");  
  return table[kty];  
}
- **D.** function thumbprintMembers(kty) {  
  const table = { EC: ["crv", "kty", "x", "y"], RSA: ["e", "kty", "n"], OKP: ["crv", "kty", "x", "y"] };  
  if (!Object.hasOwn(table, kty)) throw new TypeError("unsupported kty");  
  return table[kty];  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：C**

C は、鍵の種類ごとの必須メンバーを辞書順で返し、共通鍵を拒否します。A は辞書順ではない順序で返すので、EC・RSA・OKP のどの例とも値が一致しません。B は kty=oct を受け付けるので、共通鍵のケースで TypeError を投げません。D は OKP に y を求めるので、Ed25519 の鍵で TypeError を投げます。

**解説**

RFC 7638 §3 は、必須メンバーだけを辞書順に並べて空白なしの JSON にし、その UTF-8 をハッシュすると定めています。必須メンバーは §3.2（EC・RSA）と RFC 8037 §2（OKP）のとおりです。RFC 9449 §6.1 の jkt は、この SHA-256 の結果の base64url です。JSON.stringify は並べ替えをしないので（RFC 7638 §4）、必須メンバーを辞書順に追加した新しいオブジェクトを作ってから文字列にします。RFC 9449 §4.2 は jwk に秘密鍵を含めることを禁じ、alg を非対称署名に限っているので、共通鍵（oct）も DPoP の鍵になりません。

**参考実装**

```javascript
import { createHash } from "node:crypto";

// 鍵の種類ごとの必須メンバー（辞書順）: RFC 7638 §3.2、RFC 8037 §2
const MEMBERS = { EC: ["crv", "kty", "x", "y"], RSA: ["e", "kty", "n"], OKP: ["crv", "kty", "x"] };
// 秘密鍵のメンバー（RFC 7518 §6.2.2・§6.3.2、RFC 8037 §2）
const PRIVATE = ["d", "p", "q", "dp", "dq", "qi", "oth"];

function dpopJwkThumbprint(jwk) {
  if (jwk === null || typeof jwk !== "object" || Array.isArray(jwk)) throw new TypeError("jwk must be an object");
  // DPoP の jwk は秘密鍵を含んではならない（RFC 9449 §4.2）
  if (PRIVATE.some((name) => Object.hasOwn(jwk, name))) throw new TypeError("jwk contains a private key");
  if (!Object.hasOwn(MEMBERS, jwk.kty)) throw new TypeError("unsupported kty");
  const input = {};
  for (const name of MEMBERS[jwk.kty]) {
    if (typeof jwk[name] !== "string" || jwk[name] === "") throw new TypeError(`missing ${name}`);
    input[name] = jwk[name];
  }
  // 必須メンバーだけを辞書順に追加したので、JSON.stringify は空白なしで同じ順に出力する
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("base64url");
}

```

**採点基準（各 2 点）**

- 鍵の種類ごとの必須メンバーだけ（EC：crv・kty・x・y、RSA：e・kty・n、OKP：crv・kty・x）を、メンバー名の辞書順に空白なしの JSON にする。kid などの任意メンバーは含めない。
- JSON の UTF-8 の SHA-256 を、パディングなしの base64url にする（RFC の 3 つの例の値と一致する）。
- 秘密鍵のメンバー（d など）を含む jwk、未対応の kty（oct など）、必須メンバーの欠落を TypeError で拒否する。

**出典：** [RFC 7638 §3: JWK Thumbprint の計算手順](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L130-L148) / [RFC 7638 §3.2: 鍵の種類ごとの必須メンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L287-L315) / [RFC 8037 §2: OKP 鍵の kty・crv・x・d と Thumbprint のメンバー](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8037.txt#L134-L159) / [RFC 8037 付録 A.3: Ed25519 公開鍵の Thumbprint の入力と値](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc8037.txt#L484-L495) / [RFC 7638 §4: JSON.stringify と並べ替えの注意](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7638.txt#L439-L493) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 7-03. htu の照合

ケースに基づく実装 / コード実装 / 6 点

RS が、proof の htu と、組み立てた要求の target URI を比べます。RFC 9449 が勧める RFC 3986 の構文ベース・スキームベースの正規化を行い、query と fragment は無視します。WHATWG の URL パーサー（new URL）を使えます。

ケースを満たす htuMatches(htu, requestUri) を実装してください。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
// htu: proof の htu クレーム（query・fragment を含まない絶対 URI）
// requestUri: RS が組み立てた要求の URI（query や fragment を含むことがある）
// 戻り値: RFC 3986 の構文ベース・スキームベースの正規化の後に一致すれば true
function htuMatches(htu, requestUri) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **%2f と %2F**

   ```text
   入力: "https://api.example.com/a%2fb", "https://api.example.com/a%2Fb"
   期待: true
   ```

2. **大文字のホスト・既定のポート・query**

   ```text
   入力: "HTTPS://API.Example.com:443/orders", "https://api.example.com/orders?status=open#top"
   期待: true
   ```

3. **パスの大文字・小文字**

   ```text
   入力: "https://api.example.com/Orders", "https://api.example.com/orders"
   期待: false
   ```

4. **%7e と ~**

   ```text
   入力: "https://api.example.com/%7euser", "https://api.example.com/~user"
   期待: true
   ```

5. **%2F と /**

   ```text
   入力: "https://api.example.com/a%2Fb", "https://api.example.com/a/b"
   期待: false
   ```

6. **ドットセグメント**

   ```text
   入力: "https://api.example.com/a/./b/../c", "https://api.example.com/a/c"
   期待: true
   ```

7. **空のパスと「/」**

   ```text
   入力: "https://api.example.com", "https://api.example.com/"
   期待: true
   ```

8. **末尾のスラッシュ**

   ```text
   入力: "https://api.example.com/data/", "https://api.example.com/data"
   期待: false
   ```

**スマホ版の問い**

normalizeForHtu が呼ぶ normalizePercent として、すべてのケースを満たすものはどれですか？

```javascript
// new URL() は、スキームとホストの小文字化、既定のポートの省略、
// ドットセグメントの除去、空のパスを "/" にする処理を行う。
// パーセントエンコーディングの文字は変更しない。
function normalizeForHtu(uri) {
  const url = new URL(uri);
  return `${url.protocol}//${url.host}${normalizePercent(url.pathname)}`;
}

function htuMatches(htu, requestUri) {
  return normalizeForHtu(htu) === normalizeForHtu(requestUri);
}

```

- **A.** function normalizePercent(path) {  
  return decodeURIComponent(path);  
}
- **B.** function normalizePercent(path) {  
  return path;  
}
- **C.** function normalizePercent(path) {  
  return path.toLowerCase();  
}
- **D.** function normalizePercent(path) {  
  return path.replace(/%[0-9A-Fa-f]{2}/g, (triplet) => {  
    const ch = String.fromCharCode(parseInt(triplet.slice(1), 16));  
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : triplet.toUpperCase();  
  });  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：D**

D は非予約文字だけを元の文字に戻し、その他の 16 進を大文字にそろえます。A は %2F も「/」に戻すので、a%2Fb と a/b を同じと判定します。B はパーセントエンコーディングを変えないので、%7e と ~、%2f と %2F を別のものと判定します。C はパスを小文字にするので Orders と orders を同じと判定し、%7e も元に戻しません。

**解説**

RFC 9449 §4.3 は、htu を比べる前に RFC 3986 §6.2.2（構文ベース）と §6.2.3（スキームベース）の正規化を行うことを SHOULD としています。new URL() はスキームとホストの小文字化、既定のポートの省略、ドットセグメントの除去、空のパスの「/」への変換を行いますが、パーセントエンコーディングはそのまま残します。そこで §6.2.2.2 のとおり非予約文字だけを元の文字に戻し、§6.2.2.1 のとおり残りの 16 進を大文字にそろえます。「/」は予約文字なので、%2F を戻すと別の URI になります。末尾のスラッシュを同じとみなすのは §6.2.4 のプロトコルベースの正規化で、勧められている正規化には含まれません。

**参考実装**

```javascript
// WHATWG の URL パーサーは、スキームとホストの小文字化、既定のポートの省略、
// ドットセグメントの除去、空のパスを "/" にする処理を行う。
// パーセントエンコーディングは変えないので、別に正規化する（RFC 3986 §6.2.2）。
function normalizePercent(path) {
  return path.replace(/%[0-9A-Fa-f]{2}/g, (triplet) => {
    const ch = String.fromCharCode(parseInt(triplet.slice(1), 16));
    // 非予約文字だけを元の文字に戻し、それ以外は 16 進を大文字にそろえる
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : triplet.toUpperCase();
  });
}

function normalizeForHtu(uri) {
  const url = new URL(uri);
  // query と fragment は使わない（RFC 9449 §4.3）
  return `${url.protocol}//${url.host}${normalizePercent(url.pathname)}`;
}

function htuMatches(htu, requestUri) {
  return normalizeForHtu(htu) === normalizeForHtu(requestUri);
}

```

**採点基準（各 2 点）**

- スキームとホストの大文字・小文字、既定のポート、ドットセグメント、空のパスを正規化し、query と fragment を比較から除く。
- 非予約文字のパーセントエンコーディング（%7e）だけを元に戻し、予約文字（%2F）は戻さない。16 進は大文字にそろえる。
- パスの大文字・小文字と末尾のスラッシュを区別する（プロトコルベースの正規化をしない）。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [RFC 3986 §6.2.2: 構文ベースの正規化](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2197-L2257) / [RFC 3986 §6.2.3: スキームベースの正規化](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2259-L2321) / [RFC 3986 §6.2.4: プロトコルベースの正規化（末尾のスラッシュ）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L2323-L2341) / [RFC 3986 §2.3: 非予約文字とパーセントエンコーディング](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc3986.txt#L718-L745) / [RFC 9110 §4.2.3: http(s) URI の正規化と比較](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L1158-L1197)

</details>

### 7-04. WWW-Authenticate から DPoP の challenge を読む

ケースに基づく実装 / コード実装 / 7 点

クライアントが RS の 401 応答から、DPoP の challenge の error と algs を読み取ります。WWW-Authenticate は複数の challenge を含み、フィールド行が複数になることもあります。パラメーターの値は token 形式と quoted-string 形式のどちらでも届きます。

ケースを満たす parseDpopChallenge(fieldValues) を実装してください。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
// fieldValues: WWW-Authenticate ヘッダーの値の配列（フィールド行ごと）
// 戻り値: DPoP の challenge があれば { error, algs }（error はなければ null、algs は配列）、なければ null
// token68 形式の challenge は扱わなくてよい
// ケースの入力は JavaScript の配列リテラルで表記している
function parseDpopChallenge(fieldValues) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **認証なしの 401（RFC 9449 Figure 15）**

   ```text
   入力: ["DPoP algs=\"ES256 PS256\""]
   期待: {"error":null,"algs":["ES256","PS256"]}
   ```

2. **Bearer と同じ行の DPoP**

   ```text
   入力: ["Bearer realm=\"api\", DPoP error=\"use_dpop_nonce\", algs=\"ES256\""]
   期待: {"error":"use_dpop_nonce","algs":["ES256"]}
   ```

3. **2 行のヘッダーと token 形式の値**

   ```text
   入力: ["Bearer realm=\"api\"","DPoP error=invalid_token, ALGS=ES256"]
   期待: {"error":"invalid_token","algs":["ES256"]}
   ```

4. **小文字のスキーム名**

   ```text
   入力: ["dpop algs=\"ES256\""]
   期待: {"error":null,"algs":["ES256"]}
   ```

5. **引用符の中のカンマ（DPoP なし）**

   ```text
   入力: ["Bearer error=\"invalid_token\", error_description=\"a, b\""]
   期待: null
   ```

6. **引用符の中のエスケープとカンマ**

   ```text
   入力: ["DPoP error=\"invalid_dpop_proof\", error_description=\"bad \\\"htu\\\", retry\", algs=\"ES256\""]
   （フィールド行の値: DPoP error="invalid_dpop_proof", error_description="bad \"htu\", retry", algs="ES256"）
   期待: {"error":"invalid_dpop_proof","algs":["ES256"]}
   ```

7. **パラメーターのない Bearer（RFC 9449 Figure 17）**

   ```text
   入力: ["Bearer, DPoP algs=\"ES256 PS256\""]
   期待: {"error":null,"algs":["ES256","PS256"]}
   ```

8. **未知のスキームの後の DPoP**

   ```text
   入力: ["Newauth realm=\"apps\", type=1, DPoP algs=\"EdDSA\""]
   期待: {"error":null,"algs":["EdDSA"]}
   ```

**スマホ版の問い**

parseDpopChallenge が呼ぶ readQuoted として、すべてのケースを満たすものはどれですか？

```javascript
const TOKEN = /[!#$%&'*+\-.^_`|~0-9A-Za-z]+/y;

function readToken(s, i) {
  TOKEN.lastIndex = i;
  const match = TOKEN.exec(s);
  if (!match) throw new SyntaxError(`token expected at ${i}`);
  return [match[0], TOKEN.lastIndex];
}

function parseDpopChallenge(fieldValues) {
  const s = fieldValues.join(", ");
  const challenges = [];
  let current = null;
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[ \t,]/.test(s[i])) i++;
    if (i >= s.length) break;
    let name;
    [name, i] = readToken(s, i);
    let j = i;
    while (j < s.length && /[ \t]/.test(s[j])) j++;
    if (s[j] === "=" && current) {
      i = j + 1;
      while (i < s.length && /[ \t]/.test(s[i])) i++;
      let value;
      // readQuoted は、開きの引用符の位置 i から値を読み、[値, 次の位置] を返す
      [value, i] = s[i] === '"' ? readQuoted(s, i) : readToken(s, i);
      const key = name.toLowerCase();
      if (!current.params.has(key)) current.params.set(key, value);
    } else {
      current = { scheme: name.toLowerCase(), params: new Map() };
      challenges.push(current);
    }
  }
  const dpop = challenges.find((c) => c.scheme === "dpop");
  if (!dpop) return null;
  const algs = dpop.params.get("algs");
  return { error: dpop.params.get("error") ?? null, algs: algs ? algs.split(" ").filter(Boolean) : [] };
}

```

- **A.** function readQuoted(s, i) {  
  const end = s.indexOf('"', i + 1);  
  if (end &lt; 0) throw new SyntaxError("unterminated quoted-string");  
  return [s.slice(i + 1, end), end + 1];  
}
- **B.** function readQuoted(s, i) {  
  let value = "";  
  for (let j = i + 1; j &lt; s.length; j++) {  
    if (s[j] === "\\") { j++; if (j &lt; s.length) value += s[j]; continue; }  
    if (s[j] === '"') return [value, j + 1];  
    value += s[j];  
  }  
  throw new SyntaxError("unterminated quoted-string");  
}
- **C.** function readQuoted(s, i) {  
  let value = "";  
  for (let j = i + 1; j &lt; s.length; j++) {  
    if (s[j] === "\\") { j++; if (j &lt; s.length) value += s[j]; continue; }  
    if (s[j] === '"') return [value, j];  
    value += s[j];  
  }  
  throw new SyntaxError("unterminated quoted-string");  
}
- **D.** function readQuoted(s, i) {  
  let value = "";  
  for (let j = i + 1; j &lt; s.length; j++) {  
    if (s[j] === '"' || s[j] === ",") return [value, j + 1];  
    value += s[j];  
  }  
  throw new SyntaxError("unterminated quoted-string");  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：B**

B は、バックスラッシュの次の文字を値に含め、閉じの引用符の次の位置を返します。A は次の引用符までを値にするので、\" のところで値が途中で終わり、残りを読めずに SyntaxError になります。C は閉じの引用符の位置を返すので、次のトークンを読むときに引用符で SyntaxError になります。D はエスケープを扱わず、カンマでも値を打ち切るので、"a, b" や "bad \"htu\", retry" の途中で値が終わり、残りを読めずに SyntaxError になります。

**解説**

RFC 9110 §11.6.1 のとおり、WWW-Authenticate は複数の challenge を含み、ヘッダー自体も複数行になり得ます。§5.3 のとおり、リスト構文のフィールドはカンマでつないで 1 つの値として扱えます。challenge は「auth-scheme [ 1*SP ( token68 / #auth-param ) ]」（§11.3）、auth-param は「token BWS "=" BWS ( token / quoted-string )」で、パラメーター名は大文字・小文字を区別しません（§11.2）。値はどちらの形式でも受け付ける必要があります。RFC 9449 §7.1 の algs は、JWS の alg 値をスペースで区切ったリストです。トークンの後に「=」が続けばパラメーター、続かなければ次の challenge のスキーム名と判断すると、Figure 17 の「Bearer, DPoP algs=…」のような値も読めます。

**参考実装**

```javascript
const TOKEN = /[!#$%&'*+\-.^_`|~0-9A-Za-z]+/y;

function readToken(s, i) {
  TOKEN.lastIndex = i;
  const match = TOKEN.exec(s);
  if (!match) throw new SyntaxError(`token expected at ${i}`);
  return [match[0], TOKEN.lastIndex];
}

// s[i] は開きの引用符。バックスラッシュの次の文字はそのまま値に含める（quoted-pair）
function readQuoted(s, i) {
  let value = "";
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "\\") { j++; if (j < s.length) value += s[j]; continue; }
    if (s[j] === '"') return [value, j + 1];
    value += s[j];
  }
  throw new SyntaxError("unterminated quoted-string");
}

// 複数のフィールド行はカンマでつないで 1 つの値として扱える（RFC 9110 §5.3）
function parseChallenges(fieldValues) {
  const s = fieldValues.join(", ");
  const challenges = [];
  let current = null;
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[ \t,]/.test(s[i])) i++;
    if (i >= s.length) break;
    let name;
    [name, i] = readToken(s, i);
    let j = i;
    while (j < s.length && /[ \t]/.test(s[j])) j++;
    if (s[j] === "=" && current) {
      // auth-param = token BWS "=" BWS ( token / quoted-string )
      i = j + 1;
      while (i < s.length && /[ \t]/.test(s[i])) i++;
      let value;
      [value, i] = s[i] === '"' ? readQuoted(s, i) : readToken(s, i);
      const key = name.toLowerCase(); // パラメーター名は大文字・小文字を区別しない
      if (!current.params.has(key)) current.params.set(key, value);
    } else {
      // 次の challenge の始まり（スキーム名は大文字・小文字を区別しない）
      current = { scheme: name.toLowerCase(), params: new Map() };
      challenges.push(current);
    }
  }
  return challenges;
}

function parseDpopChallenge(fieldValues) {
  const dpop = parseChallenges(fieldValues).find((c) => c.scheme === "dpop");
  if (!dpop) return null;
  const algs = dpop.params.get("algs");
  return { error: dpop.params.get("error") ?? null, algs: algs ? algs.split(" ").filter(Boolean) : [] };
}

```

**採点基準**

- 複数のフィールド行をまとめて扱い、スキーム名の後のパラメーターを、次のスキーム名までその challenge に属させる（未知のスキームも読み飛ばせる）。（2 点）
- パラメーターの値を token と quoted-string の両方で読み、quoted-string ではバックスラッシュのエスケープと中のカンマを正しく扱う。（2 点）
- スキーム名とパラメーター名を、大文字・小文字を区別せずに扱う。（1 点）
- DPoP の challenge がなければ null を返し、あれば error（なければ null）と、スペースで区切った algs の配列を返す。（2 点）

**出典：** [RFC 9110 §11.6.1: WWW-Authenticate の複数 challenge](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L5018-L5060) / [RFC 9110 §11.2: token68 と auth-param（token / quoted-string）](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4877-L4907) / [RFC 9110 §11.3: challenge の構文](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4909-L4935) / [RFC 9110 §11.1: 認証スキームは大文字・小文字を区別しない](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L4859-L4875) / [RFC 9110 §5.3: 同名のフィールド行の結合](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L1515-L1545) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§7.2: 複数 challenge と 2 方式同時使用の 400 の例](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1023-L1057)

</details>

### 7-05. proof の内容の検証

ケースに基づく実装 / コード実装 / 7 点

AS と RS が共通で使う処理で、署名を検証済みの proof の内容を、要求と照らして検証します。結果は、失敗した検証の名前を決まった順に並べた配列で返します。課題の制約として、htu は new URL() で正規化したスキーム・ホスト・パスで比べ、typ は "dpop+jwt" と完全に一致するかで比べます。

ケースを満たす checkDpopClaims(header, payload, ctx) を実装してください。必須クレーム（jti・htm・htu・iat）がない場合は "claims" を報告し、ないクレームについての個別の検証は行いません。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
import { createHash } from "node:crypto";

// header・payload: 署名を検証済みの proof の JOSE ヘッダーとペイロード
// ctx: { method, url, now, allowedAlgs, maxAge, maxFuture, providedNonce, accessToken, boundJkt, proofJkt }
//   url は query を含み得る target URI、now と iat は秒
//   maxAge・maxFuture は、iat が now より過去・未来にずれてよい最大の秒数
//   providedNonce はこのサーバー（AS または RS）がクライアントに提供した nonce（なければ null）
//   accessToken は提示されたトークン（トークン要求なら null）、boundJkt はトークンの cnf.jkt
//   proofJkt は header.jwk の JWK Thumbprint（計算済み）
// 戻り値: 失敗した検証の名前の配列（次の順）。すべて成功なら []
//   "typ", "alg", "jwk", "claims", "htm", "htu", "iat", "nonce", "ath", "binding"
// 課題の制約: jti・htm・htu・iat がなければ "claims" を報告し、ないクレームの個別の検証は行わない。
//   ath・nonce がない場合は、"claims" ではなく "ath"・"nonce" として報告する
function checkDpopClaims(header, payload, ctx) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **基本（RFC 9449 Figure 14 の proof）**

   ```text
   入力: header = {"typ":"dpop+jwt","alg":"ES256","jwk":{"kty":"EC","x":"l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs","y":"9VE4jf_Ok_o64zbTTlcuNJajHmt6v9TDVrU0CdvGRDA","crv":"P-256"}}
   payload = {"jti":"e1j3V_bKic8-LAEB","htm":"GET","htu":"https://resource.example.org/protectedresource","iat":1562262618,"ath":"fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo"}
   ctx = {"method":"GET","url":"https://resource.example.org/protectedresource?view=full","now":1562262620,"allowedAlgs":["ES256","PS256"],"maxAge":60,"maxFuture":5,"providedNonce":null,"accessToken":"Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU","boundJkt":"0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I","proofJkt":"0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I"}
   期待: []
   ```

2. **typ・alg・jwk・古い iat**

   ```text
   入力: 基本の入力で header.typ = "JWT"、header.alg = "HS256"、header.jwk に "d": "jpsQnnGQmL-YBIffH1136cspYG6-0iY7X1fCE9-E9LI" を追加、payload.iat = 1562262500（now の 120 秒前）
   期待: ["typ","alg","jwk","iat"]
   ```

3. **nonce の不一致**

   ```text
   入力: 基本の入力で ctx.providedNonce = "N1"、payload.nonce = "N0"
   期待: ["nonce"]
   ```

4. **htm がない**

   ```text
   入力: 基本の入力から payload.htm を削除
   期待: ["claims"]
   ```

5. **htm と htu**

   ```text
   入力: 基本の入力で payload.htm = "get"、payload.htu = "https://resource.example.org/protected"
   期待: ["htm","htu"]
   ```

6. **未来の iat**

   ```text
   入力: 基本の入力で payload.iat = 1562262700（now の 80 秒後）
   期待: ["iat"]
   ```

7. **トークン要求で nonce がない**

   ```text
   入力: 基本の入力で payload.htu = "https://server.example.com/token"、payload.htm = "POST"、ath を削除。ctx は method = "POST"、url = "https://server.example.com/token"、providedNonce = "N1"、accessToken = null
   期待: ["nonce"]
   ```

8. **別のトークンと別の鍵**

   ```text
   入力: 基本の入力で ctx.accessToken = "another-token"、ctx.proofJkt = "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"
   期待: ["ath","binding"]
   ```

**スマホ版の問い**

checkDpopClaims が呼ぶ nonceOk として、すべてのケースを満たすものはどれですか？

```javascript
import { createHash } from "node:crypto";

const PRIVATE = ["d", "p", "q", "dp", "dq", "qi", "oth"];

function sameTarget(htu, url) {
  try {
    const a = new URL(htu);
    const b = new URL(url);
    return `${a.protocol}//${a.host}${a.pathname}` === `${b.protocol}//${b.host}${b.pathname}`;
  } catch {
    return false;
  }
}

function checkDpopClaims(header, payload, ctx) {
  const failures = [];
  if (header.typ !== "dpop+jwt") failures.push("typ");
  if (!ctx.allowedAlgs.includes(header.alg)) failures.push("alg");
  const jwk = header.jwk;
  if (jwk === null || typeof jwk !== "object" || typeof jwk.kty !== "string"
      || PRIVATE.some((name) => Object.hasOwn(jwk, name))) failures.push("jwk");
  const hasClaims = typeof payload.jti === "string" && payload.jti !== ""
    && typeof payload.htm === "string" && typeof payload.htu === "string" && typeof payload.iat === "number";
  if (!hasClaims) failures.push("claims");
  if (typeof payload.htm === "string" && payload.htm !== ctx.method) failures.push("htm");
  if (typeof payload.htu === "string" && !sameTarget(payload.htu, ctx.url)) failures.push("htu");
  if (typeof payload.iat === "number"
      && (payload.iat < ctx.now - ctx.maxAge || payload.iat > ctx.now + ctx.maxFuture)) failures.push("iat");
  if (!nonceOk(payload, ctx)) failures.push("nonce");
  if (ctx.accessToken != null) {
    const ath = createHash("sha256").update(ctx.accessToken, "ascii").digest("base64url");
    if (payload.ath !== ath) failures.push("ath");
    if (ctx.proofJkt !== ctx.boundJkt) failures.push("binding");
  }
  return failures;
}

```

- **A.** function nonceOk(payload, ctx) {  
  return payload.nonce === undefined || payload.nonce === ctx.providedNonce;  
}
- **B.** function nonceOk(payload, ctx) {  
  return payload.nonce === ctx.providedNonce;  
}
- **C.** function nonceOk(payload, ctx) {  
  return typeof payload.nonce === "string";  
}
- **D.** function nonceOk(payload, ctx) {  
  return ctx.providedNonce == null || payload.nonce === ctx.providedNonce;  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：D**

D は、サーバーが nonce を提供した場合にだけ一致を求めます。A は nonce のない proof を常に受け入れるので、nonce を提供した後のダウングレード（トークン要求で nonce がないケース）を見逃します。B は、providedNonce が null で proof に nonce がないとき undefined と null を比べて失敗し、基本のケースでも "nonce" を報告します。C は nonce のない proof をすべて拒否し、値も比べないので、基本のケースでも "nonce" を報告し、異なる nonce（N0）を受け入れます。

**解説**

RFC 9449 §4.3 の検証項目のうち、ヘッダーの数・JWT の形式・署名（1・2・6 番目）以外の内容の検証を 1 つの関数にまとめる課題です。typ は dpop+jwt（4 番目）、alg は許可した非対称署名（5 番目）、jwk は秘密鍵を含まない（7 番目）、必須クレームがそろう（3 番目）、htm は大文字・小文字まで一致する（8 番目、RFC 9110 §9.1）、htu は query と fragment を除いて一致する（9 番目）、生成時刻は受理できる時間窓に収まる（11 番目、RFC 9449 §11.1 のとおり近い未来を許す場合も上限を設ける）ことを確かめます。nonce は、サーバーが提供した場合にだけ求め、提供した後は nonce のない proof を受理してはなりません（10 番目、RFC 9449 §11.3）。ath と鍵の結び付けは、アクセストークンと一緒に提示された場合の検証です（12 番目）。§4.2・§4.3 の 3 番目では、条件を満たす場合の ath・nonce も必須クレームですが、この課題では ath・nonce の欠落を "claims" ではなく "ath"・"nonce" として報告します。

**参考実装**

```javascript
import { createHash } from "node:crypto";

const PRIVATE = ["d", "p", "q", "dp", "dq", "qi", "oth"];

// 課題の制約: スキーム・ホスト（ポート）・パスを new URL() で正規化して比べ、query と fragment は無視する
function sameTarget(htu, url) {
  try {
    const a = new URL(htu);
    const b = new URL(url);
    return `${a.protocol}//${a.host}${a.pathname}` === `${b.protocol}//${b.host}${b.pathname}`;
  } catch {
    return false;
  }
}

function checkDpopClaims(header, payload, ctx) {
  const failures = [];
  if (header.typ !== "dpop+jwt") failures.push("typ");
  if (!ctx.allowedAlgs.includes(header.alg)) failures.push("alg");
  const jwk = header.jwk;
  if (jwk === null || typeof jwk !== "object" || typeof jwk.kty !== "string"
      || PRIVATE.some((name) => Object.hasOwn(jwk, name))) failures.push("jwk");
  const hasClaims = typeof payload.jti === "string" && payload.jti !== ""
    && typeof payload.htm === "string" && typeof payload.htu === "string" && typeof payload.iat === "number";
  if (!hasClaims) failures.push("claims");
  // メソッドは大文字・小文字を区別する（RFC 9110 §9.1）
  if (typeof payload.htm === "string" && payload.htm !== ctx.method) failures.push("htm");
  if (typeof payload.htu === "string" && !sameTarget(payload.htu, ctx.url)) failures.push("htu");
  if (typeof payload.iat === "number"
      && (payload.iat < ctx.now - ctx.maxAge || payload.iat > ctx.now + ctx.maxFuture)) failures.push("iat");
  // nonce を提供した後は、nonce のない proof を受理しない（RFC 9449 §11.3）
  if (ctx.providedNonce != null && payload.nonce !== ctx.providedNonce) failures.push("nonce");
  // ath と鍵の結び付けは、アクセストークンと一緒に提示された場合だけ（§4.3 の 12 番目）
  if (ctx.accessToken != null) {
    const ath = createHash("sha256").update(ctx.accessToken, "ascii").digest("base64url");
    if (payload.ath !== ath) failures.push("ath");
    if (ctx.proofJkt !== ctx.boundJkt) failures.push("binding");
  }
  return failures;
}

```

**採点基準**

- typ・alg（許可リスト）・jwk（秘密鍵を含まない）・必須クレームを検証する。（2 点）
- htm を大文字・小文字まで、htu を query を除いて照合し、iat を過去（maxAge）と未来（maxFuture）の両方で制限する。（2 点）
- サーバーが nonce を提供していれば、nonce のない proof や異なる nonce を拒否し、提供していなければ求めない。（1 点）
- アクセストークンがある場合だけ、ath をトークンから計算して比べ、proof の鍵の Thumbprint と cnf.jkt を比べる。トークン要求では ath を求めない。（2 点）

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§11.3: nonce 提供後の nonce なし proof の受理禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1393-L1396) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828) / [RFC 9110 §9.1: メソッドトークンは大文字・小文字を区別](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc9110.txt#L3728-L3758) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358)

</details>

### 7-06. nonce の保存と再試行の判断

ケースに基づく実装 / コード実装 / 6 点

クライアントのライブラリで、AS と RS の応答から DPoP の nonce を保存し、同じ要求を再試行すべきかを判断します。nonce はサーバーのオリジンごとに保存します。WWW-Authenticate は解析済みで、DPoP の challenge の error が response.dpopError に入っています。

ケースを満たす handleDpopNonce(store, url, response) を実装してください。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
// store: サーバーのオリジンごとの nonce を保存する Map（例では { オリジン: nonce } と表記）
// url: 要求した URL
// response: { status, nonces, json, dpopError }
//   nonces は応答の DPoP-Nonce ヘッダーの値の配列、json は JSON の本文（なければ null）
//   dpopError は WWW-Authenticate の DPoP の challenge の error（なければ null、解析済み）
// 戻り値: 新しい nonce で同じ要求を再試行すべきなら true
// 課題の制約: DPoP-Nonce が 2 つ以上ある応答の nonce は使わない
// 課題の制約: 再試行するのは、AS が RFC 9449 §8 の方法で、または RS が §9 の方法で、
//   use_dpop_nonce のエラーにより nonce を求めた場合だけ。その他の応答では、nonce を保存しても再試行しない
function handleDpopNonce(store, url, response) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **AS の 400 と use_dpop_nonce**

   ```text
   入力: store = {}
   url = "https://as.example.com/token"
   response = {"status":400,"nonces":["N1"],"json":{"error":"use_dpop_nonce"},"dpopError":null}
   期待: 戻り値 true、store = {"https://as.example.com":"N1"}
   ```

2. **RS の 401 と use_dpop_nonce**

   ```text
   入力: store = {"https://as.example.com":"N1"}
   url = "https://api.example.com/v1/items"
   response = {"status":401,"nonces":["N2"],"json":null,"dpopError":"use_dpop_nonce"}
   期待: 戻り値 true、store = {"https://as.example.com":"N1","https://api.example.com":"N2"}
   ```

3. **AS の 200 で新しい nonce**

   ```text
   入力: store = {"https://as.example.com":"N1"}
   url = "https://as.example.com/token"
   response = {"status":200,"nonces":["N3"],"json":{"token_type":"DPoP"},"dpopError":null}
   期待: 戻り値 false、store = {"https://as.example.com":"N3"}
   ```

4. **RS の 401 と invalid_token**

   ```text
   入力: store = {}
   url = "https://api.example.com/v1/items"
   response = {"status":401,"nonces":["N4"],"json":null,"dpopError":"invalid_token"}
   期待: 戻り値 false、store = {"https://api.example.com":"N4"}
   ```

5. **use_dpop_nonce だが DPoP-Nonce がない**

   ```text
   入力: store = {"https://as.example.com":"N1"}
   url = "https://as.example.com/token"
   response = {"status":400,"nonces":[],"json":{"error":"use_dpop_nonce"},"dpopError":null}
   期待: 戻り値 false、store = {"https://as.example.com":"N1"}
   ```

6. **DPoP-Nonce が 2 つ**

   ```text
   入力: store = {"https://as.example.com":"N1"}
   url = "https://as.example.com/token"
   response = {"status":200,"nonces":["N5","N6"],"json":{"token_type":"DPoP"},"dpopError":null}
   期待: 戻り値 false、store = {"https://as.example.com":"N1"}
   ```

7. **401 の JSON の本文に use_dpop_nonce**

   ```text
   入力: store = {}
   url = "https://api.example.com/v1/items"
   response = {"status":401,"nonces":["N7"],"json":{"error":"use_dpop_nonce"},"dpopError":null}
   期待: 戻り値 false、store = {"https://api.example.com":"N7"}
   ```

**スマホ版の問い**

handleDpopNonce が呼ぶ isNonceChallenge として、すべてのケースを満たすものはどれですか？

```javascript
function handleDpopNonce(store, url, response) {
  const origin = new URL(url).origin;
  if (response.nonces.length !== 1) return false;
  store.set(origin, response.nonces[0]);
  return isNonceChallenge(response);
}

```

- **A.** function isNonceChallenge(response) {  
  return response.json?.error === "use_dpop_nonce";  
}
- **B.** function isNonceChallenge(response) {  
  return response.status === 401 && response.dpopError === "use_dpop_nonce";  
}
- **C.** function isNonceChallenge(response) {  
  if (response.status === 400) return response.json?.error === "use_dpop_nonce";  
  if (response.status === 401) return response.dpopError === "use_dpop_nonce";  
  return false;  
}
- **D.** function isNonceChallenge(response) {  
  return response.status === 400 || response.status === 401;  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：C**

C は、400 なら JSON の error を、401 なら WWW-Authenticate の DPoP の error を見ます。A は JSON の本文だけを見るので、RS の 401 で再試行せず、401 の本文に use_dpop_nonce がある場合には再試行してしまいます。B は 401 だけを見るので、AS の 400 で再試行しません。D は 400 と 401 のすべてで再試行するので、invalid_token でも再試行します。

**解説**

RFC 9449 §8 の AS は、nonce がない要求に 400 と JSON の error=use_dpop_nonce、DPoP-Nonce ヘッダーで応答します。§9 の RS は、401 と WWW-Authenticate: DPoP（error="use_dpop_nonce"）と DPoP-Nonce を使います。§8.2 のとおり、成功応答の DPoP-Nonce も次の要求から使います。nonce は発行したサーバーでだけ受理されるので（§9）、発行したサーバーのオリジンごとに保存します。§8 はエラー応答に DPoP-Nonce を 2 つ以上含めてはならない（MUST NOT）と定め、DPoP-Nonce の値は 1 つの nonce です（§8.1・§8.2）。そこで課題では、2 つ以上ある応答の nonce を使わないことにしています。また §8 は、どの拒否応答でも新しい nonce を保存して再試行できるとしていますが、この課題では use_dpop_nonce で求められた場合だけ再試行します。

**参考実装**

```javascript
function handleDpopNonce(store, url, response) {
  // nonce は発行したサーバーでだけ使う（RFC 9449 §9）
  const origin = new URL(url).origin;
  // DPoP-Nonce は 1 つだけのはず（§8）。課題の制約として、複数あれば使わない
  if (response.nonces.length !== 1) return false;
  // エラー応答でも成功応答でも、新しい nonce を保存する（§8・§8.2）
  store.set(origin, response.nonces[0]);
  return isNonceChallenge(response);
}

function isNonceChallenge(response) {
  // AS: 400 と JSON の error（§8）。RS: 401 と WWW-Authenticate: DPoP の error（§9）
  if (response.status === 400) return response.json?.error === "use_dpop_nonce";
  if (response.status === 401) return response.dpopError === "use_dpop_nonce";
  return false;
}

```

**採点基準（各 2 点）**

- 要求先のオリジンごとに nonce を保存し、エラー応答だけでなく成功応答の DPoP-Nonce でも更新する。
- 課題の制約どおり、AS（400 と JSON の error=use_dpop_nonce）と RS（401 と WWW-Authenticate の DPoP の error="use_dpop_nonce"）の場合だけ再試行し、それ以外では再試行しない。
- DPoP-Nonce がない応答や、課題の制約どおり 2 つ以上ある応答の nonce は使わず、再試行もしない。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§8.1: nonce = 1*NQCHAR](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1161-L1168)

</details>

### 7-07. jti によるリプレイ検出

ケースに基づく実装 / コード実装 / 6 点

RS で、同じ proof の 2 回目の利用を拒否します。proof は受理できる時間窓のあいだだけ記録し、大きな jti でメモリーを使い切られないよう、jti のハッシュだけを保存します。課題の制約として、jti は query を除いた htu ごとに区別します。

ケースを満たす createReplayGuard(options) を実装してください。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
import { createHash } from "node:crypto";

// options: { windowSeconds, maxJtiLength }
// 戻り値: { check(htu, jti, iat, now) } を持つオブジェクト
//   htu は query を除いた正規化済みの URI、iat と now は秒
//   check は "accept"（初めての proof）・"replay"（同じ htu で記録済みの jti）・
//   "stale"（iat が now の前後 windowSeconds の外）・"too-large"（jti が maxJtiLength 文字を超える）を返す
// 課題の制約: jti は htu ごとに区別し、jti そのものではなく SHA-256 のハッシュだけを保存する
function createReplayGuard(options) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **未来の iat の proof の再利用**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "jti-5", 1050, 1000)
   check("https://api.example.com/orders", "jti-5", 1050, 1070)
   期待: ["accept","replay"]
   ```

2. **同じ htu・同じ jti の 2 回目**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "jti-1", 1000, 1000)
   check("https://api.example.com/orders", "jti-1", 1000, 1010)
   期待: ["accept","replay"]
   ```

3. **別の htu・同じ jti**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "jti-1", 1000, 1000)
   check("https://api.example.com/items", "jti-1", 1000, 1010)
   期待: ["accept","accept"]
   ```

4. **同じ htu・別の jti**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "jti-1", 1000, 1000)
   check("https://api.example.com/orders", "jti-2", 1005, 1010)
   期待: ["accept","accept"]
   ```

5. **先頭 16 文字が同じ別の jti**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "abcdefghijklmnop-1", 1000, 1000)
   check("https://api.example.com/orders", "abcdefghijklmnop-2", 1000, 1001)
   期待: ["accept","accept"]
   ```

6. **古い iat**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "jti-3", 900, 1000)
   期待: ["stale"]
   ```

7. **未来の iat**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "jti-4", 1100, 1000)
   期待: ["stale"]
   ```

8. **長すぎる jti**

   ```text
   入力: createReplayGuard({ windowSeconds: 60, maxJtiLength: 128 }) で作った guard で順に呼び、各 check の戻り値を順に並べる:
   check("https://api.example.com/orders", "x".repeat(200), 1000, 1000)
   期待: ["too-large"]
   ```

**スマホ版の問い**

createReplayGuard が使う keyOf として、すべてのケースを満たすものはどれですか？

```javascript
import { createHash } from "node:crypto";

function createReplayGuard({ windowSeconds, maxJtiLength }) {
  const seen = new Map();
  return {
    check(htu, jti, iat, now) {
      for (const [key, expiresAt] of seen) if (expiresAt < now) seen.delete(key);
      if (typeof jti !== "string" || jti.length > maxJtiLength) return "too-large";
      if (iat < now - windowSeconds || iat > now + windowSeconds) return "stale";
      const key = keyOf(htu, jti);
      if (seen.has(key)) return "replay";
      seen.set(key, iat + windowSeconds);
      return "accept";
    },
  };
}

```

- **A.** function keyOf(htu, jti) {  
  return jti;  
}
- **B.** function keyOf(htu, jti) {  
  return `${htu} ${jti.slice(0, 16)}`;  
}
- **C.** function keyOf(htu, jti) {  
  return htu;  
}
- **D.** function keyOf(htu, jti) {  
  return `${htu} ${createHash("sha256").update(jti, "utf8").digest("base64url")}`;  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：D**

D は htu と jti のハッシュを組み合わせます。A は jti だけをキーにするので、別の htu への同じ jti を重複と判定します。B は jti の先頭 16 文字だけを使うので、先頭が同じ別の jti を重複と判定します。C は htu だけをキーにするので、同じ htu への別の proof をすべて重複と判定します。

**解説**

RFC 9449 §11.1 は、proof を生成後の限られた時間だけ受理しなければならず（MUST）、その時間窓のあいだ対象 URI の文脈で jti を記録すれば、同じ proof の 2 回目を拒否できると述べています。記録は、その proof を受理しうるあいだ（iat + windowSeconds まで）だけ残せば足ります。記録した時刻から数えて消すと、未来の iat の proof を、まだ受理できる時間のうちに再送されます。jti を追跡するサーバーは、不必要に大きい jti を拒否するか、ハッシュだけを保存するべきだ（小文字の should）とされています。proof は query に結び付かないので（§4.2）、この課題では query を除いた htu をキーに使います。jti の先頭だけをキーにすると、別の proof を誤って重複と判定します。

**参考実装**

```javascript
import { createHash } from "node:crypto";

function createReplayGuard({ windowSeconds, maxJtiLength }) {
  const seen = new Map(); // キー -> 記録を消してよい時刻
  // 大きな jti でメモリーを使い切られないよう、ハッシュだけを保存する（RFC 9449 §11.1）
  const keyOf = (htu, jti) => `${htu} ${createHash("sha256").update(jti, "utf8").digest("base64url")}`;
  return {
    check(htu, jti, iat, now) {
      for (const [key, expiresAt] of seen) if (expiresAt < now) seen.delete(key);
      if (typeof jti !== "string" || jti.length > maxJtiLength) return "too-large";
      // 受理できる時間窓の外の proof は記録せずに拒否する
      if (iat < now - windowSeconds || iat > now + windowSeconds) return "stale";
      const key = keyOf(htu, jti);
      if (seen.has(key)) return "replay";
      // 時間窓のあいだだけ記録すれば足りる
      seen.set(key, iat + windowSeconds);
      return "accept";
    },
  };
}

```

**採点基準（各 2 点）**

- htu と jti の SHA-256 のハッシュの組をキーにして記録し、同じ組の 2 回目を "replay" とする（jti を切り詰めたり、htu だけや jti だけをキーにしたりしない）。
- iat が now の前後 windowSeconds の外なら "stale" として記録しない。記録は、その proof を受理しうるあいだ（iat + windowSeconds まで）残し、過ぎたら消す。
- maxJtiLength を超える jti を "too-large" として拒否する。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 7-08. ES256 の DER 署名を JWS の形式にする

ケースに基づく実装 / コード実装 / 6 点

Node.js の crypto.sign で ES256 の proof に署名すると、既定では DER 形式（SEQUENCE { INTEGER r, INTEGER s }）の署名が返ります。JWS の ES256 では R と S を 32 バイトずつ連結した 64 バイトが必要なので、変換する関数を作ります。

ケースを満たす derToJoseEs256(der) を実装してください。

言語：JavaScript。PC ではコードを書き、スマホではコードを読んで選びます。

**初期コード**

```javascript
// der: ECDSA P-256 の署名（ASN.1 DER の SEQUENCE { INTEGER r, INTEGER s }）の Uint8Array
// 戻り値: JWS の ES256 署名（R と S を 32 バイトずつ連結した 64 バイト）の Uint8Array
// 形式が正しくなければ TypeError を投げる
function derToJoseEs256(der) {
  // ケースと制約を満たす処理を書いてください。
}

```

**ケース**

1. **R の先頭に 0x00（33 バイト）**

   ```text
   入力: Uint8Array（16 進）: 3045022100cdcb2796abeb564a9fe28e3d0104df3ed514fb80590ec44c4a0d149dc0681d6b0220539b119a68aad783992c833601f560c25ab786bb3b1a4ed90a602c44e0fba168
   期待: 64 バイト（16 進）: cdcb2796abeb564a9fe28e3d0104df3ed514fb80590ec44c4a0d149dc0681d6b539b119a68aad783992c833601f560c25ab786bb3b1a4ed90a602c44e0fba168
   ```

2. **R が 31 バイト**

   ```text
   入力: Uint8Array（16 進）: 3043021f3cf0190d29ace8d8796ba80c7688ae2f6076d729f5869c9e612ab3e904c156022012cbad868d71ea7d3ed77664bf38a978ec7e6de8d177255cf9bca00fbade00ef
   期待: 64 バイト（16 進）: 003cf0190d29ace8d8796ba80c7688ae2f6076d729f5869c9e612ab3e904c15612cbad868d71ea7d3ed77664bf38a978ec7e6de8d177255cf9bca00fbade00ef
   ```

3. **R・S とも 32 バイト**

   ```text
   入力: Uint8Array（16 進）: 3044022043e71381557b7687e25b945e9fc88a40e59ad4ae029480d4a4ed2fa7f3dd127a02206062866f353dbd3813c3ea5d284f81b92735ea1275b0039be80a290c3be0dcdc
   期待: 64 バイト（16 進）: 43e71381557b7687e25b945e9fc88a40e59ad4ae029480d4a4ed2fa7f3dd127a6062866f353dbd3813c3ea5d284f81b92735ea1275b0039be80a290c3be0dcdc
   ```

4. **SEQUENCE ではない（先頭が 0x31）**

   ```text
   入力: Uint8Array（16 進）: 3144022043e71381557b7687e25b945e9fc88a40e59ad4ae029480d4a4ed2fa7f3dd127a02206062866f353dbd3813c3ea5d284f81b92735ea1275b0039be80a290c3be0dcdc
   期待: TypeError を投げる
   ```

5. **R が 34 バイト**

   ```text
   入力: Uint8Array（16 進）: 30460222000043e71381557b7687e25b945e9fc88a40e59ad4ae029480d4a4ed2fa7f3dd127a02206062866f353dbd3813c3ea5d284f81b92735ea1275b0039be80a290c3be0dcdc
   期待: TypeError を投げる
   ```

6. **末尾に余分なバイト**

   ```text
   入力: Uint8Array（16 進）: 3044022043e71381557b7687e25b945e9fc88a40e59ad4ae029480d4a4ed2fa7f3dd127a02206062866f353dbd3813c3ea5d284f81b92735ea1275b0039be80a290c3be0dcdc00
   期待: TypeError を投げる
   ```

**スマホ版の問い**

derToJoseEs256 が呼ぶ toFixed32 として、すべてのケースを満たすものはどれですか？

```javascript
function derToJoseEs256(der) {
  let i = 0;
  if (der[i++] !== 0x30 || der[i++] !== der.length - 2) throw new TypeError("bad SEQUENCE");
  const readInt = () => {
    if (der[i++] !== 0x02) throw new TypeError("INTEGER expected");
    const len = der[i++];
    if (!(len >= 1 && len <= 33) || i + len > der.length) throw new TypeError("bad INTEGER length");
    const bytes = der.subarray(i, i + len);
    i += len;
    return toFixed32(bytes);
  };
  const r = readInt();
  const s = readInt();
  if (i !== der.length) throw new TypeError("trailing bytes");
  const sig = new Uint8Array(64);
  sig.set(r, 0);
  sig.set(s, 32);
  return sig;
}

```

- **A.** function toFixed32(bytes) {  
  if (bytes.length !== 32) throw new TypeError("INTEGER must be 32 bytes");  
  return bytes;  
}
- **B.** function toFixed32(bytes) {  
  let b = bytes;  
  while (b.length > 1 && b[0] === 0x00) b = b.subarray(1);  
  if (b.length > 32) throw new TypeError("INTEGER too large");  
  const out = new Uint8Array(32);  
  out.set(b, 32 - b.length);  
  return out;  
}
- **C.** function toFixed32(bytes) {  
  const out = new Uint8Array(32);  
  out.set(bytes, 32 - bytes.length);  
  return out;  
}
- **D.** function toFixed32(bytes) {  
  let b = bytes;  
  while (b.length > 1 && b[0] === 0x00) b = b.subarray(1);  
  if (b.length > 32) throw new TypeError("INTEGER too large");  
  const out = new Uint8Array(32);  
  out.set(b, 0);  
  return out;  
}

<details>
<summary>解答・解説</summary>

**スマホ版の正解：B**

B は先頭の 0x00 を取り除き、先頭を 0 で埋めて 32 バイトにします。A は 32 バイト以外の INTEGER を拒否するので、先頭に 0x00 が付いた R や 31 バイトの R で TypeError を投げます。C は先頭の 0x00 を取り除かないので、33 バイトの R を 32 バイトの配列に入れられず RangeError になります。D は値を前に詰めて後ろを 0 で埋めるので、31 バイトの R の値が変わります。

**解説**

RFC 7518 §3.4 は、ES256 の署名を、R と S をそれぞれ 32 オクテットのビッグエンディアンにして R、S の順に連結した 64 オクテットとし、先頭の 0 のオクテットを省いてはならない（MUST NOT）と定めています。DER の INTEGER は符号付きなので、最上位ビットが 1 の値には 0x00 が前に付いて 33 バイトになり、値が小さければ 31 バイト以下になります。そのため、先頭の 0x00 を取り除いてから、先頭を 0 で埋めて 32 バイトにします。Node.js では crypto.sign の dsaEncoding: "ieee-p1363" で、最初から R||S を得ることもできます。ケースの署名は、RFC 7515 付録 A.3 の鍵で ASCII の文字列 "dpop-1"（R の先頭に 0x00）、"dpop-334"（R が 31 バイト）、"dpop-3"（R・S とも 32 バイト）に署名したもので、期待する 64 バイトはその公開鍵で検証できます。DER の INTEGER は最小の長さで符号化するので、先頭の 0x00 は次のバイトの最上位ビットが 1 のときの 1 バイトだけです。P-256 の r・s は 32 バイトに収まるので INTEGER は最大 33 バイトで、34 バイトの INTEGER は不正です。

**参考実装**

```javascript
function derToJoseEs256(der) {
  if (!(der instanceof Uint8Array)) throw new TypeError("der must be a Uint8Array");
  let i = 0;
  // SEQUENCE（P-256 の署名は短い形式の長さに収まる）
  if (der[i++] !== 0x30 || der[i++] !== der.length - 2) throw new TypeError("bad SEQUENCE");
  const readInt = () => {
    if (der[i++] !== 0x02) throw new TypeError("INTEGER expected");
    const len = der[i++];
    if (!(len >= 1 && len <= 33) || i + len > der.length) throw new TypeError("bad INTEGER length");
    let bytes = der.subarray(i, i + len);
    i += len;
    // 正の数を表すための先頭の 0x00 を取り除く
    while (bytes.length > 1 && bytes[0] === 0x00) bytes = bytes.subarray(1);
    if (bytes.length > 32) throw new TypeError("INTEGER too large");
    // 先頭の 0 を省かず 32 バイトの固定長にする（RFC 7518 §3.4）
    const out = new Uint8Array(32);
    out.set(bytes, 32 - bytes.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  if (i !== der.length) throw new TypeError("trailing bytes");
  const sig = new Uint8Array(64);
  sig.set(r, 0);
  sig.set(s, 32);
  return sig;
}

```

**採点基準（各 2 点）**

- SEQUENCE と 2 つの INTEGER のタグと長さを読み、形式が合わない場合（タグの違い、長すぎる INTEGER、余分なバイト）は TypeError を投げる。
- INTEGER の先頭の 0x00 を取り除き、32 バイトに満たない値は先頭を 0 で埋めて 32 バイトにする（先頭の 0 を省かない）。
- R、S の順に連結した 64 バイトを返す。

**出典：** [RFC 7518 §3.4: ECDSA 署名は R と S を固定長で連結した値](https://github.com/maronnjapan/readRFCInMobile/blob/1ae11d196faad317d95d4d02e402621dcde76d49/rfcs/rfc7518.txt#L455-L539) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

## 理解を確認する最後の問い

資料を閉じて、次の問いに自分の言葉で答えてください。

- 「MUST だが条件付き」の要件を 3 つ挙げ、それぞれ何が起きたときに必須になるか（第 1 部）。
- DPoP の検証のうち、JWS ライブラリが行うものとアプリケーションが行うものはどれか（第 2 部）。
- jkt・ath・dpop_jkt・code_challenge は、それぞれ何をハッシュし、何と何を結び付けるか（第 3 部・第 5 部）。
- htu と要求の URI が「同じ」と言えるのはどんな正規化の後か。query・末尾のスラッシュ・パーセントエンコーディングはどう扱うか（第 4 部）。
- DPoP と mTLS のどちらを選ぶかを、ブラウザー、TLS 終端、鍵の更新、refresh token の観点で説明できるか（第 6 部）。
