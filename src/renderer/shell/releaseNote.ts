/**
 * @file releaseNote.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Picks the French release note that matches one package version.
 */

const RELEASE_NOTE = /^(\d+\.\d+\.\d+)$/;

/**
 * French note for one strict version, or an empty string when that release has no file.
 * The path is the same one CI requires: `docs/releases/X.Y.Z.md`.
 * @param version - `package.json` version, as returned by `app.getVersion()`.
 * @param notes - Raw markdown keyed by a path that ends with that file.
 * @returns Trimmed note, or `''` when the version is not strict or the file is absent.
 */
export function releaseNoteFor(version: string, notes: Readonly<Record<string, string>>): string {
  if (!RELEASE_NOTE.test(version)) return '';
  const suffix = `docs/releases/${version}.md`;
  for (const [path, text] of Object.entries(notes)) {
    if (path.replaceAll('\\', '/').endsWith(suffix)) return text.trim();
  }
  return '';
}
