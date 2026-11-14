# AI を使わず問題ファイルを公開する

readRFCInMobile は作成済みの JSON を読み、出題・回答・即時採点を行う。問題を誰が、どの AI やエディタで作ったかは問わない。作問 API の実行履歴は不要。

[作問スキル](../../../skills/quiz-authoring/SKILL.md)がカテゴリと回答方式を定義し、`worker/contracts.js` が正式なファイル形式を検証する。仕様問題は [RFC 7591 のサンプル](../questions/spec/rfc-7591.json)、実装問題は [実装問題のサンプル](../questions/spec/rfc-7591-implementation.json)を参照する。

PR 問題では仕様を指定しなければ `spec:null` とし、`pullRequest` に `repository,number,baseSha,headSha`、`references` に対象 head の差分を保存する。保存場所は `apps/quiz/questions/pr/<owner>/<repo>/<PR番号>/<問題ID>.json`。必要な問題数を用意でき、20問・40出典の上限は PR 問題には適用しない。

作問中は `status:"draft"`、公開するファイルは `status:"published"` にする。正解・解説・採点基準は `solutions` に置く。問題文や初期コードへ正解を混ぜない。

```sh
node apps/quiz/tools/authoring/quiz.mjs check --path apps/quiz/questions/pr/owner/repo/194/example.json
git add apps/quiz/questions/pr/owner/repo/194/example.json
git commit -m 'Add PR quiz'
git push
```

main の公開済みファイルは通常の Worker デプロイに含まれ、`/quiz` からログインなしで選択・回答できる。別ブランチの固定版を追加登録する方法と元の PR へ URL を返す設定は、[PR 連携](pr-integration.md)を参照する。

選択式・並べ替え・スマホ向けコード読解は保存済みの正解で即時採点する。記述式・PCの実装回答は保存でき、ログインして明示的に依頼した場合に AI 採点を実行する。AI 作問と AI 採点の利用は独立している。
