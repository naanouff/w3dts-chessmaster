/**
 * @file chessHudState.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-28
 * @description Typed Chess Game HUD payload (`uiBus` `w3dts-chess-hud-state`). CHESS-B5.
 */

import type { CoachGhostStep } from '../coach/coachPlan';
import type { ChessColor, ChessPieceRole, ChessSquareName } from '../rules/chessTypes';
import { acceptSavedGame, type SavedGame, type SavedShellMode } from './savedGames';
import {
  parseChessDemoSession,
  type ChessDemoQuery,
  type ChessPlayMode,
} from './parseChessDemoQuery';

/** Dedicated bus event so `w3dts-gameplay-ui-state` / IngameUiDemo stay untouched. */
export const CHESS_HUD_STATE_EVENT = 'w3dts-chess-hud-state';

/** HUD → project: mode picker / apply session without reloading the engine. */
export const CHESS_HUD_COMMAND_EVENT = 'w3dts-chess-hud-command';

export type ChessHudCommand =
  | { type: 'mode-picker'; open: boolean }
  | { type: 'apply-session'; session: ChessDemoQuery; table?: SavedShellMode }
  | { type: 'request-state' }
  | { type: 'resume-saved'; game: SavedGame; cpuDepth?: number }
  | { type: 'save-voluntary' }
  | { type: 'discard-interrupt' }
  | { type: 'delete-voluntary'; id: string }
  | { type: 'training-stop' }
  | { type: 'training-resume' }
  | { type: 'training-undo' }
  | { type: 'training-clock'; on: boolean }
  | { type: 'coach-ghosts'; steps: CoachGhostStep[]; horizon: number };

export type ChessHudP2pStatus = 'waiting' | 'connecting' | 'connected' | 'disconnected';

export type ChessHudPlayMode = Exclude<ChessPlayMode, 'learn'>;

export type ChessHudSanStatus = 'done' | 'current' | 'future';

export interface ChessHudSanPly {
  san: string;
  status: ChessHudSanStatus;
  /** Quiz hides the next (and future) SAN. */
  hidden: boolean;
}

export interface ChessHudPlayState {
  kind: 'play';
  mode: ChessHudPlayMode;
  label: string;
  title: string;
  description: string;
  localColor: ChessColor;
  sideToMove: ChessColor;
  cpuThinking: boolean;
  p2pStatus: ChessHudP2pStatus | null;
  clocks: { whiteSeconds: number; blackSeconds: number };
  flag: ChessColor | null;
  session: ChessDemoQuery;
}

export interface ChessHudLearnState {
  kind: 'learn';
  label: string;
  title: string;
  description: string;
  eco: string;
  openingName: string;
  plyIndex: number;
  plyCount: number;
  quiz: boolean;
  miss: boolean;
  complete: boolean;
  coachBusy: boolean;
  plies: ChessHudSanPly[];
  session: ChessDemoQuery;
}

export type ChessHudState = ChessHudPlayState | ChessHudLearnState;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseColor(raw: unknown): ChessColor | null {
  return raw === 'white' || raw === 'black' ? raw : null;
}

function parsePlayMode(raw: unknown): ChessHudPlayMode | null {
  return raw === 'cpu' || raw === 'hotseat' || raw === 'p2p' || raw === 'training' ? raw : null;
}

function parseP2pStatus(raw: unknown): ChessHudP2pStatus | null {
  if (raw === null) return null;
  return normalizeChessHudP2pStatus(raw);
}

function parseNonEmptyString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function parseFiniteNumber(raw: unknown, fallback = 0): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function parseSanStatus(raw: unknown): ChessHudSanStatus | null {
  return raw === 'done' || raw === 'current' || raw === 'future' ? raw : null;
}

function parseSanPly(raw: unknown): ChessHudSanPly | null {
  if (!isRecord(raw)) return null;
  const san = parseNonEmptyString(raw.san);
  const status = parseSanStatus(raw.status);
  if (!san || !status) return null;
  return { san, status, hidden: raw.hidden === true };
}

export function stripChessSanSuffix(san: string): string {
  return san.replace(/[+#]$/, '');
}

/** Map transport states onto the four HUD chips (degraded ≈ still linked). */
export function normalizeChessHudP2pStatus(raw: unknown): ChessHudP2pStatus {
  if (raw === 'waiting' || raw === 'connecting' || raw === 'connected' || raw === 'disconnected') {
    return raw;
  }
  if (raw === 'degraded') return 'connected';
  return 'waiting';
}

export function chessPlayP2pHint(localColor: ChessColor): string {
  const other: ChessColor = localColor === 'white' ? 'black' : 'white';
  return `You are ${localColor}. Second tab: chess=p2p&chessColor=${other}`;
}

export function buildChessHudLearnPlies(
  sans: readonly string[],
  plyIndex: number,
  quiz: boolean
): ChessHudSanPly[] {
  const ply = Math.max(0, Math.min(plyIndex, sans.length));
  return sans.map((san, i) => {
    const status: ChessHudSanStatus = i < ply ? 'done' : i === ply ? 'current' : 'future';
    return {
      san: stripChessSanSuffix(san),
      status,
      hidden: quiz && status !== 'done',
    };
  });
}

function parsePlay(raw: Record<string, unknown>): ChessHudPlayState | null {
  const mode = parsePlayMode(raw.mode);
  const label = parseNonEmptyString(raw.label);
  const title = parseNonEmptyString(raw.title);
  const description = typeof raw.description === 'string' ? raw.description : '';
  const localColor = parseColor(raw.localColor);
  const sideToMove = parseColor(raw.sideToMove);
  if (!mode || !label || !title || !localColor || !sideToMove) return null;
  const clocksRaw = isRecord(raw.clocks) ? raw.clocks : {};
  const flag = raw.flag === null || raw.flag === undefined ? null : parseColor(raw.flag);
  if (raw.flag !== null && raw.flag !== undefined && flag === null) return null;
  return {
    kind: 'play',
    mode,
    label,
    title,
    description,
    localColor,
    sideToMove,
    cpuThinking: raw.cpuThinking === true,
    p2pStatus: mode === 'p2p' ? parseP2pStatus(raw.p2pStatus) : null,
    clocks: {
      whiteSeconds: Math.max(0, parseFiniteNumber(clocksRaw.whiteSeconds)),
      blackSeconds: Math.max(0, parseFiniteNumber(clocksRaw.blackSeconds)),
    },
    flag,
    session: parseChessDemoSession(raw.session) ?? { mode, localColor, quiz: false },
  };
}

function parseLearn(raw: Record<string, unknown>): ChessHudLearnState | null {
  const label = parseNonEmptyString(raw.label);
  const title = parseNonEmptyString(raw.title);
  const eco = parseNonEmptyString(raw.eco);
  const openingName = parseNonEmptyString(raw.openingName);
  if (!label || !title || !eco || !openingName) return null;
  const pliesIn = raw.plies;
  const plies: ChessHudSanPly[] = Array.isArray(pliesIn)
    ? pliesIn.map(parseSanPly).filter((p): p is ChessHudSanPly => p !== null)
    : [];
  return {
    kind: 'learn',
    label,
    title,
    description: typeof raw.description === 'string' ? raw.description : '',
    eco,
    openingName,
    plyIndex: Math.max(0, parseFiniteNumber(raw.plyIndex)),
    plyCount: Math.max(0, parseFiniteNumber(raw.plyCount)),
    quiz: raw.quiz === true,
    miss: raw.miss === true,
    complete: raw.complete === true,
    coachBusy: raw.coachBusy === true,
    plies,
    session: parseChessDemoSession(raw.session) ?? {
      mode: 'learn',
      localColor: 'white',
      eco,
      quiz: raw.quiz === true,
    },
  };
}

/**
 * Valide un payload `unknown` (bus) en état HUD sûr. `null` = rien à afficher.
 */
export function parseChessHudState(raw: unknown): ChessHudState | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'play') return parsePlay(raw);
  if (raw.kind === 'learn') return parseLearn(raw);
  return null;
}

export function parseChessHudCommand(raw: unknown): ChessHudCommand | null {
  if (!isRecord(raw)) return null;
  if (raw.type === 'mode-picker') {
    return { type: 'mode-picker', open: raw.open === true };
  }
  if (raw.type === 'apply-session') {
    const session = parseChessDemoSession(raw.session);
    if (!session) return null;
    const table = parseTable(raw.table);
    return table ? { type: 'apply-session', session, table } : { type: 'apply-session', session };
  }
  if (raw.type === 'request-state') {
    return { type: 'request-state' };
  }
  if (raw.type === 'resume-saved') {
    const game = acceptSavedGame(raw.game);
    if (!game) return null;
    const cpuDepth = typeof raw.cpuDepth === 'number' && Number.isFinite(raw.cpuDepth) ? raw.cpuDepth : undefined;
    return cpuDepth !== undefined ? { type: 'resume-saved', game, cpuDepth } : { type: 'resume-saved', game };
  }
  if (raw.type === 'save-voluntary') return { type: 'save-voluntary' };
  if (raw.type === 'discard-interrupt') return { type: 'discard-interrupt' };
  if (raw.type === 'delete-voluntary' && typeof raw.id === 'string' && raw.id.length > 0) {
    return { type: 'delete-voluntary', id: raw.id };
  }
  if (raw.type === 'training-stop') return { type: 'training-stop' };
  if (raw.type === 'training-resume') return { type: 'training-resume' };
  if (raw.type === 'training-undo') return { type: 'training-undo' };
  if (raw.type === 'training-clock') return { type: 'training-clock', on: raw.on === true };
  if (raw.type === 'coach-ghosts') {
    const steps = Array.isArray(raw.steps) ? raw.steps.map(parseGhostStep).filter((step) => step !== null) : [];
    const horizon = typeof raw.horizon === 'number' ? Math.min(5, Math.max(1, Math.floor(raw.horizon))) : 3;
    return { type: 'coach-ghosts', steps: steps.slice(0, 5), horizon };
  }
  return null;
}

function parseTable(value: unknown): SavedShellMode | undefined {
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
  return undefined;
}

const GHOST_ROLES: readonly ChessPieceRole[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

function parseGhostStep(raw: unknown): CoachGhostStep | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.san !== 'string' || typeof rec.from !== 'string' || typeof rec.to !== 'string') return null;
  if (!/^[a-h][1-8]$/.test(rec.from) || !/^[a-h][1-8]$/.test(rec.to)) return null;
  if (rec.color !== 'white' && rec.color !== 'black') return null;
  if (!GHOST_ROLES.includes(rec.role as ChessPieceRole)) return null;
  return {
    san: rec.san,
    from: rec.from as ChessSquareName,
    to: rec.to as ChessSquareName,
    role: rec.role as ChessPieceRole,
    color: rec.color,
  };
}
