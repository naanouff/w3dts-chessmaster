/**
 * @file shellCopy.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Looks up the shell catalog. An unknown language returns French.
 */

import { DE } from './de';
import { EN } from './en';
import { ES } from './es';
import { FR } from './fr';
import { IT } from './it';
import { JA } from './ja';
import { RU } from './ru';
import {
  isShellLanguage,
  type ShellCopy,
  type ShellLanguage,
} from './types';
import { ZH } from './zh';

export {
  isShellLanguage,
  publishShellLanguage,
  SHELL_LANGUAGE_LABELS,
  SHELL_LANGUAGES,
  subscribeShellLanguage,
} from './types';
export type { ShellCopy, ShellLanguage, ShellModeCard } from './types';

const CATALOGS: Record<ShellLanguage, ShellCopy> = {
  fr: FR,
  en: EN,
  de: DE,
  it: IT,
  es: ES,
  ru: RU,
  zh: ZH,
  ja: JA,
};

/**
 * Catalog for a stored language. Anything else is French.
 * @param language - Code from preferences, or any string.
 */
export function shellCopy(language: string): ShellCopy {
  return isShellLanguage(language) ? CATALOGS[language] : FR;
}
