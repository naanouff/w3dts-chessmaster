/**
 * @file shellEndAnalyze.test.ts
 * @description End-card analyse opens the coach drawer without wiping history contract.
 */

import { describe, expect, it } from 'vitest';
import { SHELL_LANGUAGES } from '../src/renderer/shell/copy/shellCopy';
import { shellCopy } from '../src/renderer/shell/copy/shellCopy';
import { initialShell, reduceShell } from '../src/renderer/shell/shellScreen';

describe('end-card analyse', () => {
  it('names Analyse in every catalog', () => {
    for (const id of SHELL_LANGUAGES) {
      expect(shellCopy(id).analyze.trim().length).toBeGreaterThan(0);
    }
    expect(shellCopy('fr').analyze).toBe('Analyser');
  });

  it('opens the assistant from a finished table without leaving the match', () => {
    const playing = { ...initialShell(false), screen: 'partie' as const };
    const next = reduceShell(playing, { type: 'open-assistant' });
    expect(next.screen).toBe('partie');
    expect(next.assistant).toBe(true);
  });
});
