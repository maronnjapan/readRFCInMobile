# RFC の日本語訳

このフォルダに `rfcNNNN.json`（例: `rfc7591.json`）を置くと、その RFC を原文と日本語訳で切り替えて読めます。

ひな形はアプリの文書の末尾にある「翻訳用ファイル (JSON) を書き出す」か、`node scripts/translation.mjs template rfc 7591` で作れます。
各項目の `dst` に `src`（原文）の訳文を書き込んでください。詳しくはリポジトリの README の「日本語訳を表示する」を参照してください。
