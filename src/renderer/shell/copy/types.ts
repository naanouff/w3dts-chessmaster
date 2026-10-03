/**
 * @file types.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Shell language codes and the shape of one catalog.
 */

/** Languages the shell can store. `zh` is Simplified Chinese. */
export const SHELL_LANGUAGES = ['fr', 'en', 'de', 'it', 'es', 'ru', 'zh', 'ja'] as const;

export type ShellLanguage = (typeof SHELL_LANGUAGES)[number];

/** Endonyms, so each player can find their own language. */
export const SHELL_LANGUAGE_LABELS: Record<ShellLanguage, string> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  it: 'Italiano',
  es: 'Español',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
};

/**
 * True when the value is one of the eight shell languages.
 * @param value - Stored preference, or a choice id.
 */
export function isShellLanguage(value: unknown): value is ShellLanguage {
  return typeof value === 'string' && (SHELL_LANGUAGES as readonly string[]).includes(value);
}

export interface ShellModeCard {
  title: string;
  blurb: string;
}

export interface ShellCopy {
  play: string;
  ranks: string;
  options: string;
  about: string;
  aboutVersion: string;
  aboutNote: string;
  aboutNoteMissing: string;
  aboutCredits: string;
  aboutCopyright: string;
  aboutProprietary: string;
  settings: string;
  settingsHint: string;
  modes: string;
  modeCards: {
    cpu: ShellModeCard;
    hotseat: ShellModeCard;
    local: ShellModeCard;
    online: ShellModeCard;
    learn: ShellModeCard;
  };
  color: string;
  white: string;
  black: string;
  level: string;
  line: string;
  openings: {
    C50: string;
    C60: string;
    C44: string;
    B20: string;
    C00: string;
    B10: string;
    D06: string;
    E60: string;
  };
  begin: string;
  openLobby: string;
  back: string;
  backModes: string;
  lobby: string;
  colorHint: string;
  create: string;
  join: string;
  copy: string;
  refused: string;
  whiteTurn: string;
  blackTurn: string;
  thinking: string;
  learn: string;
  assistant: string;
  pause: string;
  grab: string;
  orbit: string;
  reset: string;
  coachBanner: string;
  noModel: string;
  explain: string;
  hint: string;
  ask: string;
  send: string;
  openSettings: string;
  close: string;
  resume: string;
  changeMode: string;
  leave: string;
  home: string;
  sound: string;
  sfx: string;
  ambience: string;
  language: string;
  controls: string;
  grabLine: string;
  orbitLine: string;
  resetLine: string;
  escapeKey: string;
  escapeLine: string;
  example: string;
  wins: string;
  losses: string;
  draws: string;
  streak: string;
  localGames: readonly string[];
  onlineGames: readonly string[];
  exampleRanks: string;
  localTab: string;
  onlineTab: string;
  optionsHint: string;
  preset: string;
  presets: {
    fluide: string;
    equilibre: string;
    qualite: string;
    natif: string;
  };
  image: string;
  resolution: string;
  resolutionNative: string;
  textures: string;
  textureQuality: {
    low: string;
    medium: string;
    high: string;
  };
  effects: string;
  shadows: string;
  ao: string;
  reflections: string;
  bloom: string;
  render: string;
  fps: string;
  p2p: {
    waiting: string;
    connecting: string;
    connected: string;
    disconnected: string;
  };
}

type LanguageListener = (language: ShellLanguage) => void;

const languageListeners = new Set<LanguageListener>();

/**
 * Tells the learn HUD that Paramètres changed the language.
 * @param language - Language just stored.
 */
export function publishShellLanguage(language: ShellLanguage): void {
  for (const listener of languageListeners) listener(language);
}

/**
 * Subscribes to {@link publishShellLanguage}.
 * @param listener - Called with the new language.
 * @returns Stops the subscription.
 */
export function subscribeShellLanguage(listener: LanguageListener): () => void {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
}
