const GIT_LFS_SPEC_LINE = 'version https://git-lfs.github.com/spec/v1';

/** True when a downloaded buffer is a Git LFS pointer instead of the asset. */
export function arrayBufferLooksLikeGitLfsPointer(buffer: ArrayBuffer, maxBytes = 200): boolean {
  if (buffer.byteLength < GIT_LFS_SPEC_LINE.length) return false;
  const n = Math.min(buffer.byteLength, maxBytes);
  const head = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, n));
  return head.startsWith(GIT_LFS_SPEC_LINE);
}

/** True when a 200 response is an HTML fallback instead of the asset. */
export function arrayBufferLooksLikeHtml(buffer: ArrayBuffer, maxBytes = 64): boolean {
  if (buffer.byteLength === 0) return false;
  const n = Math.min(buffer.byteLength, maxBytes);
  const head = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, n)).trimStart();
  return head.startsWith('<!') || head.toLowerCase().startsWith('<html');
}

/** Same-origin fetch. Dev is the Vite server; production is the `app://` protocol. */
export function fetchPublicAssetPreferSameOrigin(url: string): Promise<Response> {
  return fetch(url);
}

/** Loads a JSON graph shipped in `public/`. */
export async function fetchSceneDdGraphJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  return res.json();
}
