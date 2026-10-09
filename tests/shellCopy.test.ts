/**
 * @file shellCopy.test.ts
 * @description CHESS-B11: one shell catalog per language, French as the source.
 */

import { describe, expect, it } from 'vitest';
import { ECO_OPENINGS } from '../src/chess/index';
import {
  GRAPHICS_PRESETS,
  TEXTURE_QUALITY_OPTIONS,
} from '../src/renderer/graphics/chessGraphicsSettings';
import {
  SHELL_LANGUAGES,
  SHELL_LANGUAGE_LABELS,
  publishShellLanguage,
  shellCopy,
  subscribeShellLanguage,
  type ShellLanguage,
} from '../src/renderer/shell/copy/shellCopy';

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (Array.isArray(value)) return value.map((_, index) => `${prefix}[${index}]`);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [];
}

describe('shell copy', () => {
  it('gives every locale the same French keys, with no empty string', () => {
    const french = leafPaths(shellCopy('fr'));
    for (const language of SHELL_LANGUAGES) {
      const copy = shellCopy(language);
      expect(leafPaths(copy)).toEqual(french);
      for (const path of leafPaths(copy)) {
        const value = path.split(/\.|\[|\]/).filter(Boolean).reduce<unknown>((node, key) => {
          if (Array.isArray(node)) return node[Number(key)];
          return (node as Record<string, unknown>)[key];
        }, copy);
        expect(value, `${language} ${path}`).not.toBe('');
      }
    }
  });

  it('translates presets, modes and the language names', () => {
    const french = shellCopy('fr');
    const german = shellCopy('de');
    expect(german.presets.fluide).not.toBe(french.presets.fluide);
    expect(german.modeCards.cpu.title).not.toBe(french.modeCards.cpu.title);
    expect(german.play).toBe('Spielen');
    expect(german.openings.C44).not.toBe(french.openings.C44);
    expect(german.p2p.waiting).not.toBe(french.p2p.waiting);
    expect(SHELL_LANGUAGE_LABELS.en).toBe('English');
    expect(SHELL_LANGUAGE_LABELS).toEqual({
      fr: 'Français',
      en: 'English',
      de: 'Deutsch',
      it: 'Italiano',
      es: 'Español',
      ru: 'Русский',
      zh: '中文',
      ja: '日本語',
    });
  });

  it('covers the preset, texture and opening ids the shell already shows', () => {
    const copy = shellCopy('fr');
    expect(Object.keys(copy.presets).sort()).toEqual(GRAPHICS_PRESETS.map((preset) => preset.id).sort());
    expect(Object.keys(copy.textureQuality).sort()).toEqual(
      TEXTURE_QUALITY_OPTIONS.map((option) => option.id).sort()
    );
    expect(Object.keys(copy.openings).sort()).toEqual(ECO_OPENINGS.map((opening) => opening.eco).sort());
  });

  it('addresses the student in simple, almost formal French', () => {
    const copy = shellCopy('fr');
    const speech = `${copy.ghostHint} ${copy.objectionLesson} ${copy.trainingWelcome}`;
    expect(speech).toMatch(/\bvous\b/);
    expect(speech).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/);
  });

  it('falls back to French for an unknown language', () => {
    expect(shellCopy('pt')).toEqual(shellCopy('fr'));
  });

  it('notifies listeners when the shell language is published', () => {
    const seen: ShellLanguage[] = [];
    const stop = subscribeShellLanguage((language) => seen.push(language));
    publishShellLanguage('ja');
    stop();
    publishShellLanguage('de');
    expect(seen).toEqual(['ja']);
  });
});
