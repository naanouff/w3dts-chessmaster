/**
 * @file bundledReleaseNotes.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Release notes shipped with the client, keyed like the CI check.
 */

import { releaseNoteFor } from './releaseNote';

const notes = import.meta.glob('../../../docs/releases/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Note bundled for the running version.
 * @param version - Value of `app.getVersion()`.
 * @returns Trimmed markdown, or `''` when this version has no note yet.
 */
export function bundledReleaseNote(version: string): string {
  return releaseNoteFor(version, notes);
}
