export const QUESTION_DIRECTORY = 'apps/quiz/questions';

// 過去に公開した SHA の問題ファイルも引き続き取り込める。
export function questionKind(path) {
  return /^(?:apps\/quiz\/)?questions\/(spec|pr)\/.+\.json$/.exec(path)?.[1] || null;
}

export function questionFilePath(artifact) {
  return artifact.pullRequest
    ? `${QUESTION_DIRECTORY}/pr/${artifact.pullRequest.repository}/${artifact.pullRequest.number}/${artifact.id}.json`
    : `${QUESTION_DIRECTORY}/spec/${artifact.spec.id}.json`;
}
