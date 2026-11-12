export async function questionSetId(revision) {
  const { repository, commit, path } = revision;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${repository}@${commit}:${path}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
