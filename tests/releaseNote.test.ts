/**
 * @file releaseNote.test.ts
 * @description The About screen reads the note CI requires for that version.
 */

import { describe, expect, it } from 'vitest';
import { releaseNoteFor } from '../src/renderer/shell/releaseNote';

describe('release note', () => {
  it('returns the note whose path is docs/releases for that version', () => {
    const notes = {
      '../../../docs/releases/0.1.0.md': '  Première livraison.\n',
      '../../../docs/releases/0.2.0.md': 'Autre.',
    };
    expect(releaseNoteFor('0.1.0', notes)).toBe('Première livraison.');
  });

  it('returns an empty string when that version has no note', () => {
    expect(releaseNoteFor('0.1.0', {})).toBe('');
    expect(releaseNoteFor('0.1.0-dev', { 'docs/releases/0.1.0-dev.md': 'x' })).toBe('');
  });
});
