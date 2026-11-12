# リポジトリの作業案内

RFC/PDFリーダーと、`apps/quiz/`のHono・Cloudflare Workersによる仕様理解クイズを管理します。構成は`README.md`と`apps/quiz/README.md`を参照してください。

問題の作成・変更・レビューには、共通の`skills/quiz-authoring/SKILL.md`を参照してください。`.agents/skills/quiz-authoring`と`.claude/skills/quiz-authoring`は同じ実体を指します。カテゴリや回答方式を追加したら、このskillと`apps/quiz/worker/prompts.js`も更新します。

依存はルートで`npm ci`、検証は`npm test`と`npm run check:workers`です。問題画面の変更はPCとスマホ幅の双方で確認してください。RFC/PDFの日本語訳を行う場合は、`CLAUDE.md`の翻訳手順・表記ルールにも従ってください。
