/**
 * @file shellScreen.ts
 * @description Screen transitions for the ChessMaster shell. No DOM and no GPU.
 */

import { cpuSearchDepth, ECO_OPENINGS, type ChessColor, type ChessDemoQuery, type ChessPlayMode } from '../../chess';
import { isShellLanguage, type ShellLanguage } from './copy/types';

/** localStorage key shared by the shell and the learn HUD. */
export const SHELL_PREFS_KEY = 'w3dts-chess-shell';

export type ShellScreen =
  | 'accueil'
  | 'modes'
  | 'salon'
  | 'partie'
  | 'pause'
  | 'options'
  | 'parametres'
  | 'classements'
  | 'propos'
  | 'sauvegardes';

export type ShellMode = 'cpu' | 'hotseat' | 'local' | 'online' | 'learn' | 'training';

export interface ShellState {
  screen: ShellScreen;
  back: ShellScreen;
  assistant: boolean;
  reopenAssistant: boolean;
  mode: ShellMode;
  /** `refused` is a bad code. `missing` is a table the relay did not open. */
  notice: '' | 'refused' | 'missing';
}

export type ShellAction =
  | { type: 'play' }
  | { type: 'start' }
  | { type: 'go'; screen: ShellScreen }
  | { type: 'escape' }
  | { type: 'open-assistant' }
  | { type: 'close-assistant' }
  | { type: 'coach-settings' }
  | { type: 'reject-code' }
  | { type: 'set-mode'; mode: ShellMode }
  | { type: 'resume' }
  | { type: 'leave-table' }
  | { type: 'create-table'; code: string }
  | { type: 'join-table'; code: string }
  | { type: 'peer-ready' }
  | { type: 'miss-table' };

export interface ShellPrefs {
  sfx: number;
  ambience: number;
  language: ShellLanguage;
  mode: ShellMode;
  color: ChessColor;
  /** Slider step from 1 to 5. */
  level: number;
  eco: string;
}

/**
 * Welcome screen, or the game when this window is the invited peer.
 * @param peerWindow - True when the URL contains `chessPeer=1`.
 */
export function initialShell(peerWindow: boolean): ShellState {
  return {
    screen: peerWindow ? 'partie' : 'accueil',
    back: 'accueil',
    assistant: false,
    reopenAssistant: false,
    mode: 'cpu',
    notice: '',
  };
}

/**
 * Next shell state. Full screens remember where Fermer returns.
 * @param state - Current screen.
 * @param action - Player intent.
 */
export function reduceShell(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'play':
      return { ...state, screen: 'modes', back: 'accueil', assistant: false, notice: '' };
    case 'set-mode':
      return { ...state, mode: action.mode, notice: '' };
    case 'start':
      return state.mode === 'online'
        ? { ...state, screen: 'salon', back: 'modes', assistant: false, notice: '' }
        : { ...state, screen: 'partie', back: 'modes', assistant: false, notice: '' };
    case 'create-table':
    case 'join-table':
      return { ...state, screen: 'salon', mode: 'online', back: 'modes', assistant: false, notice: '' };
    case 'peer-ready':
      return state.screen === 'salon' && state.mode === 'online'
        ? { ...state, screen: 'partie', mode: 'online', back: 'salon', assistant: false, notice: '' }
        : state;
    case 'miss-table':
      return state.screen === 'salon' ? { ...state, notice: 'missing' } : state;
    case 'leave-table':
      return { ...state, screen: 'salon', back: 'modes', assistant: false, notice: '' };
    case 'resume':
      return { ...state, screen: 'partie', assistant: false };
    case 'go':
      return {
        ...state,
        screen: action.screen,
        back: action.screen === 'accueil' ? 'accueil' : state.screen,
        assistant: false,
        reopenAssistant: false,
        notice: '',
      };
    case 'open-assistant':
      return state.screen === 'partie' ? { ...state, assistant: true } : state;
    case 'close-assistant':
      return { ...state, assistant: false };
    case 'coach-settings':
      return {
        ...state,
        screen: 'parametres',
        back: 'partie',
        assistant: false,
        reopenAssistant: true,
      };
    case 'reject-code':
      return state.screen === 'salon' ? { ...state, notice: 'refused' } : state;
    case 'escape':
      return escapeShell(state);
    default:
      return state;
  }
}

/**
 * A full screen stops grabs and the CPU. The game and its drawer do not.
 * @param state - Current screen.
 */
export function shellBlocksPlay(state: ShellState): boolean {
  return state.screen !== 'partie';
}

/**
 * Session emitted as `apply-session`. Local and online both use the peer channel.
 * Online carries the table code and the seat. The relay room is that code.
 * @param mode - Card chosen on the modes screen.
 * @param localColor - Side for this window.
 * @param eco - Opening code when the mode is learn.
 * @param level - CPU slider step.
 * @param online - Table code and seat when the mode is online.
 */
export function shellSession(
  mode: ShellMode,
  localColor: ChessColor,
  eco: string,
  level: number,
  online?: { room: string; seat: 'host' | 'guest' }
): ChessDemoQuery {
  const play: ChessPlayMode = mode === 'local' || mode === 'online' ? 'p2p' : mode;
  return {
    mode: play,
    localColor,
    quiz: mode === 'learn',
    ...(mode === 'learn' ? { eco } : {}),
    ...(mode === 'cpu' || mode === 'training' ? { cpuDepth: cpuSearchDepth(level) } : {}),
    ...(mode === 'online' && online ? { room: online.room, seat: online.seat } : {}),
  };
}

/**
 * The second window is the same-machine table. An online table meets on the relay.
 * @param table - Shell mode stored on the session, when the command carried one.
 */
export function opensLocalPeerWindow(table: string | undefined): boolean {
  return table !== 'online';
}

/**
 * Query for the second window when a local game is restored.
 * The guest takes the other color and loads the same fiche.
 * @param hostColor - Color stored on the fiche.
 * @param id - Interrupt or voluntary id.
 */
export function peerResumeSearch(hostColor: ChessColor, id: string): string {
  const guest = hostColor === 'black' ? 'white' : 'black';
  return `chess=p2p&chessColor=${guest}&chessPeer=1&chessShell=local&chessResume=${encodeURIComponent(id)}`;
}

/**
 * A table code is four characters and not the reserved refusal code.
 * @param code - Text from the join field.
 */
export function acceptJoinCode(code: string): boolean {
  return code.trim().length === 4 && code.trim() !== '0000';
}

/**
 * Thumb position on a slider, from 0 at the minimum to 1 at the maximum.
 * @param value - Current value.
 * @param min - Slider minimum.
 * @param max - Slider maximum.
 */
export function rangeThumbRatio(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * How far crest color has climbed, from 0 (gray) to 1 (full color).
 * While the studio is still booting the fill holds short of the top.
 * @param elapsedMs - Time since the cover appeared.
 * @param studioReady - True once the chess table can be shown.
 */
export function bootCrestFill(elapsedMs: number, studioReady: boolean): number {
  if (studioReady) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return 0.92 * (1 - Math.exp(-elapsedMs / 2800));
}

/**
 * Top inset of the color layer so the crest fills from the bottom.
 * @param fill - Result of {@link bootCrestFill}.
 */
export function bootCrestInset(fill: number): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fill) ? fill : 0));
  return `${(1 - clamped) * 100}%`;
}

/** Stored sound, language and last table choices before the player changes them. */
export function defaultShellPrefs(): ShellPrefs {
  return { sfx: 80, ambience: 40, language: 'fr', mode: 'cpu', color: 'white', level: 2, eco: firstEco() };
}

/**
 * Reads saved shell preferences. Unknown JSON falls back to the defaults.
 * @param raw - localStorage payload, or null.
 */
export function parseShellPrefs(raw: string | null): ShellPrefs {
  const base = defaultShellPrefs();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<ShellPrefs>;
    return {
      sfx: clampPercent(parsed.sfx, base.sfx),
      ambience: clampPercent(parsed.ambience, base.ambience),
      language: isShellLanguage(parsed.language) ? parsed.language : 'fr',
      mode: parseStoredMode(parsed.mode),
      color: parsed.color === 'black' ? 'black' : 'white',
      level: parseStoredLevel(parsed.level),
      eco: parseStoredEco(parsed.eco),
    };
  } catch {
    return base;
  }
}

function firstEco(): string {
  return ECO_OPENINGS[0]?.eco ?? 'C50';
}

function parseStoredMode(value: unknown): ShellMode {
  if (
    value === 'cpu' ||
    value === 'hotseat' ||
    value === 'local' ||
    value === 'online' ||
    value === 'learn' ||
    value === 'training'
  ) {
    return value;
  }
  return 'cpu';
}

function parseStoredLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) return 2;
  return value;
}

function parseStoredEco(value: unknown): string {
  const first = firstEco();
  if (typeof value !== 'string') return first;
  return ECO_OPENINGS.some((opening) => opening.eco === value) ? value : first;
}

function clampPercent(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function escapeShell(state: ShellState): ShellState {
  if (state.assistant && state.screen === 'partie') {
    return { ...state, assistant: false };
  }
  if (state.screen === 'partie') {
    return { ...state, screen: 'pause', back: 'partie', assistant: false };
  }
  if (state.screen === 'pause') {
    return { ...state, screen: 'partie' };
  }
  const reopen = state.reopenAssistant && state.back === 'partie';
  return {
    ...state,
    screen: state.back,
    assistant: reopen,
    reopenAssistant: false,
    notice: '',
  };
}
