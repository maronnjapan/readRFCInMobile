# RFC 9449 DPoP 問題集（80 問）

保存済みの [RFC 9449](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt) を根拠に、基本概念から実装レビューまで 4 段階で学ぶ問題集です。出典はコミット `993c1cf7f6b5fd47c151a56d60bb801bdd921aac` に固定しています。各問の解説には該当する節と本文へのリンクがあり、記述式には配点付きの採点基準があります。

## 学習の進め方

1. 第 1 部から順に解き、各問の「解答・解説」を開く前に回答を決めてください。
2. 選択式は正答の理由に加え、他の選択肢がどこで仕様と食い違うかも説明してください。並べ替えは表示ラベル A〜D を順番に並べます。
3. 記述式は短い箇条書きで構いません。自分の回答を採点基準と照合し、分からなかった項目は出典本文へ戻ってください。
4. 全問に正解した後、資料を閉じて各部末尾の設計問題と 4-20 の総合レビューをやり直してください。採点基準を満たし、保護できる範囲と限界を説明できることを到達目標にします。

「MUST / MUST NOT」「SHOULD / SHOULD NOT」「MAY / OPTIONAL」の強さを区別してください。導入時に選べる機能も、採用後には必須になる条件があります。仕様にない固定の有効秒数、必須の保存方式、すべての環境での XSS 防止効果などを仮定しないでください。

| 順番 | 内容 | 構成 | 問題アプリ用データ |
| --- | --- | --- | --- |
| [第 1 部](#part-1) | 基本概念と proof の読み方 | 選択 17・並べ替え 1・記述 2 | [JSON](../questions/spec/rfc-9449-01-foundations.json) |
| [第 2 部](#part-2) | トークン発行と受信時の検証 | 選択 17・並べ替え 1・記述 2 | [JSON](../questions/spec/rfc-9449-02-validation.json) |
| [第 3 部](#part-3) | nonce・認可コード・PAR | 選択 17・並べ替え 1・記述 2 | [JSON](../questions/spec/rfc-9449-03-nonce-code.json) |
| [第 4 部](#part-4) | 攻撃シナリオと実装レビュー | 選択 17・並べ替え 1・記述 2 | [JSON](../questions/spec/rfc-9449-04-security.json) |

計 80 問（選択式 68・並べ替え 4・記述式 8）です。選択式は各 1 点、並べ替えは各 2 点、記述式は各採点基準に配点しています。

## 仕様の範囲と対応問題

| RFC 9449 の節 | 確認する内容 | 主な問題 |
| --- | --- | --- |
| §1〜§3 | 目的、役割、HTTPS、クライアント認証との違い | 1-01〜1-05、1-17、1-19 |
| §4・§4.1 | proof の役割、ヘッダー、単独で認可しない理由 | 1-06、1-16、1-18、2-01〜2-02 |
| §4.2 | typ・alg・jwk・jti・htm・htu・iat・ath・nonce | 1-07〜1-15、1-20、2-07 |
| §4.3 | 全検証項目、URI 正規化、時間窓、検証順序 | 2-01〜2-06、2-19 |
| §5〜§5.2 | grant、token_type、refresh token、メタデータ | 2-13〜2-18、2-20 |
| §6〜§6.2 | cnf.jkt、JWK Thumbprint、introspection | 2-03〜2-04、2-09〜2-12 |
| §7・§7.1 | ath、認証スキーム、challenge、CORS、プロキシでの使用禁止 | 1-14、1-20、2-08、3-08、4-16 |
| §7.2・§7.3 | Bearer 互換性、複数 challenge、通信再試行 | 4-04、4-15、4-17 |
| §8〜§9 | nonce、エラー、更新、構文、保存、発行元の区別 | 3-01〜3-13、3-19 |
| §10・§10.1 | dpop_jkt、PKCE、PAR の 2 方式 | 3-14〜3-18、3-20 |
| §11.1 | リプレイ、時計差、jti、資源消費 | 2-06、3-13、4-01〜4-04、4-19 |
| §11.2 | proof 事前生成とトークン寿命 | 3-01、4-05〜4-07 |
| §11.3 | nonce ダウングレード | 3-12、4-20 |
| §11.4 | 非抽出鍵、XSS、攻撃者の鍵への付け替え | 4-08〜4-09、4-18 |
| §11.5・§11.6 | JWT の用途の取り違え、安全な非対称署名 | 1-07〜1-08、4-10、4-20 |
| §11.7 | 本文・一般のヘッダーの完全性 | 1-05、4-11 |
| §11.8 | 鍵とトークンの hash の安全性 | 4-13 |
| §11.9 | 認可コードと公開鍵の結び付け | 3-16、3-20 |
| §11.10 | SHA-256 と署名アルゴリズムの区別 | 2-07、4-12 |
| §11.11 | クライアント認証との結び付きの限界 | 4-14 |
| §12 | 登録された token type・エラー・media type・パラメーター等の利用 | 1-06〜1-07、2-10、2-14、2-18、3-14、4-16 |

## 問題アプリで使う場合

このページではそのまま自習できます。アプリで回答履歴や採点を使う場合は、main に反映した 4 ファイルを既存の公開手順で取り込みます。GitHub への保存と、出題サービスの DB への取り込みは別の操作です。各 JSON の `published` はレビュー済みであることを表します。

作問用の接続設定と Access Service Token を設定した環境で、リポジトリのルートから次を実行します。`QUIZ_COMMIT` には 4 ファイルを含む main 上の 40 文字のコミット SHA を指定してください。

```sh
QUIZ_COMMIT='4ファイルを含む40文字のコミットSHAに置き換える'
npm run author --workspace @rfc-reader/quiz -- publish --commit "$QUIZ_COMMIT" --path apps/quiz/questions/spec/rfc-9449-01-foundations.json
npm run author --workspace @rfc-reader/quiz -- publish --commit "$QUIZ_COMMIT" --path apps/quiz/questions/spec/rfc-9449-02-validation.json
npm run author --workspace @rfc-reader/quiz -- publish --commit "$QUIZ_COMMIT" --path apps/quiz/questions/spec/rfc-9449-03-nonce-code.json
npm run author --workspace @rfc-reader/quiz -- publish --commit "$QUIZ_COMMIT" --path apps/quiz/questions/spec/rfc-9449-04-security.json
```

各コマンドが返す出題 URL から開始できます。4 セットの仕様 ID は共通の `rfc-9449` なので、`/quiz?spec=rfc-9449` に一覧表示されます。接続設定の詳細は[運用手順](quiz-service.md#レビュー固定版の公開)を参照してください。

<a id="part-1"></a>

## 第 1 部：基本概念と proof の読み方

20 問・28 点。

### 1-01. 送信者制約

単語の意味 / 選択式 / 1 点

**用語：sender-constrained token（送信者制約付きトークン）**

この用語が表す仕組みはどれですか？

- **A.** client_id を知っている送信者なら同じトークンを使えるようにする
- **B.** トークンの利用時に、結び付いた公開鍵に対応する秘密鍵の所持を証明させる
- **C.** トークンを受け取った端末の IP アドレスを常に固定する
- **D.** 公開鍵でトークンを暗号化し、RS に復号させる

<details>
<summary>解答・解説</summary>

**正解：B**

§1・§2。sender-constraining は、トークンを鍵に結び付け、利用時に対応する秘密鍵の所持証明を要求する仕組みです。client_id や IP アドレスへの固定、トークンの暗号化そのものを意味しません。

**出典：** [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253)

</details>

### 1-02. Bearer との違い

比較・使い分け / 選択式 / 1 点

有効なアクセストークンだけが漏えいし、対応する秘密鍵も使用可能な proof も漏れていません。Bearer と DPoP-bound で何が違いますか？

- **A.** どちらもトークンの文字列だけで必ず利用できる
- **B.** Bearer には必ずクライアントシークレットが必要になる
- **C.** DPoP は漏えいしたアクセストークンを自動的に失効させる
- **D.** Bearer は所持だけで利用できるが、DPoP を検証する RS では秘密鍵の所持証明も必要になる

<details>
<summary>解答・解説</summary>

**正解：D**

§2。Bearer はトークンを持つ者が利用できます。DPoP 対応の RS は鍵の所持証明も検証するため、トークン単体の盗難による悪用を抑えます。DPoP が漏えいを検知して失効するわけではありません。DPoP 非対応 RS との互換性は §7.2 の別の論点です。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021)

</details>

### 1-03. AS と RS の役割

知識 / 選択式 / 1 点

DPoP の基本フローで、AS と RS の責務の組み合わせはどれですか？

- **A.** AS が発行トークンを proof の公開鍵に結び付け、RS が利用時の proof・トークン・鍵の結び付きを検証する
- **B.** AS がクライアントの秘密鍵を RS に配り、RS が proof を作る
- **C.** RS が proof の公開鍵だけを見てトークンを発行する
- **D.** AS が毎回 API の本文を署名し、RS がクライアントに返す

<details>
<summary>解答・解説</summary>

**正解：A**

§3。クライアントが秘密鍵で proof を作成します。AS はその公開鍵にトークンを結び付け、RS は利用時の proof の署名、対象リクエスト、ath、トークンとの鍵の一致などを検証します。秘密鍵を AS や RS に渡しません。

**出典：** [§3: AS・クライアント・RS の役割と基本フロー](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L255-L335)

</details>

### 1-04. クライアント認証との違い

比較・使い分け / 選択式 / 1 点

DPoP と private_key_jwt などのクライアント認証の関係はどれですか？

- **A.** どちらも client_id の登録済み秘密鍵だけを使う、同じ認証方式である
- **B.** DPoP を使う confidential client はクライアント認証を省略できる
- **C.** DPoP は鍵の所持とトークン利用を結び付ける仕組みで、クライアント認証と併用できる
- **D.** private_key_jwt を使うクライアントは DPoP を使えない

<details>
<summary>解答・解説</summary>

**正解：C**

§1・§3。DPoP 自体はクライアント認証ではありません。認証クレデンシャルのない public client でも使え、private_key_jwt などのクライアント認証とも併用できます。DPoP があることを理由に、必要なクライアント認証を省略できません。

**出典：** [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§3: AS・クライアント・RS の役割と基本フロー](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L255-L335)

</details>

### 1-05. HTTPS の要件

誤り発見・原因特定 / 選択式 / 1 点

開発者が「DPoP proof に署名したので、トークンと API の通信を平文 HTTP に変更してよい」と判断しました。

この判断の問題点はどれですか？

- **A.** DPoP は本文も暗号化するが、レスポンスだけは HTTPS にする必要がある
- **B.** DPoP は安全なトランスポートの代替ではなく、常に HTTPS と併用しなければならない
- **C.** HTTP でも nonce があれば RFC の要件を満たす
- **D.** htm を HTTPS にすればトランスポート層も保護できる

<details>
<summary>解答・解説</summary>

**正解：B**

§2 は DPoP を常に HTTPS と併用することを MUST としています。DPoP はリクエスト全体の機密性・完全性を提供しません。htm は GET や POST などの HTTP メソッドであり、通信方式ではありません。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§11.7: 本文・一般のヘッダーの完全性と TLS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1448-L1464) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 1-06. proof の形式

知識 / 選択式 / 1 点

DPoP proof の表現として正しいものはどれですか？

- **A.** AS が署名するアクセストークンそのもの
- **B.** 公開鍵で暗号化したリクエスト本文
- **C.** クライアントが選んだ秘密鍵で JWS 署名した JWT
- **D.** JWT に似た構造を持つが署名を省略した JSON

<details>
<summary>解答・解説</summary>

**正解：C**

§4.2。proof はクライアントが秘密鍵で JWS 署名した JWT です。アクセストークンとは別のデータです。§12.5 では application/dpop+jwt が登録されていますが、DPoP 利用のためにトークン要求本文の Content-Type をこの値へ変更するという意味ではありません。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§12.1〜12.5: token type、エラー、dpop_jkt、認証スキーム、media type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1550-L1629)

</details>

### 1-07. typ の役割

単語の意味 / 選択式 / 1 点

**用語：JOSE Header の typ: dpop+jwt**

このフィールドの主な役割はどれですか？

- **A.** JWT を DPoP proof 用と明示し、別用途の JWT と取り違えないようにする
- **B.** HTTP メソッドが GET か POST かを指定する
- **C.** アクセストークンの失効日時を指定する
- **D.** クライアントの登録済み認証方式を指定する

<details>
<summary>解答・解説</summary>

**正解：A**

§4.2・§11.5。typ の値 dpop+jwt は JWT の用途を明示します。サーバーはこの値を必ず確認し、署名が正しくても別用途の JWT を proof として受理しないようにします。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§11.5: typ による別用途 JWT の受理防止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1435-L1439)

</details>

### 1-08. 署名アルゴリズム

誤り発見・原因特定 / 選択式 / 1 点

実装が proof の alg をそのまま署名ライブラリへ渡し、none と HS256 も受理していました。

RFC 9449 に沿った修正はどれですか？

- **A.** none だけ拒否し、HS256 は許可する
- **B.** 公開鍵を HMAC の共有鍵に変換して HS256 を許可する
- **C.** 署名ライブラリに登録された alg なら無条件に許可する
- **D.** 安全と判断した非対称署名アルゴリズムだけを、対応状況とローカルポリシーを確認して許可する

<details>
<summary>解答・解説</summary>

**正解：D**

§4.2・§4.3・§11.6。alg は登録された非対称デジタル署名アルゴリズムで、実装が対応し、ローカルポリシーでも許容される必要があります。none と HS256 のような対称 MAC は不可です。登録済みであることだけでは十分ではありません。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.6: 安全な非対称署名アルゴリズムのみの許可](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1441-L1446)

</details>

### 1-09. 公開 JWK

誤り発見・原因特定 / 選択式 / 1 点

クライアントが EC JWK の公開鍵成分に加えて秘密鍵成分 d も DPoP proof の JOSE Header に入れ、サーバーは署名が通れば受理していました。

この実装に必要な修正はどれですか？

- **A.** d を暗号化して同じ jwk に残す
- **B.** jwk には公開鍵だけを含め、受信側も秘密鍵を含む jwk を拒否する
- **C.** jwk 全体を削除し、必須フィールドを kid だけにする
- **D.** 秘密鍵を Authorization ヘッダーへ移す

<details>
<summary>解答・解説</summary>

**正解：B**

§4.2 は jwk に秘密鍵を含めてはならない (MUST NOT) とし、§4.3 は受信側の確認も要求します。公開鍵から署名を検証できるため、EC 秘密鍵成分 d を送信する必要はありません。kid だけで必須の jwk を置き換えることもできません。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 1-10. jti の一意性

知識 / 選択式 / 1 点

jti の生成方法について、仕様の要求と例を正しく説明したものはどれですか？

- **A.** 常に UUID v4 だけを使わなければならない
- **B.** 同じ鍵を使う間は一定値でよい
- **C.** 同じ文脈・有効時間内で衝突が無視できるほど小さくなるよう割り当てる。96 bit 以上の擬似乱数や UUID v4 はその例である
- **D.** iat と同じ秒数を文字列にすれば一意性の要求を必ず満たす

<details>
<summary>解答・解説</summary>

**正解：C**

§4.2。要求は、同じ文脈の有効時間内に別の proof と同じ jti が割り当てられる確率を無視できるほど小さくすることです。96 bit 以上の擬似乱数や UUID v4 は方法の例で、UUID の使用だけが必須なのではありません。秒単位の時刻だけでは同時要求で衝突します。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 1-11. 基本の必須クレーム

知識 / 選択式 / 1 点

nonce 未提供の AS に、アクセストークンを提示せず認可コードを交換します。標準の DPoP proof に常に必要な payload の組はどれですか？

- **A.** jti・htm・htu・iat
- **B.** iss・sub・aud・exp
- **C.** jti・ath・client_secret
- **D.** nonce・state・code_verifier

<details>
<summary>解答・解説</summary>

**正解：A**

§4.2。基本の必須クレームは jti・htm・htu・iat です。ath はアクセストークンを提示して保護リソースへアクセスするとき、nonce はサーバーから提供されたときの条件付き必須です。iss・sub・aud・exp をこの仕様の一律の必須フィールドとして追加してはいけません。拡張による追加は可能です。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.2: トークン要求の proof 例と署名範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L450-L483)

</details>

### 1-12. メソッドの一致

誤り発見・原因特定 / 選択式 / 1 点

署名とトークンは有効ですが、GET /orders 向けに htm=GET で作った proof が POST /orders に付いていました。

RS の適切な判断はどれですか？

- **A.** 同じ URI なので受理する
- **B.** 署名が有効なので htm を書き換えて受理する
- **C.** ath があれば HTTP メソッドは確認しない
- **D.** htm が現在の HTTP メソッドと一致しないので拒否する

<details>
<summary>解答・解説</summary>

**正解：D**

§4.3。htm は現在の HTTP リクエストのメソッドと一致しなければなりません。署名が有効でも、別のメソッド向けに作った proof を受理できません。ath はトークン値への結び付けで、メソッド照合の代替にはなりません。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 1-13. htu と query

誤り発見・原因特定 / 選択式 / 1 点

クライアントが URL https://api.example.com/orders?status=open#summary を使って保護リソースへアクセスする proof を作ります。

htu として入れる値はどれですか？

- **A.** https://api.example.com/orders?status=open#summary
- **B.** https://api.example.com/orders
- **C.** /orders?status=open
- **D.** api.example.com

<details>
<summary>解答・解説</summary>

**正解：B**

§4.2・§4.3。htu は HTTP のターゲット URI から query と fragment を除いた値です。この例では https://api.example.com/orders です。fragment は通常 HTTP 要求として送られず、query も DPoP の標準の URI 照合対象から除かれます。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 1-14. ath の役割

単語の意味 / 選択式 / 1 点

**用語：ath（access token hash）**

このクレームは何を結び付けますか？

- **A.** DPoP 公開鍵と client_id
- **B.** 認可コードと code_verifier
- **C.** DPoP proof と、そのリクエストで提示するアクセストークンの値
- **D.** HTTP 本文と Content-Type ヘッダー

<details>
<summary>解答・解説</summary>

**正解：C**

§4.2・§7。ath はアクセストークンのハッシュで、proof を特定のトークン値に結び付けます。公開鍵の thumbprint は jkt、認可要求での鍵の指定は dpop_jkt であり、ath とは対象が違います。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

### 1-15. nonce の条件付き必須

知識 / 選択式 / 1 点

nonce クレームの扱いとして正しいものはどれですか？

- **A.** すべての proof にクライアントが乱数 nonce を作って入れる
- **B.** nonce を使う場合は iat を省略できる
- **C.** nonce は AS だけが使い、RS は使えない
- **D.** サーバーが DPoP-Nonce を提供したら、そのサーバー向けの proof に提供された nonce を含める

<details>
<summary>解答・解説</summary>

**正解：D**

§4.2・§8・§9。nonce 機構の採用はサーバーが選択しますが、提供された後は対応する proof に nonce が必要です。クライアントが独自の値を代わりに作るのではありません。iat は基本の必須クレームなので、nonce があっても省略しません。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235)

</details>

### 1-16. ヘッダー名と値の文字の区別

比較・使い分け / 選択式 / 1 点

HTTP ヘッダー名 DPoP と dpop、およびヘッダー値の扱いとして正しいものはどれですか？

- **A.** ヘッダー名は同じ意味だが、JWT を含む値の大文字・小文字は維持する
- **B.** ヘッダー名も値も、全体を小文字にしてよい
- **C.** ヘッダー名が DPoP でない場合は必ず拒否する
- **D.** 値の英大文字だけを小文字に変換して署名を検証する

<details>
<summary>解答・解説</summary>

**正解：A**

§4.1。HTTP ヘッダー名は大文字・小文字を区別しないため DPoP・DPOP・dpop は等価です。一方、値では区別が重要です。JWT の文字列を小文字へ変換すると値や署名対象を破壊します。

**出典：** [§4.1: DPoP HTTP ヘッダーの構文と大文字・小文字](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L359-L391)

</details>

### 1-17. 基本フロー

フロー構築 / 並べ替え / 2 点

nonce を使わない成功フローを並べてください。認可グラントの取得は済んでおり、鍵 K を一貫して使います。

- **A.** クライアントが新しい proof とアクセストークンを RS に送る
- **B.** クライアントがトークン要求に鍵 K の proof を付けて AS に送る
- **C.** RS が proof・トークン・結び付きを検証し、保護リソースを返す
- **D.** AS が検証し、鍵 K に結び付いたトークンを token_type=DPoP として返す

<details>
<summary>解答・解説</summary>

**正解：B → D → A → C**

§3。トークン要求 → 鍵に結び付いたトークンの発行 → RS 向けの新しい proof を付けた利用要求 → RS の検証と応答、の順です。トークン要求で使った proof を RS に使い回しません。

**出典：** [§3: AS・クライアント・RS の役割と基本フロー](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L255-L335) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 1-18. proof 単独でのアクセス許可

誤り発見・原因特定 / 選択式 / 1 点

API が「DPoP proof の署名検証に成功したら、アクセストークンがなくても顧客情報を返す」と実装されていました。

何を修正する必要がありますか？

- **A.** proof の jti が UUID なら、このままでよい
- **B.** 公開鍵が一致するかだけを追加で確認すればよい
- **C.** アクセストークン自体の有効性・権限と DPoP 関連のすべての検証を満たした場合だけ許可する
- **D.** proof に client_id を追記すればトークンを不要にできる

<details>
<summary>解答・解説</summary>

**正解：C**

§4・§3・§7.1。proof 単独は認証・アクセス制御の仕組みではありません。誰でも自分の鍵で署名できるため、署名成功だけでは権限を示せません。通常のトークン検証に加え、proof のリクエスト適合性、ath、鍵の結び付きなどを検証します。

**出典：** [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [§3: AS・クライアント・RS の役割と基本フロー](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L255-L335) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854)

</details>

### 1-19. 既存クライアント認証との併用設計

ユースケース設計 / 記述式 / 4 点

既存の confidential client は private_key_jwt で AS に認証しています。アクセストークンを RS に提示する部分へ DPoP を導入し、HTTPS は継続します。

認証と DPoP の役割、トークン要求・応答・リソース要求で必要になる変更を説明してください。

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

private_key_jwt によるクライアント認証を継続します。トークン要求にはクライアント側の DPoP 鍵で作った proof を別に付け、AS は公開鍵へアクセストークンを結び付けて token_type=DPoP を返します。RS には Authorization: DPoP &lt;access_token&gt; と、そのトークンの ath を含むリクエスト用の新しい DPoP proof を送ります。DPoP 用の鍵と認証用の鍵が自動的に同一であると仮定する必要はありません。

**採点基準（各 1 点）**

- DPoP はクライアント認証の代替ではなく、既存の private_key_jwt 認証を継続すると説明する。
- トークン要求に DPoP ヘッダーで proof を付け、AS がその公開鍵へトークンを結び付けると説明する。
- DPoP-bound の発行を token_type=DPoP で確認すると説明する。
- RS へ Authorization: DPoP でトークンを送り、ath を含む別のリクエスト用 proof を DPoP ヘッダーに付けると説明する。

**出典：** [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148) / [§3: AS・クライアント・RS の役割と基本フロー](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L255-L335) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 1-20. API 要求用 proof の組み立て

ユースケース設計 / 記述式 / 5 点

鍵 K に結び付いたアクセストークン T を持ち、GET https://api.example.com/accounts?limit=10 を送ります。RS は nonce N を提供済みです。暗号処理のコードは不要です。

proof の JOSE Header と payload に何を入れ、どの秘密鍵で署名し、トークンと proof をどう送りますか？

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

JOSE Header は typ=dpop+jwt、許可された非対称署名 alg、鍵 K の公開 JWK です。payload には新しい jti、htm=GET、htu=https://api.example.com/accounts、生成時刻 iat、T の ASCII バイト列を SHA-256 でハッシュし base64url で表した ath、nonce=N を入れ、K の秘密鍵で署名します。Authorization: DPoP T と DPoP: &lt;proof&gt; を HTTPS の要求に付けます。query を htu に含めず、秘密鍵を jwk に入れません。

**採点基準（各 1 点）**

- typ=dpop+jwt、対応する非対称署名 alg、K の公開 JWK を含め、秘密鍵をヘッダーへ入れない。
- 新しい一意な jti と生成時刻 iat を含める。
- htm=GET、htu=https://api.example.com/accounts とし query を除く。
- T の ASCII バイト列の SHA-256 を base64url で表す ath と、提供された nonce=N を含める。
- K の秘密鍵で署名し、HTTPS で Authorization: DPoP T と DPoP: &lt;proof&gt; を送る。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854) / [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253)

</details>

<a id="part-2"></a>

## 第 2 部：トークン発行と受信時の検証

20 問・29 点。

### 2-01. 複数の DPoP ヘッダー

誤り発見・原因特定 / 選択式 / 1 点

同じ要求に DPoP ヘッダーが 2 個あります。片方の JWT は有効で、もう片方は無効です。

適切な処理はどれですか？

- **A.** 有効な proof が 1 つでもあれば受理する
- **B.** 2 つの JWT をカンマで連結して署名検証する
- **C.** DPoP ヘッダーフィールドが複数ある要求を拒否する
- **D.** 最後のヘッダーだけを採用する

<details>
<summary>解答・解説</summary>

**正解：C**

§4.3。DPoP HTTP リクエストヘッダーフィールドは複数あってはならず、値は単一で正しい形式の JWT である必要があります。複数値から都合のよい proof を選ぶ処理では、送信者と受信者の解釈が食い違います。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 2-02. 単一の JWT

知識 / 選択式 / 1 点

DPoP ヘッダーの値について、受信側が要求すべきものはどれですか？

- **A.** 単一の、正しい形式の JWT
- **B.** 複数の JWT を並べた JSON 配列
- **C.** 公開鍵の PEM テキストだけ
- **D.** 署名を取り除いた JWT payload だけ

<details>
<summary>解答・解説</summary>

**正解：A**

§4.3 の検証項目 2 は、ヘッダー値が単一で正しい形式の JWT であることを要求します。さらに必須クレーム・typ・alg・署名なども検証します。形式が JWT であるというだけで有効な proof になるわけではありません。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 2-03. 署名検証に使う公開鍵

知識 / 選択式 / 1 点

DPoP proof JWT の署名を検証する公開鍵は、どこから取得しますか？

- **A.** アクセストークンを署名した AS の公開鍵を必ず使う
- **B.** proof の jti に埋め込まれた公開鍵を使う
- **C.** トークンの sub が指定する任意の URL から取得する
- **D.** proof の JOSE Header の jwk を使い、別途トークンへの鍵の結び付きも確認する

<details>
<summary>解答・解説</summary>

**正解：D**

§4.3。proof の署名はその JOSE Header の jwk で検証します。JWT 形式のアクセストークンの発行者署名を検証する鍵とは役割が違います。RS では、署名の成功に加え、その公開鍵がトークンに結び付いた鍵と一致することも必須です。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854)

</details>

### 2-04. トークンと違う鍵

誤り発見・原因特定 / 選択式 / 1 点

トークン T は鍵 K1 に結び付いています。要求の proof は別の鍵 K2 で正しく署名され、ath は T と一致しています。他のクレームも妥当です。

RS はどう判断すべきですか？

- **A.** 署名が正しければ受理してよい
- **B.** proof の鍵とトークンに結び付いた鍵が一致しないので拒否する
- **C.** 同じクライアントからの通信ならトークンの結び付きを更新する
- **D.** ath を削除すれば利用できる

<details>
<summary>解答・解説</summary>

**正解：B**

§4.3・§6・§7.1。署名の成功は K2 の所持を示すだけです。K1 に結び付いたトークンを使う権限を示さないため、RS は拒否します。RS が受信した proof に合わせてトークンの鍵の結び付きを変更してはいけません。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§6: RS が取得する鍵の結び付け情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L684-L699) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854)

</details>

### 2-05. URI の正規化

知識 / 選択式 / 1 点

htu の照合について、RFC 9449 が SHOULD として推奨する処理はどれですか？

- **A.** URI 全体を小文字にし、パスの大文字・小文字も区別しない
- **B.** ホスト名だけが一致すれば、パスは異なっても受理する
- **C.** query・fragment を除外し、構文とスキームに基づく URI 正規化を用いてから比較する
- **D.** query の順序まで完全一致しなければ拒否する

<details>
<summary>解答・解説</summary>

**正解：C**

§4.3。query・fragment を除いて URI を比較することは必須です。誤った拒否を減らすため、RFC 3986 §6.2.2 の構文に基づく正規化と §6.2.3 のスキームに基づく正規化の利用が SHOULD です。パスを無条件に小文字化したり、別パスを同一視したりする規則ではありません。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 2-06. 時刻と許容時間窓

知識 / 選択式 / 1 点

proof の生成時刻と有効時間について正しいものはどれですか？

- **A.** 受理できる時間窓を制限する。合理的に近い未来の iat を時計差として許容することも、nonce 内のサーバー時刻で寿命を制限することもできる
- **B.** iat が現在時刻と秒単位で完全一致したときだけ受理しなければならない
- **C.** アクセストークンに有効期限があれば proof の時刻を検証しなくてよい
- **D.** nonce を使うと iat クレーム自体が不要になる

<details>
<summary>解答・解説</summary>

**正解：A**

§4.3・§11.1。proof は許容時間窓内でなければならず、作成後に受理できる期間を制限することが MUST です。時計差に対する近い未来の iat の受理や、nonce によるサーバー管理の時刻の利用は MAY です。固定の秒数は仕様で一律に定められておらず、nonce があっても iat は必須です。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-07. ath の計算

知識 / 選択式 / 1 点

アクセストークン文字列 T から ath を計算する式はどれですか？

- **A.** BASE64URL(SHA-256(JSON 解析した T の payload))
- **B.** HEX(SHA-256(ASCII(T)))
- **C.** BASE64URL(proof の alg と同じハッシュ関数(ASCII(T)))
- **D.** BASE64URL(SHA-256(ASCII(T)))

<details>
<summary>解答・解説</summary>

**正解：D**

§4.2。トークン値そのものを ASCII バイト列にし、SHA-256 でハッシュして base64url で表します。JWT 形式であっても payload を取り出して計算しません。署名アルゴリズム alg とは独立に SHA-256 を使います。JWS の base64url 表現なので末尾の = padding も付けません。

**出典：** [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§11.10: jkt・ath・dpop_jkt の SHA-256 固定](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1516-L1534)

</details>

### 2-08. 同じ鍵に結び付いた別トークン

誤り発見・原因特定 / 選択式 / 1 点

T1 と T2 は同じ DPoP 鍵に結び付いた別のトークン値です。クライアントが T1 用に作った proof をそのまま Authorization: DPoP T2 と組み合わせました。

この要求を拒否すべき理由はどれですか？

- **A.** 同じ鍵で複数のアクセストークンを受け取ること自体が禁止されている
- **B.** proof の ath は T1 を指しており、実際に提示した T2 のハッシュと一致しない
- **C.** 同じ公開鍵を使っていれば、T1 と T2 の区別は不要である
- **D.** ath を公開鍵の thumbprint に変更すれば受理できる

<details>
<summary>解答・解説</summary>

**正解：B**

§7。別のリソースオーナー向けのトークンやローテーション後のトークンが同じ鍵に結び付く場合でも、ath が proof を個別のトークン値へ結び付けます。T1 用 proof を T2 と組み合わせることはできません。同じ鍵への結び付きの確認だけでは、この差し替えを検出できません。

**出典：** [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 2-09. JWT と opaque トークン

比較・使い分け / 選択式 / 1 点

JWT 形式と opaque 形式のアクセストークンについて正しいものはどれですか？

- **A.** DPoP は JWT 形式のアクセストークンにしか使えない
- **B.** opaque トークンなら RS は DPoP の鍵照合をしなくてよい
- **C.** JWT では cnf.jkt、opaque トークンでは introspection などを通じ、RS が信頼できる鍵の結び付け情報を得られる
- **D.** opaque トークンはクライアントが JWT に変換してから RS に送る

<details>
<summary>解答・解説</summary>

**正解：C**

§6。RS が鍵の結び付け情報を確実に取得できれば、トークンは JWT に限定されません。§6.1 は JWT の cnf.jkt、§6.2 は introspection 応答の cnf.jkt を定義します。AS・RS の合意によるその他の方法も可能ですが、その具体的な方法は仕様の範囲外です。

**出典：** [§6: RS が取得する鍵の結び付け情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L684-L699) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§6.2: introspection 応答と RS によるローカルな鍵照合](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L742-L762)

</details>

### 2-10. cnf.jkt の役割

単語の意味 / 選択式 / 1 点

**用語：アクセストークンまたは introspection 応答の cnf.jkt**

この値は何を表しますか？

- **A.** そのアクセストークンに結び付けられた DPoP 公開鍵の JWK SHA-256 Thumbprint を base64url で表した値
- **B.** アクセストークン文字列の SHA-256 ハッシュ
- **C.** AS が JWT 署名に使った秘密鍵の値
- **D.** HTTP 本文の完全性を検証する MAC

<details>
<summary>解答・解説</summary>

**正解：A**

§6.1。cnf.jkt は公開鍵への結び付きを表し、RFC 7638 に従う JWK SHA-256 Thumbprint を使います。アクセストークン値のハッシュを入れるのは proof の ath です。アクセストークンの署名検証用の鍵とも混同しません。

**出典：** [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-11. JWK Thumbprint の手順

誤り発見・原因特定 / 選択式 / 1 点

実装が、受信した jwk オブジェクト全体をそのまま JSON.stringify して SHA-256 を取り、cnf.jkt と比較していました。

修正方針はどれですか？

- **A.** JSON の空白だけを取り除いてから同じ計算を続ける
- **B.** jti を hash の入力へ追加する
- **C.** jwk の kid だけを hash する
- **D.** RFC 7638 に従う JWK Thumbprint を計算し、その SHA-256 の結果を base64url で表す

<details>
<summary>解答・解説</summary>

**正解：D**

§6.1 は、受け取った JSON 表記をそのまま hash する方式ではなく RFC 7638 の JWK Thumbprint を指定しています。JSON の任意の表記や付加情報に依存しない、規定された thumbprint 手順を使います。ath の入力はトークン値ですが、jkt の入力はこの手順で扱う公開 JWK です。

**出典：** [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 2-12. introspection の役割分担

フロー構築 / 並べ替え / 2 点

opaque トークンを使う成功フローを並べてください。ここでは RS がキャッシュを使わず、受信したトークンを AS に introspection する構成とします。

- **A.** RS が応答の cnf.jkt と、受信した proof の公開鍵の thumbprint を照合する
- **B.** クライアントが RS にトークンと proof を送る
- **C.** AS が active 状態と cnf.jkt などの情報を返す
- **D.** RS が AS にトークンの introspection を要求する

<details>
<summary>解答・解説</summary>

**正解：B → D → C → A**

§6.2。AS の introspection はトークンの状態と結び付け情報を返します。RS はその情報を使って鍵の一致をローカルに検証します。RS が introspection 要求に DPoP proof を付けて、AS に元の API 要求の鍵照合を任せる仕組みではありません。token_type を応答に含める場合は DPoP が MUST ですが、フィールド自体の存在を一律必須にしていません。

**出典：** [§6.2: introspection 応答と RS によるローカルな鍵照合](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L742-L762)

</details>

### 2-13. grant type への適用

知識 / 選択式 / 1 点

トークン要求への DPoP 適用範囲はどれですか？

- **A.** authorization_code だけに使える
- **B.** refresh_token や JWT 認可グラントなどの拡張も含め、grant type に関係なく使える
- **C.** refresh_token だけに使える
- **D.** クライアント認証をしない grant type にだけ使える

<details>
<summary>解答・解説</summary>

**正解：B**

§5。DPoP-bound アクセストークンを要求するときは、有効な proof を DPoP ヘッダーへ入れます。これは grant type に関係なく適用され、authorization_code・refresh_token・RFC 7523 の JWT 認可グラントなどにも適用できます。DPoP はグラントやクライアント認証を置き換えません。

**出典：** [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§1: 送信者制約とクライアント認証の違い](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L114-L148)

</details>

### 2-14. 無効な proof のエラー

誤り発見・原因特定 / 選択式 / 1 点

AS がトークン要求の proof の署名を検証したところ失敗しました。nonce challenge を発行する状況ではなく、クライアント認証や grant は有効です。

この場合に §5 が指定する error 値はどれですか？

- **A.** invalid_client
- **B.** unsupported_grant_type
- **C.** invalid_dpop_proof
- **D.** use_dpop_nonce

<details>
<summary>解答・解説</summary>

**正解：C**

§5。有効でない DPoP proof に対するトークンエラー応答は invalid_dpop_proof です。nonce が必要で提供・更新する場合の use_dpop_nonce とは区別します。クライアント認証の失敗や未対応の grant type のエラーに置き換えるものではありません。

**出典：** [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§12.1〜12.5: token type、エラー、dpop_jkt、認証スキーム、media type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1550-L1629)

</details>

### 2-15. Bearer 応答への対応

知識 / 選択式 / 1 点

public client の DPoP 要求に AS が token_type=Bearer と refresh token を返しました。正しい説明はどれですか？

- **A.** DPoP がアプリの安全性に重要ならクライアントは応答を破棄する。AS が有効な proof を受けて発行した public client の refresh token は鍵へ結び付く
- **B.** DPoP ヘッダーを要求に付けたので、Bearer のアクセストークンも DPoP で保護されている
- **C.** token_type をクライアント側で DPoP に書き換えればよい
- **D.** Bearer のアクセストークンと一緒に返した refresh token は鍵に結び付けてはならない

<details>
<summary>解答・解説</summary>

**正解：A**

§5。AS は DPoP-bound ではない Bearer アクセストークンを返すことも MAY です。有効な proof を提示した public client に refresh token を発行した場合の鍵への結び付けは MUST です。アクセストークンの DPoP 保護が重要なら非 DPoP 応答を破棄することが MUST で、そうでなければ通常の OAuth として続けることもできます。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

### 2-16. refresh token とクライアント種別

比較・使い分け / 選択式 / 1 点

refresh token について RFC 9449 が説明する public client と confidential client の違いはどれですか？

- **A.** 両者とも、更新時のクライアント認証が DPoP に置き換わる
- **B.** public client は更新時だけ別の DPoP 鍵を自由に選べる
- **C.** confidential client は refresh token を発行されない
- **D.** public client の対象 refresh token は DPoP 鍵へ結び付き、confidential client の refresh token は既存のクライアントへの結び付けと認証で制約される

<details>
<summary>解答・解説</summary>

**正解：D**

§5。public client に有効な proof を受けて発行する refresh token は公開鍵へ結び付け、利用時に同じ鍵の proof を確認します。confidential client の refresh token は DPoP 公開鍵へ結び付けるのではなく、OAuth の既存の client_id への結び付けとクライアント認証で制約します。これにより認証クレデンシャルのローテーションも柔軟に行えます。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

### 2-17. refresh token の鍵を失った場合

誤り発見・原因特定 / 選択式 / 1 点

public client が DPoP-bound refresh token を取得した後、対応する秘密鍵を失いました。手元には refresh token と、新しく生成した別の鍵だけがあります。

仕様から導ける判断はどれですか？

- **A.** 新しい鍵の proof に古い jkt を書けば使える
- **B.** 同じ鍵による proof を示せないため、そのまま更新には使えない。鍵の回復や再認可など別の対応が必要になる
- **C.** client_id が同じなら DPoP proof を省略できる
- **D.** refresh token 自体を新しい秘密鍵として使えばよい

<details>
<summary>解答・解説</summary>

**正解：B**

§5。DPoP-bound refresh token を使う public client は、取得時と同じ鍵の proof を毎回提示しなければなりません。新しい鍵の所有を示しても古い鍵の所持証明にはなりません。鍵の回復・再認可などの運用方法自体を RFC 9449 が定義しているわけではありません。

**出典：** [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

### 2-18. AS・クライアントのメタデータ

比較・使い分け / 選択式 / 1 点

AS の dpop_signing_alg_values_supported と、クライアント登録の dpop_bound_access_tokens の組み合わせで正しいものはどれですか？

- **A.** 前者は利用者の権限、後者は JWT の有効期間を表す
- **B.** 前者が false のときだけ、後者に公開鍵を登録する
- **C.** 前者は対応 alg の JSON 配列。後者は既定 false の boolean で、true なら AS は DPoP ヘッダーのないトークン要求を拒否する
- **D.** 前者は対応 alg の空白区切り文字列。後者を省略すると true になる

<details>
<summary>解答・解説</summary>

**正解：C**

§5.1・§5.2。AS メタデータは対応する JWS alg の JSON 配列です。登録メタデータ dpop_bound_access_tokens は boolean で、既定は false、true なら DPoP ヘッダーのないトークン要求を拒否することが MUST です。§7.1 の challenge の algs は空白区切りであり、メタデータの配列とは表現が違います。

**出典：** [§5.1: dpop_signing_alg_values_supported](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L651-L660) / [§5.2: dpop_bound_access_tokens の既定値と要求](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L662-L682) / [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936)

</details>

### 2-19. RS の検証設計

ユースケース設計 / 記述式 / 6 点

RS に届くアクセストークンの発行者・期限・権限を検証する処理は既にあります。新たに DPoP を必須にし、AS から信頼できる cnf.jkt を取得できます。RS は nonce N を提供済みです。

署名成功だけで許可しないために必要な検証を、6 つの観点で挙げてください。チェックの実行順序は問いません。

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

単一の DPoP ヘッダーと正しい形式・必須クレーム、typ=dpop+jwt、対応・許可された非対称 alg、秘密鍵を含まない jwk とその鍵での署名検証を確認します。htm と query・fragment を除いた htu を照合し、nonce N と許容時間窓も確認します。提示されたトークン値から ath を再計算し、proof 公開鍵の thumbprint と信頼できる cnf.jkt を照合します。既存のトークン検証も継続し、すべて成功した場合だけ許可します。§4.3 は各チェックを任意の順序で実行できるとしています。

**採点基準（各 1 点）**

- 単一の DPoP ヘッダー、正しい JWT 形式、基本・条件付き必須クレームを確認する。
- typ と許可された非対称 alg を確認し、秘密鍵を含まない jwk で署名を検証する。
- 現在の htm と query・fragment を除いた htu の一致を確認する。
- 提供された nonce の一致と許容時間窓を確認する。iat 自体の省略は認めない。
- 提示トークンのハッシュと ath、信頼できる cnf.jkt と proof 公開鍵の thumbprint の両方を照合する。
- 既存のトークンの有効性・権限検証を継続し、すべて成功した場合だけ許可する。順序の違いは減点しない。

**出典：** [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719) / [§3: AS・クライアント・RS の役割と基本フロー](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L255-L335) / [§7.1: Authorization: DPoP とアクセス許可の条件](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L830-L854)

</details>

### 2-20. DPoP 必須の public client

ユースケース設計 / 記述式 / 4 点

DPoP によるアクセストークンの保護が必須の public client を登録し、AS も対応させます。refresh token を使う長期セッションが必要で、既存の Bearer-only 運用への意図しない切り替えを避けます。

登録設定、トークン要求・応答確認、refresh token の発行・更新時の扱いを説明してください。

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

dpop_bound_access_tokens=true として登録し、AS は DPoP ヘッダーのないトークン要求を拒否します。クライアントは各トークン要求に有効な proof を付け、アクセストークンの DPoP 保護が必須なので token_type が DPoP でなければ応答を破棄します。AS はこの public client に発行する refresh token を proof の公開鍵へ結び付け、更新時にも同じ鍵の新しい proof を検証します。登録フラグだけで実際の応答の token_type 確認を省略しません。

**採点基準（各 1 点）**

- dpop_bound_access_tokens=true を登録し、AS が DPoP ヘッダーなしのトークン要求を拒否する。
- 各トークン要求に有効な DPoP proof を付け、AS も検証する。
- アクセストークンの DPoP 保護が必須なので、token_type が DPoP 以外なら応答を破棄する。
- public client の refresh token を公開鍵に結び付け、更新時に同じ鍵の proof と結び付きを検証する。

**出典：** [§5.2: dpop_bound_access_tokens の既定値と要求](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L662-L682) / [§5: 全 grant type への適用、エラー、token_type](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L525-L570) / [§5: public/confidential の refresh token と Bearer 応答](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L610-L649)

</details>

<a id="part-3"></a>

## 第 3 部：nonce・認可コード・PAR

20 問・28 点。

### 3-01. サーバー由来 nonce の役割

単語の意味 / 選択式 / 1 点

**用語：server-provided DPoP nonce**

この値をサーバーが提供する狙いはどれですか？

- **A.** client_id と同じ固定値を共有し、公開鍵を送らなくてよくする
- **B.** 予測できない値を proof に含めさせ、将来使う proof の事前生成や受理可能な寿命を制限する
- **C.** クライアントが独自に作る時刻を AS へ通知する
- **D.** アクセストークンのスコープを増やす

<details>
<summary>解答・解説</summary>

**正解：B**

§8・§11.2。サーバー由来の予測不能な nonce により、クライアントが将来の iat を使った proof を長期にわたり先に作って持ち出す攻撃を抑えます。nonce は権限の付与でも、公開鍵や署名の代替でもありません。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391)

</details>

### 3-02. AS の nonce challenge

知識 / 選択式 / 1 点

AS のトークンエンドポイントが nonce なしの proof に初めて nonce を要求します。仕様の応答はどれですか？

- **A.** 401 と WWW-Authenticate: Bearer だけを返す
- **B.** 200 とアクセストークンを返し、nonce の要求は本文の注記だけに書く
- **C.** 403 と error=invalid_client を返す
- **D.** 400、JSON の error=use_dpop_nonce、DPoP-Nonce ヘッダーを返す

<details>
<summary>解答・解説</summary>

**正解：D**

§8。AS は HTTP 400 の OAuth トークンエラー応答で use_dpop_nonce を返し、DPoP-Nonce ヘッダーで次の要求に使う値を提供します。RS の 401 と WWW-Authenticate: DPoP による通知とは分けて覚えます。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235)

</details>

### 3-03. nonce を得て再試行するフロー

フロー構築 / 並べ替え / 2 点

AS に初めて nonce を要求された後、トークン取得に成功するまでを並べてください。グラントは再試行可能で、他の検証はすべて成功します。

- **A.** クライアントが nonce=N を含む新しい proof を作り、同じトークン要求を再試行する
- **B.** クライアントが nonce 未取得の状態で proof 付きトークン要求を送る
- **C.** AS が nonce を含む proof を検証し、トークンを返す
- **D.** AS が 400 use_dpop_nonce と DPoP-Nonce: N を返す

<details>
<summary>解答・解説</summary>

**正解：B → D → A → C**

§8。nonce が必要なら、クライアントは提供された N を proof の nonce クレームに入れた要求で再試行します。N をトークン要求本文の OAuth パラメーターとして足すだけでは不十分です。要求ごとに一意な proof を作る原則も維持します。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 3-04. opaque な nonce

誤り発見・原因特定 / 選択式 / 1 点

DPoP-Nonce の値がピリオドで区切られているため、クライアントが必ず JWT と解釈しようとして失敗します。

クライアントの正しい扱いはどれですか？

- **A.** nonce を opaque な値として保存し、提供された文字列をそのまま proof に含める
- **B.** nonce を必ず JWT として解析し、署名が確認できなければ拒否する
- **C.** nonce を小文字に統一してから proof に含める
- **D.** nonce を現在時刻の文字列に置き換える

<details>
<summary>解答・解説</summary>

**正解：A**

§8。nonce はクライアントにとって opaque です。見た目が JWT に似ていても、その内部形式を解釈したり独自に正規化したりする必要はありません。サーバーが最近提供した値と完全一致する必要があります。

**出典：** [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159)

</details>

### 3-05. 最近の nonce の窓

知識 / 選択式 / 1 点

サーバーが最近の nonce の窓を保持し、N1 と N2 を有効としている場合、正しい説明はどれですか？

- **A.** N2 を一度発行した時点で、RFC は N1 の即時拒否を必須にする
- **B.** クライアントが生成した任意の N3 も形式が同じなら受理する
- **C.** クライアントは提供された新しい値へ更新し、サーバーは最近提供した有効な nonce と完全一致する値を検証できる
- **D.** nonce の先頭部分が一致すれば、有効な最近の nonce とみなせる

<details>
<summary>解答・解説</summary>

**正解：C**

§8・§8.2。クライアントが保持する値を最新の提供値へ更新することと、サーバーが最近の値の窓を持つことは両立します。完全一致しない値は拒否しますが、過去の値をすべて即時無効にすることは一律の要件ではありません。複数要求や応答の行き違いも考慮します。

**出典：** [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203)

</details>

### 3-06. 成功応答での nonce 更新

誤り発見・原因特定 / 選択式 / 1 点

AS の nonce N1 を使った要求が成功しました。その HTTP 200 応答には DPoP-Nonce: N2 が含まれています。

次回のトークン要求でどうすべきですか？

- **A.** 成功応答の nonce は無視し、最初の N1 を使い続ける
- **B.** 新しい N2 を使い、さらに新しい値が提供されるまで使い続ける
- **C.** 次回だけ nonce を省略する
- **D.** N1 と N2 を連結して使う

<details>
<summary>解答・解説</summary>

**正解：B**

§8.2。AS は HTTP 200 の成功応答で次の nonce を渡せます。クライアントは次回とそれ以降のトークン要求で新しい値を使うことが MUST です。nonce 更新のたびに必ずエラー応答と追加の往復を発生させる必要はありません。

**出典：** [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203)

</details>

### 3-07. nonce とキャッシュ

誤り発見・原因特定 / 選択式 / 1 点

DPoP-Nonce を含む GET の成功応答が中間キャッシュから再利用され、クライアントが古い nonce へ戻ることがありました。

仕様で説明される対策はどれですか？

- **A.** nonce を含む応答を、Cache-Control: no-store などでキャッシュされないようにする
- **B.** nonce を固定値にして、キャッシュと同期させる
- **C.** クライアントが nonce の期限を自由に延長する
- **D.** GET の場合だけ nonce 照合を省略する

<details>
<summary>解答・解説</summary>

**正解：A**

§8.2。DPoP-Nonce を含む応答はキャッシュされないことが望ましく、GET 応答の Cache-Control: no-store が例示されています。古い応答が再利用され、古い nonce がクライアントへ渡ることを避けます。ここでの原文は小文字の should であり、大文字の MUST として扱いません。

**出典：** [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203)

</details>

### 3-08. CORS とレスポンスヘッダー

誤り発見・原因特定 / 選択式 / 1 点

SPA のクロスオリジン要求自体は成功し、既存の CORS 設定も妥当です。しかし JavaScript から応答の DPoP-Nonce と WWW-Authenticate の値を読めません。

サーバー側で必要な追加設定はどれですか？

- **A.** Content-Type: application/dpop+jwt をすべての応答に設定する
- **B.** nonce をクライアントシークレットとして登録する
- **C.** すべてのエラーを HTTP 200 に変える
- **D.** Access-Control-Expose-Headers のリストに DPoP-Nonce と WWW-Authenticate を含める

<details>
<summary>解答・解説</summary>

**正解：D**

§8 と §7.1。クロスオリジンの JavaScript は、既定ではこれらのレスポンスヘッダーを自由に読めません。Access-Control-Expose-Headers に名前を列挙して公開します。これはリクエストヘッダーを送るための許可設定とは別の論点です。

**出典：** [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§7.1: CORS でのヘッダー公開とプロキシ認証への使用禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L958-L968)

</details>

### 3-09. RS の nonce challenge

比較・使い分け / 選択式 / 1 点

保護リソースへの要求に RS が nonce を要求する場合、AS との違いはどれですか？

- **A.** RS は HTTP 400 と JSON の use_dpop_nonce だけを使う
- **B.** RS は HTTP 401、WWW-Authenticate: DPoP error="use_dpop_nonce"、DPoP-Nonce を使う
- **C.** RS は nonce を要求できないので、AS へ転送する
- **D.** RS は HTTP 302 で認可エンドポイントへ必ず戻す

<details>
<summary>解答・解説</summary>

**正解：B**

§9。RS は 401 と DPoP の WWW-Authenticate challenge、および DPoP-Nonce ヘッダーで通知します。AS のトークンエラーは §8 の 400 と JSON error です。error の識別子が同じでも、HTTP の応答形式と処理する相手が異なります。

**出典：** [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118)

</details>

### 3-10. nonce の発行元と用途

比較・使い分け / 選択式 / 1 点

クライアントが AS、RS-A、RS-B、および OpenID Connect の認可フローから、それぞれ nonce を受け取っています。

正しい nonce 管理はどれですか？

- **A.** すべて同じ nonce なので、最後に受け取った 1 個を全要求で使う
- **B.** OIDC の nonce だけを DPoP proof に入れる
- **C.** AS と各 RS の発行元別に管理し、OIDC の ID Token nonce とも分ける
- **D.** AS の nonce を RS に渡せば、RS の nonce を要求されなくなる

<details>
<summary>解答・解説</summary>

**正解：C**

§9。DPoP nonce は発行したサーバーだけが受理します。AS と RS、複数の AS・RS の値を混ぜません。OIDC の ID Token nonce も別の用途であり、名前が同じでも DPoP の nonce と置き換えられません。

**出典：** [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235)

</details>

### 3-11. nonce の構文とヘッダー数

知識 / 選択式 / 1 点

AS の nonce エラー応答について正しい組み合わせはどれですか？

- **A.** nonce の構文は 1*NQCHAR で非空。DPoP-Nonce ヘッダーを複数含めてはならない
- **B.** nonce は空文字でよく、同じ値ならヘッダーを複数置ける
- **C.** nonce は JSON オブジェクトでなければならない
- **D.** nonce は UUID v4 に限られ、ヘッダーは必ず 2 個必要である

<details>
<summary>解答・解説</summary>

**正解：A**

§8・§8.1。ABNF は nonce = 1*NQCHAR で、少なくとも 1 文字必要です。エラー応答に他のヘッダーや JSON フィールドを含めることはできますが、DPoP-Nonce ヘッダーを複数含めることは MUST NOT です。UUID や JWT といった内部形式を一律に要求しません。

**出典：** [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§8.1: nonce = 1*NQCHAR](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1161-L1168)

</details>

### 3-12. nonce のダウングレード

誤り発見・原因特定 / 選択式 / 1 点

サーバーがクライアントへ DPoP-Nonce を提供済みですが、次の proof には nonce がありません。他の検証項目は成功しています。

この場合の正しい判断はどれですか？

- **A.** 互換性のため nonce なしへ戻して受理する
- **B.** 署名が成功すれば nonce の省略を許す
- **C.** jti が新しい場合だけ nonce を省略できる
- **D.** nonce を提供した後の nonce なし proof を受理してはならない

<details>
<summary>解答・解説</summary>

**正解：D**

§11.3。サーバーは nonce を提供した後、nonce クレームのない proof を受理してはならない (MUST NOT) とされています。受理すると、nonce を含めない古い・事前生成済みの proof へダウングレードできてしまいます。

**出典：** [§11.3: nonce 提供後の nonce なし proof の受理禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1393-L1396)

</details>

### 3-13. nonce と jti の再利用

比較・使い分け / 選択式 / 1 点

DPoP nonce と jti の再利用に関して正しい説明はどれですか？

- **A.** nonce を再利用できるので、同じ proof も何度でも再送してよい
- **B.** サーバーは同じ nonce を複数回受理できる。厳格なリプレイ防止には nonce の寿命中の jti を追跡し、重複を拒否する
- **C.** jti はサーバーが発行し、nonce はクライアントが毎回作る
- **D.** nonce を使った場合は htm と htu を検証しなくてよい

<details>
<summary>解答・解説</summary>

**正解：B**

§11.1。同じ DPoP nonce を複数の異なる proof に使うことは認められます。nonce の再利用と、同じ jti を持つ proof の再利用は別です。nonce の寿命中に jti を追跡して重複を拒否すれば、nonce 再利用による追加のリプレイリスクを避けられます。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 3-14. dpop_jkt の役割

単語の意味 / 選択式 / 1 点

**用語：認可要求の dpop_jkt**

このパラメーターは何を AS に伝えますか？

- **A.** 認可コードを暗号化する共有シークレット
- **B.** PKCE の code_verifier の SHA-256 ハッシュ
- **C.** 発行する認可コードを結び付けたい DPoP 公開鍵の JWK SHA-256 Thumbprint
- **D.** 後で発行されるアクセストークン文字列の SHA-256 ハッシュ

<details>
<summary>解答・解説</summary>

**正解：C**

§10。dpop_jkt は認可要求で使い、認可コードを特定の DPoP 公開鍵へ結び付けます。値は §6.1 の jkt と同じ JWK Thumbprint の表現です。認可コードの交換時には、その鍵の proof であることを AS が確認します。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§6.1: cnf.jkt と RFC 7638 の JWK SHA-256 Thumbprint](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L701-L719)

</details>

### 3-15. PKCE との関係

比較・使い分け / 選択式 / 1 点

dpop_jkt と PKCE について正しいものはどれですか？

- **A.** dpop_jkt は任意で PKCE と併用できる。PKCE と同様の保護を dpop_jkt だけに期待するには、認可要求ごとに一意な DPoP 鍵という条件に注意する
- **B.** dpop_jkt を指定したら PKCE を併用してはならない
- **C.** DPoP を使うすべての要求で dpop_jkt が必須になる
- **D.** 同じ DPoP 鍵を全認可要求で共有しても、dpop_jkt は PKCE と常に同じ保護になる

<details>
<summary>解答・解説</summary>

**正解：A**

§10。dpop_jkt の使用は OPTIONAL であり、PKCE と併用できます。同様の保護になるという説明には「認可要求ごとに一意の DPoP 鍵を使う場合だけ」という条件があります。DPoP を導入したという理由で PKCE を一律に取り除く判断はできません。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

### 3-16. 認可コードに結び付いた鍵の不一致

誤り発見・原因特定 / 選択式 / 1 点

認可要求は dpop_jkt=thumbprint(K1) で行われました。コード交換の proof は K2 で正しく署名され、PKCE の code_verifier も正しい値です。

AS の適切な処理はどれですか？

- **A.** code_verifier が正しければ K2 へ結び付けて発行する
- **B.** K1 の thumbprint を proof の jti に入れるよう要求する
- **C.** クライアントが新しい鍵を選ぶことを優先する
- **D.** proof 公開鍵の thumbprint が認可要求の dpop_jkt と一致しないので拒否する

<details>
<summary>解答・解説</summary>

**正解：D**

§10。AS はトークン要求の proof 公開鍵から JWK Thumbprint を計算し、認可要求の dpop_jkt と一致するか確認します。不一致なら要求を拒否することが MUST です。PKCE の検証成功はこの鍵照合の代わりにはなりません。

**出典：** [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273)

</details>

### 3-17. PAR の 2 方式

知識 / 選択式 / 1 点

PAR と DPoP の両方に対応する AS がサポートしなければならない方式はどれですか？

- **A.** PAR の URL の fragment に公開鍵を入れる方式だけ
- **B.** PAR の POST 本文に dpop_jkt を入れる方式と、PAR 要求に DPoP ヘッダーを付ける方式の両方
- **C.** DPoP ヘッダーを使う方式だけ
- **D.** dpop_jkt をトークン応答だけに入れる方式

<details>
<summary>解答・解説</summary>

**正解：B**

§10.1。両方の機能に対応する AS は 2 方式ともサポートすることが MUST です。ヘッダー方式では §4.3 に従って proof を検証し、その公開鍵の thumbprint が dpop_jkt として渡されたかのように扱います。後続のトークン要求にも同じ鍵の proof を要求します。

**出典：** [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308)

</details>

### 3-18. PAR で両方式が不一致

誤り発見・原因特定 / 選択式 / 1 点

PAR の POST 本文に dpop_jkt=thumbprint(K1) があり、同時に DPoP ヘッダーには K2 の proof が含まれています。

AS はどう処理すべきですか？

- **A.** 署名付きの DPoP ヘッダーを優先し、本文の dpop_jkt を無視する
- **B.** 本文の dpop_jkt を優先し、ヘッダーを無視する
- **C.** 両者の公開鍵の thumbprint が一致しないので PAR 要求を拒否する
- **D.** 両方の鍵を OR 条件で認可コードへ結び付ける

<details>
<summary>解答・解説</summary>

**正解：C**

§10.1。両方式を同時に使う場合、dpop_jkt と DPoP ヘッダー内の公開鍵の thumbprint が不一致なら、AS は要求を拒否することが MUST です。片方を黙って優先すると、認可フローで使う鍵が曖昧になります。

**出典：** [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308)

</details>

### 3-19. 複数サーバーの nonce 管理設計

ユースケース設計 / 記述式 / 4 点

SPA が AS と 2 台の RS を使います。3 者はそれぞれ DPoP nonce を要求し、成功応答でも値を更新します。通常の CORS とリクエストの送信許可は設定済みです。

nonce の保存先、challenge と成功応答への対応、JavaScript がレスポンスヘッダーを読む設定を設計してください。

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

nonce は発行元の AS・各 RS ごとに分けて保持し、OIDC の nonce とも分離します。AS の 400 JSON use_dpop_nonce と RS の 401 WWW-Authenticate: DPoP を区別し、提供された値を含む新しい proof で再試行します。成功応答に新しい DPoP-Nonce があれば次回から更新値を使います。DPoP-Nonce と WWW-Authenticate を Access-Control-Expose-Headers で公開します。nonce の内部形式を解釈したり別サーバーへ流用したりしません。

**採点基準（各 1 点）**

- AS と各 RS の発行元別に nonce を保持し、別サーバーや OIDC の ID Token nonce と混同しない。
- AS の 400 JSON error と RS の 401 challenge を区別し、提供値を nonce に含む新しい proof で再試行する。
- 成功応答の DPoP-Nonce も処理し、次の要求から新しい値を使う。
- Access-Control-Expose-Headers に DPoP-Nonce と WWW-Authenticate を含める。

**出典：** [§9: RS の 401 challenge、発行元別の nonce、OIDC との区別](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1205-L1235) / [§8: AS の nonce challenge、予測不能性、ヘッダー数](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1073-L1118) / [§8: opaque な nonce の完全一致・最近の値・CORS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1120-L1159) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357) / [§8.2: 成功応答による nonce 更新とキャッシュ](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1170-L1203) / [§7.1: CORS でのヘッダー公開とプロキシ認証への使用禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L958-L968)

</details>

### 3-20. PAR・PKCE・鍵の結び付け設計

ユースケース設計 / 記述式 / 5 点

PAR と PKCE を採用する public client で、認可コードを鍵 K に結び付けたいと考えています。ここでは PAR の DPoP ヘッダー方式を選びます。認可コードや code_verifier が漏れても、K を持たない攻撃者への発行を防ぎたいという制約があります。

PAR からコード交換まで、クライアントと AS が必要な処理を説明してください。dpop_jkt も併記する場合の条件も挙げてください。

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

クライアントは PKCE の認可要求パラメーターと、K で署名した PAR 用 proof を送ります。AS は PAR の proof を §4.3 に従って検証し、K の thumbprint が dpop_jkt で指定されたものとして認可コードへ結び付けます。コード交換ではクライアントが code_verifier と K による新しいトークンエンドポイント用 proof を送り、AS は PKCE と鍵の一致を確認します。dpop_jkt も本文に併記するなら K の thumbprint と一致しなければならず、不一致は拒否します。漏えいコードと verifier だけで攻撃者の別鍵へ付け替えることを防ぎます。

**採点基準（各 1 点）**

- PKCE の認可要求パラメーターを維持し、PAR に K で署名した PAR 用の DPoP proof を付ける。
- AS が PAR の proof を §4.3 に従って検証する。
- AS が K の thumbprint を dpop_jkt として扱い、認可コードへ結び付ける。
- コード交換で code_verifier と K の新しい proof を提示し、AS が鍵の一致も検証して、別鍵なら拒否する。
- dpop_jkt も指定するなら PAR 本文に K の thumbprint を入れ、不一致なら AS が拒否する。

**出典：** [§10.1: PAR の 2 方式、必須サポート、不一致時の拒否](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1275-L1308) / [§10: dpop_jkt、トークン要求時の照合、PKCE との併用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1237-L1273) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.9: 認可コードの盗難・再利用と dpop_jkt](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1482-L1514) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

<a id="part-4"></a>

## 第 4 部：攻撃シナリオと実装レビュー

20 問・32 点。

### 4-01. リプレイと必須の時間制限

知識 / 選択式 / 1 点

proof のリプレイ対策として MUST の要件はどれですか？

- **A.** すべての構成で jti を永久保存する
- **B.** nonce を必ず 1 回だけで使い捨てる
- **C.** 生成後の限られた時間だけ proof を受理する
- **D.** アクセストークンの期限をなくす

<details>
<summary>解答・解説</summary>

**正解：C**

§11.1。サーバーは proof の生成後、限られた時間だけ受理することが MUST で、秒・分程度の短い期間が望ましいと説明されています。jti の追跡は強力な追加対策ですが、共有状態がない複数サーバーなどで常に実現可能とは限らず、一律の MUST として書かれてはいません。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358)

</details>

### 4-02. jti とリプレイの記録

誤り発見・原因特定 / 選択式 / 1 点

攻撃者が有効なトークンと proof を取得し、その proof の許容時間窓内に同じメソッド・URI へ再送します。サーバーは署名・ath・htm・htu・時刻だけを見ています。

同じ proof の 2 回目の利用を防ぐために、どの対策が考えられますか？

- **A.** 対象 URI の文脈で、受理可能な期間中の jti を記録して重複を拒否する
- **B.** ath を確認していれば、同じトークンと proof の再利用も必ず防げる
- **C.** htm と htu をなくし、署名を大きくする
- **D.** jti を使い回してクライアントを識別する

<details>
<summary>解答・解説</summary>

**正解：A**

§11.1。同じエンドポイントでは htm・htu が一致するため、これらだけでリプレイを防げません。受理可能な時間窓における jti の記録と重複拒否で、同じ proof の複数回使用を防げます。ath も同じトークンとの再利用を防ぐものではありません。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828)

</details>

### 4-03. 長い jti と資源消費

誤り発見・原因特定 / 選択式 / 1 点

リプレイ防止用のサーバーが、攻撃者の非常に長い jti をそのまま保存してメモリーを大量消費しています。

仕様が挙げるメモリー枯渇対策はどれですか？

- **A.** 受信したすべての jti を期限なしで保存する
- **B.** jti の長さが大きいほど信頼して優先する
- **C.** jti の検証をやめて署名だけを見る
- **D.** 不必要に大きい jti を拒否するか hash を保存し、必要な期間だけ記録する

<details>
<summary>解答・解説</summary>

**正解：D**

§11.1。jti を追跡するサーバーは、不必要に大きい値を拒否するか hash のみを保存することが望ましいとされています。また記録は、その proof を受理し得る時間窓に対応させます。正当な署名があることは、資源を無制限に割り当てる理由にはなりません。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358)

</details>

### 4-04. 通信再試行用の proof

誤り発見・原因特定 / 選択式 / 1 点

GET の応答がネットワーク障害で届かず、クライアントが同じ要求を再試行します。サーバーは proof の単回利用を厳格に検証しています。

再試行時の推奨処理はどれですか？

- **A.** GET なので必ず同じ proof を再送する
- **B.** 業務処理の冪等性とは別に、再試行にも一意な新しい proof を作る
- **C.** 再試行時はアクセストークンだけを送り proof を省略する
- **D.** jti は同じまま htm を RETRY に変える

<details>
<summary>解答・解説</summary>

**正解：B**

§7.3。一般に一時的とされる HTTP エラーで冪等な要求を再試行する場合でも、一意の proof を生成することが RECOMMENDED です。元の要求がサーバーへ届いていれば、同じ proof は jti などの検証で拒否され得ます。これは GET などの業務処理自体の冪等性とは別の、認証情報の受理に関する問題です。

**出典：** [§7.3: 一時的な通信障害と新しい proof による再試行](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1059-L1071) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 4-05. 将来の proof の事前生成

知識 / 選択式 / 1 点

攻撃者が今だけ署名処理を使える場合、iat を近い時刻に限定する検証だけでは防げない攻撃はどれですか？

- **A.** 公開鍵から秘密鍵を容易に復元する攻撃
- **B.** SHA-256 を使わずに同じ ath を作れることが保証される攻撃
- **C.** 将来の iat の proof を今作って持ち出し、その将来時点で提示する攻撃
- **D.** DPoP ヘッダー名を小文字にする攻撃

<details>
<summary>解答・解説</summary>

**正解：C**

§11.2。iat はクライアント側で選んで署名できるため、署名機能を使える間に将来分の proof を作れます。サーバーがその将来時点で受け取れば、iat はその時点の許容時間窓内になります。攻撃者が予測できないサーバー由来 nonce を更新して要求することで、この事前生成を制限できます。

**出典：** [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391)

</details>

### 4-06. 未知のアクセストークンと ath

知識 / 選択式 / 1 点

秘密鍵も署名機能も使えなくなった攻撃者が、持ち出した refresh token と事前生成 proof だけで新しいアクセストークンを取得できたとします。その新しいトークンを RS で使いにくい理由はどれですか？

- **A.** 事前生成時には新しいトークン値が分からず、対応する ath を含む RS 用 proof を現実的に準備できないため
- **B.** すべての refresh token は 1 回も使えないため
- **C.** RS は新しいアクセストークンを必ず拒否するため
- **D.** DPoP が新しいトークンの値を攻撃者から暗号化して隠すため

<details>
<summary>解答・解説</summary>

**正解：A**

§11.2。トークンエンドポイント用 proof を事前生成できても、後で発行される未知のアクセストークン値に対する ath を含む proof は現実的に先に作れません。これが ath による保護の一面です。攻撃者がなお署名機能を使える場合にまで、この議論を広げることはできません。

**出典：** [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448)

</details>

### 4-07. nonce なし運用でのトークン寿命

知識 / 選択式 / 1 点

nonce を採用しないデプロイメントに対する §11.2 の推奨はどれですか？

- **A.** アクセストークンを無期限にし、proof を使い回す
- **B.** refresh token を使う場合だけ proof を不要にする
- **C.** 必ず nonce を導入しなければ RFC に適合できない
- **D.** 長命の DPoP-bound アクセストークンを避け、短命のアクセストークンと refresh token を優先する

<details>
<summary>解答・解説</summary>

**正解：D**

§11.2。nonce を使わない場合、長命の DPoP-bound アクセストークンを発行すべきではない (SHOULD NOT) とされ、短命のアクセストークンと refresh token が推奨されます。ath により、事前生成 proof の有用性を対応するアクセストークンの寿命へ制限できます。nonce の採用自体は一律必須ではありません。

**出典：** [§11.2: proof の事前生成、nonce、短命トークン、ath の効果](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1360-L1391)

</details>

### 4-08. 非抽出鍵と XSS

比較・使い分け / 選択式 / 1 点

非抽出の秘密鍵がある場合、トークン単体の持ち出しと、クライアント内での XSS 実行はどう違いますか？

- **A.** 秘密鍵が非抽出なら XSS による API 利用も完全に防げる
- **B.** トークン単体の外部利用は抑えられるが、XSS は動作中のクライアント内の署名機能を悪用して proof を作り得る
- **C.** 非抽出の鍵があると、DPoP proof の署名ができなくなる
- **D.** DPoP を使えば、XSS 対策は不要になる

<details>
<summary>解答・解説</summary>

**正解：B**

§2・§11.4。秘密鍵の抽出を防ぐことと、許可された実行環境から署名機能を呼び出させないことは別です。XSS はオンラインのクライアントで新しい proof を作って利用し得ます。安全な実装や CSP などによる不信なコードの実行防止は引き続き必要です。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433)

</details>

### 4-09. 攻撃者自身の鍵への結び付け

誤り発見・原因特定 / 選択式 / 1 点

SPA の正規の DPoP 秘密鍵は非抽出ですが、XSS により攻撃者がクライアントのオリジンでコードを実行できます。

DPoP に関する残る脅威はどれですか？

- **A.** 非抽出鍵なら、すべての認可グラントが必ず正規の鍵へ結び付く
- **B.** 攻撃者は公開鍵を知っていても proof を作れないので、追加の対策は不要である
- **C.** 攻撃者が新しい silent な認可グラントを開始し、発行トークンを攻撃者自身の鍵へ結び付ける可能性がある
- **D.** AS は proof の署名だけで、鍵が正規の画面操作で生成されたことまで保証できる

<details>
<summary>解答・解説</summary>

**正解：C**

§11.4。攻撃者は暗号 API の置き換えや、新しい silent な認可グラントを利用して、自分の鍵へトークンを結び付けようとする可能性があります。これは既存の正規鍵の抽出を防ぐだけでは防げません。不信なコードの実行自体を防ぐことが重要です。

**出典：** [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433)

</details>

### 4-10. 別用途の JWT との取り違え

誤り発見・原因特定 / 選択式 / 1 点

署名が検証できる別用途の JWT が DPoP ヘッダーに入り、サーバーが typ を見ずに受理しようとしています。

DPoP 検証として必要な判断はどれですか？

- **A.** 署名が正しくても typ が dpop+jwt でないので受理しない
- **B.** 有効な署名があれば別用途の JWT でも受理する
- **C.** typ をサーバーで書き換えてから署名を再検証する
- **D.** typ を無視して有効期限だけを見る

<details>
<summary>解答・解説</summary>

**正解：A**

§11.5。署名付き JWT の用途取り違えを防ぐため、typ=dpop+jwt の検証が MUST です。署名の成功は JWT の用途が正しいことまで保証しません。受信後に typ を書き換えてよいわけでもありません。

**出典：** [§11.5: typ による別用途 JWT の受理防止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1435-L1439) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523)

</details>

### 4-11. HTTP 本文の完全性

誤り発見・原因特定 / 選択式 / 1 点

同じ HTTP メソッド・URI・アクセストークンを保ったまま、送金要求の JSON 本文の金額だけが変更される場合をレビューしています。

標準の DPoP proof 自体が改変を検出する範囲について正しいものはどれですか？

- **A.** URI が同じなら、本文の全フィールドも自動的に署名されている
- **B.** ath がリクエスト本文の hash なので検出できる
- **C.** nonce が本文の暗号化鍵なので検出できる
- **D.** 本文や一般のヘッダーは標準の署名対象に含まれず、完全性は TLS などに依存する

<details>
<summary>解答・解説</summary>

**正解：D**

§4.2・§11.7。DPoP proof は標準で HTTP メソッドと query・fragment を除いた URI などを対象とし、本文や一般のリクエストヘッダーを覆いません。ath はアクセストークン値の hash です。TLS の保護が重要であり、追加情報を署名する拡張は可能でも本仕様の標準の対象範囲とは区別します。

**出典：** [§4.2: トークン要求の proof 例と署名範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L450-L483) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§11.7: 本文・一般のヘッダーの完全性と TLS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1448-L1464)

</details>

### 4-12. 署名 alg と hash の選択

比較・使い分け / 選択式 / 1 点

proof の署名 alg を、対応する別の非対称アルゴリズムへ変更します。jkt・ath・dpop_jkt の hash はどう扱いますか？

- **A.** 署名 alg が使う hash へ必ず連動させる
- **B.** RFC 9449 で定義されたこれらの値には引き続き SHA-256 を使う
- **C.** 署名 alg が強ければ hash を省略できる
- **D.** jkt は SHA-1、ath は MD5 に変える

<details>
<summary>解答・解説</summary>

**正解：B**

§11.10。jkt・ath・dpop_jkt は SHA-256 の出力を使うように固定されています。JWS の署名 alg を変えても、この定義は変わりません。将来 hash を変える必要が生じた場合は、仕様更新で新しい確認メソッド・クレーム・パラメーターを定義することが想定されています。

**出典：** [§11.10: jkt・ath・dpop_jkt の SHA-256 固定](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1516-L1534) / [§11.6: 安全な非対称署名アルゴリズムのみの許可](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1441-L1446)

</details>

### 4-13. hash の安全性

単語の意味 / 選択式 / 1 点

**用語：第二原像計算困難性・衝突耐性**

§11.8 の 2 種類の hash の結び付けについて、これらの性質が果たす役割はどれですか？

- **A.** jkt も ath も、hash を復号すれば元の値が得られる性質を使う
- **B.** jkt は公開鍵を暗号化し、ath は秘密鍵を暗号化する性質を使う
- **C.** 鍵の結び付けには別の鍵で同じ値を得にくい第二原像計算困難性、ath にはトークン値を識別できる衝突耐性が重要である
- **D.** SHA-256 の出力長が同じなら、入力が違ってもすべて同じ値になることを使う

<details>
<summary>解答・解説</summary>

**正解：C**

§11.8。公開鍵の結び付けは、与えられた鍵と同じ hash を持つ別の鍵を見つけにくい第二原像計算困難性に依存します。ath は token hash が十分一意にトークンを識別できることに依存し、SHA-256 の衝突耐性が要件を満たします。hash は暗号化や復号とは違います。

**出典：** [§11.8: JWK の第二原像計算困難性と ath の衝突耐性](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1466-L1480)

</details>

### 4-14. クライアント認証との結び付きの限界

知識 / 選択式 / 1 点

DPoP とクライアント認証を同じトークン要求で使う場合、§11.11 が指摘する限界はどれですか？

- **A.** 同じ TLS トンネル内に共存するが、DPoP proof とクライアント認証が直接暗号学的に結び付くわけではない
- **B.** DPoP の jwk が自動的にクライアント登録済みの認証鍵だと証明される
- **C.** htm に client_id が自動的に署名される
- **D.** 同じ TLS トンネルなら、認証情報のコピーというリスクが一切なくなる

<details>
<summary>解答・解説</summary>

**正解：A**

§11.11。DPoP とクライアント認証の結び付きは同じ TLS トンネルで同時に使われるというもので、両者の直接の暗号学的結合ではありません。認証方式を変更するなどの追加の結合は保護を強め得ますが、その具体的方法は RFC 9449 の範囲外です。

**出典：** [§11.11: クライアント認証との暗号学的な結び付きの限界](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1536-L1548)

</details>

### 4-15. Bearer 互換性と移行

比較・使い分け / 選択式 / 1 点

DPoP と Bearer の両対応 RS と、DPoP を全く知らない従来 RS で、DPoP-bound トークンの Bearer 利用はどう違いますか？

- **A.** 両対応 RS でも、Authorization を Bearer に変えれば proof を省略できる
- **B.** DPoP 非対応 RS でも、未知の cnf.jkt により必ず拒否される
- **C.** クライアントが DPoP 対応なら、従来 RS にも自動的に所持証明の保護がかかる
- **D.** 両対応 RS は Bearer として来た DPoP-bound トークンを拒否する。従来 RS は受理し得るが、そこで DPoP の保護を期待できない

<details>
<summary>解答・解説</summary>

**正解：D**

§7.2。両対応 RS はダウングレード防止のため、Bearer として受け取った DPoP-bound トークンを拒否することが MUST です。一方、DPoP を知らない RS は未知の情報を無視して Bearer として受理し得ます。仕様は Bearer challenge などに基づく段階移行も説明しますが、それが DPoP による保護を意味するわけではありません。

**出典：** [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021)

</details>

### 4-16. challenge の algs と未知のパラメーター

知識 / 選択式 / 1 点

WWW-Authenticate: DPoP algs="ES256 PS256", future="x" を受け取りました。future は未知のパラメーターです。正しい処理はどれですか？

- **A.** algs を JSON 配列として解析し、future の意味を推測して処理する
- **B.** algs は空白区切りの対応署名 alg の一覧として扱い、未知の future は無視する
- **C.** 未知のパラメーターがあるので DPoP を必ず無効にする
- **D.** これを Proxy-Authorization 用の認証指示として扱う

<details>
<summary>解答・解説</summary>

**正解：B**

§7.1。algs は受理可能な JWS alg 値の空白区切りリストです。未知の認証パラメーターは無視することが MUST です。また DPoP 認証スキームはオリジンサーバー認証用で、Proxy-Authenticate や Proxy-Authorization には使用してはなりません (MUST NOT)。

**出典：** [§7.1: WWW-Authenticate のエラー・algs・未知パラメーター](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L899-L936) / [§7.1: CORS でのヘッダー公開とプロキシ認証への使用禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L958-L968)

</details>

### 4-17. 複数 challenge のエラー情報

知識 / 選択式 / 1 点

Bearer と DPoP の両 challenge を返すとき、推奨に沿うエラー情報の付け方はどれですか？

- **A.** 認証情報のない初回要求でも、両方へ必ず invalid_token を付ける
- **B.** Bearer で試したことが明確でも、DPoP 側だけにエラーを付ける
- **C.** 認証情報なしならエラー情報を付けないことが望ましく、方式が明確なら該当方式へ、曖昧なら両方へ付けてもよい
- **D.** DPoP 側の challenge に error を付けることは禁止されている

<details>
<summary>解答・解説</summary>

**正解：C**

§7.2。全体としてこれらの運用ルールへの準拠が RECOMMENDED です。認証情報がない要求ではエラー情報を含めるべきではない (SHOULD NOT)、試みた方式が明確ならその challenge に含めるべきである (SHOULD)、曖昧なら両方に含めてもよい (MAY) とされています。

**出典：** [§7.2: Bearer との互換性と複数 challenge のエラー情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L977-L1021)

</details>

### 4-18. XSS から別鍵トークンを得る攻撃

フロー構築 / 並べ替え / 2 点

§11.4 で説明される、XSS が新しい silent な認可グラントを使って攻撃者の鍵へトークンを結び付ける攻撃例を並べてください。正規クライアントの既存秘密鍵は抽出できません。

- **A.** 攻撃者が得たコードを使い、自分の鍵の proof とともにトークン要求を送る
- **B.** 攻撃者がクライアントのオリジンでコードを実行できるようになる
- **C.** 攻撃者が自分の鍵へ結び付いたトークンを自分の端末で使う
- **D.** 攻撃者のコードが新しい silent な認可グラントを開始し、その認可コードを得る

<details>
<summary>解答・解説</summary>

**正解：B → D → A → C**

§11.4。既存の正規鍵を抽出しなくても、不信なコードが新しい認可グラントから自分の鍵に結び付くトークンを得られる可能性があります。攻撃者は自分の秘密鍵を持つため、その後は正規クライアントがオフラインでも利用できます。DPoP を使うことに加え、XSS・コード挿入を防ぐ必要があります。

**出典：** [§11.4: 非抽出鍵の限界、署名 API の悪用、攻撃者の鍵、CSP](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1398-L1433)

</details>

### 4-19. 複数 RS の単回利用設計

ユースケース設計 / 記述式 / 5 点

同じ URI を処理する RS が 3 台あり、現在 jti の共有状態はありません。要件は「受理可能な時間窓内でも、同じ proof を同じ対象 URI へ 2 回使わせない」です。大量の長い jti による資源消費と、クライアントの通信再試行にも対応します。

時間窓、重複検出の配置と競合、記録のサイズ・寿命、再試行方法を設計してください。

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

まず proof の受理可能な時間を短く制限します。要求された厳密な単回利用を満たすには、共有ストアの原子的な check-and-set、または同じ検証文脈を必ず一貫した状態へ集約する構成などで、3 台をまたぐ jti の重複を拒否します。各台の独立した記録だけでは不十分です。jti は対象 URI の文脈に対応させ、必要な有効時間を覆う間だけ保持し、長すぎる値を拒否するか hash を保存します。nonce を再利用する設計なら nonce の寿命中も重複を追跡します。クライアントは再試行に新しい proof を生成します。RFC がすべての構成に共有ストアを義務付けるのではなく、ここで要求された単回利用を実現するための設計です。

**採点基準（各 1 点）**

- 生成後の限られた時間だけ proof を受理する。固定の秒数自体は要求しない。
- 共有の原子的記録や一貫した集約などで、別レプリカへの再送・同時要求でも同じ jti の二重受理を防ぐ。要件を満たす代替設計も認める。
- 対象 URI の文脈と有効時間に応じて記録を保持・期限切れにする。nonce 再利用時はその寿命中の重複追跡も考慮する。
- 不必要に長い jti の拒否または hash 保存で資源消費を制限する。
- クライアントは通信再試行時に一意の新しい proof を作る。

**出典：** [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358) / [§7.3: 一時的な通信障害と新しい proof による再試行](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1059-L1071) / [§4: リクエストごとの proof と単独では認可できない理由](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L337-L357)

</details>

### 4-20. 総合実装レビュー

ユースケース設計 / 記述式 / 8 点

既存のトークン有効性・権限チェックは正常です。しかし DPoP 実装には次の 8 点があります。①平文 HTTP を許可、②HS256 を許可、③typ 未確認、④htm・htu 未照合、⑤ath 未照合、⑥proof の jwk とトークンの結び付き未照合、⑦nonce 提供後も nonce なしを受理、⑧proof の受理可能な時間を無制限にしています。

各問題について、必要な修正と、防ぐ誤用・攻撃を 1 行ずつ説明してください。

短い箇条書きで構いません。実施する処理と、その理由を対応させてください。

<details>
<summary>解答・解説</summary>

**解答例**

①HTTPS を必須にし、トークンや本文の通信を保護します。②安全で対応・許可された非対称署名だけを使い、HS256 や none を拒否します。③typ=dpop+jwt を確認して別用途 JWT の受理を防ぎます。④現在の htm と query・fragment を除いた htu を照合して別メソッド・別 URI 向け proof を拒否します。⑤提示トークンから ath を再計算して値の差し替えを防ぎます。⑥信頼できる cnf.jkt などと proof 公開鍵を照合して攻撃者の別鍵を拒否します。⑦nonce 提供後の省略を拒否して nonce のダウングレードを防ぎます。⑧proof の受理時間窓を制限し、リプレイ可能な期間を抑えます。

**採点基準（各 1 点）**

- HTTPS を必須にし、DPoP だけでは得られない通信の機密性・完全性を保護すると説明する。
- 安全で対応・許可された非対称署名だけを許可し、HS256 や none を拒否する。
- typ=dpop+jwt を確認し、別用途の JWT への取り違えを防ぐ。
- htm と query・fragment を除いた htu を照合し、別メソッド・URI への流用を防ぐ。
- 提示されたトークン値から ath を検証し、トークンの差し替えを防ぐ。
- proof 公開鍵と、信頼できるトークンの鍵の結び付け情報を照合し、別鍵による利用を拒否する。
- nonce を提供した後に nonce のない proof を受理せず、ダウングレードを防ぐ。
- proof の受理可能な時間窓を制限し、盗まれた proof を再利用できる期間を抑える。

**出典：** [§2: Bearer との違い、HTTPS、XSS に対する保護範囲](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L179-L253) / [§11.7: 本文・一般のヘッダーの完全性と TLS](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1448-L1464) / [§11.6: 安全な非対称署名アルゴリズムのみの許可](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1441-L1446) / [§4.3: 受信時の必須検証、URI 正規化、検証順序](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L485-L523) / [§11.5: typ による別用途 JWT の受理防止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1435-L1439) / [§7: ath によるトークン差し替え防止と残る検証](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L796-L828) / [§4.2: JOSE ヘッダー、必須クレーム、ath と nonce](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L393-L448) / [§6: RS が取得する鍵の結び付け情報](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L684-L699) / [§11.3: nonce 提供後の nonce なし proof の受理禁止](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1393-L1396) / [§11.1: 有効時間、jti 記録、メモリー対策、時計差、nonce 再利用](https://github.com/maronnjapan/readRFCInMobile/blob/993c1cf7f6b5fd47c151a56d60bb801bdd921aac/rfcs/rfc9449.txt#L1322-L1358)

</details>

## 理解を確認する最後の問い

資料を閉じて、次の違いを自分の言葉で説明してください。答えに迷ったら対応する問題へ戻ってください。

- proof の署名成功と、トークンを使う権限はどう違うか（1-18、2-04、2-19）。
- ath・cnf.jkt・dpop_jkt は、それぞれ何と何を結び付けるか（1-14、2-10、3-14）。
- nonce・jti・iat は、事前生成・再利用・有効時間をそれぞれどう制約するか（2-06、3-13、4-05）。
- DPoP が防げるトークン漏えいの悪用と、XSS や本文改変への限界はどこか（1-02、4-08〜4-11）。
- どの要件が常に必須で、どれが機能を採用した後に必須になるか（1-15、3-12、3-15〜3-18）。
