/**
 * @file savedGames.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description One interruption slot and the voluntary saves the player asked for.
 */

import { ECO_OPENINGS } from '../learn/ecoOpenings';
import { ChessMatch } from '../rules/ChessMatch';
import type { ChessColor } from '../rules/chessTypes';

/** How many voluntary saves are kept. The interruption does not count. */
export const VOLUNTARY_SAVE_LIMIT = 20;

const CLOCK_START_S = 600;

export type SavedShellMode = 'cpu' | 'hotseat' | 'local' | 'online' | 'learn' | 'training';

export interface SavedGame {
  id: string;
  kind: 'interrupt' | 'voluntary';
  savedAt: number;
  shellMode: SavedShellMode;
  fen: string;
  whiteSeconds: number;
  blackSeconds: number;
  localColor: ChessColor;
  eco?: string;
  plyIndex?: number;
}

export interface SaveCabinet {
  interrupt: SavedGame | null;
  voluntary: SavedGame[];
}

/** No interruption and no voluntary saves. */
export function emptySaveCabinet(): SaveCabinet {
  return { interrupt: null, voluntary: [] };
}

/**
 * Reads a cabinet. Unreadable JSON is an empty cabinet.
 * @param raw - localStorage payload, or null.
 * @returns Interrupt slot and voluntary list.
 */
export function parseSaveCabinet(raw: string | null): SaveCabinet {
  if (!raw) return emptySaveCabinet();
  try {
    const parsed = JSON.parse(raw) as { interrupt?: unknown; voluntary?: unknown };
    if (!parsed || typeof parsed !== 'object') return emptySaveCabinet();
    const interrupt = acceptSavedGame(parsed.interrupt);
    const voluntary = Array.isArray(parsed.voluntary)
      ? parsed.voluntary
          .map((entry) => acceptSavedGame(entry))
          .filter((game): game is SavedGame => game !== null && game.kind === 'voluntary')
      : [];
    return {
      interrupt: interrupt?.kind === 'interrupt' ? interrupt : null,
      voluntary: voluntary.slice(-VOLUNTARY_SAVE_LIMIT),
    };
  } catch {
    return emptySaveCabinet();
  }
}

/**
 * Turns a payload into a fiche. An intact start position and a finished game are refused.
 * @param raw - Candidate save.
 * @returns The fiche, or null when it must not be stored.
 */
export function acceptSavedGame(raw: unknown): SavedGame | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const shellMode = parseMode(rec.shellMode);
  const kind = rec.kind === 'interrupt' || rec.kind === 'voluntary' ? rec.kind : null;
  if (!shellMode || !kind || typeof rec.fen !== 'string' || rec.fen.length === 0) return null;
  if (rec.flag === 'white' || rec.flag === 'black') return null;
  const whiteSeconds = finiteSeconds(rec.whiteSeconds);
  const blackSeconds = finiteSeconds(rec.blackSeconds);
  if (whiteSeconds === null || blackSeconds === null) return null;
  let match: ChessMatch;
  try {
    match = ChessMatch.fromFen(rec.fen);
  } catch {
    return null;
  }
  if (match.isEnd()) return null;
  const plyIndex = finiteIndex(rec.plyIndex);
  if (learnLineDone(shellMode, rec.eco, plyIndex)) return null;
  if (intactStart(rec.fen, whiteSeconds, blackSeconds, plyIndex)) return null;
  const id = typeof rec.id === 'string' && rec.id.length > 0 ? rec.id : `save-${shellMode}`;
  const savedAt = typeof rec.savedAt === 'number' && Number.isFinite(rec.savedAt) ? rec.savedAt : 0;
  const eco = typeof rec.eco === 'string' && rec.eco.length > 0 ? rec.eco : undefined;
  return {
    id,
    kind,
    savedAt,
    shellMode,
    fen: rec.fen,
    whiteSeconds,
    blackSeconds,
    localColor: rec.localColor === 'black' ? 'black' : 'white',
    ...(eco ? { eco } : {}),
    ...(plyIndex !== undefined ? { plyIndex } : {}),
  };
}

/**
 * Replaces the interruption and leaves the voluntary list as it is.
 * @param cabinet - Current cabinet.
 * @param game - Fiche to store as the interruption.
 */
export function putInterrupt(cabinet: SaveCabinet, game: SavedGame): SaveCabinet {
  return { interrupt: { ...game, kind: 'interrupt' }, voluntary: cabinet.voluntary };
}

/**
 * Appends a voluntary save. Past the cap, the oldest voluntary save leaves.
 * @param cabinet - Current cabinet.
 * @param game - Fiche to append.
 */
export function putVoluntary(cabinet: SaveCabinet, game: SavedGame): SaveCabinet {
  const voluntary = [...cabinet.voluntary, { ...game, kind: 'voluntary' as const }];
  return {
    interrupt: cabinet.interrupt,
    voluntary: voluntary.length > VOLUNTARY_SAVE_LIMIT ? voluntary.slice(voluntary.length - VOLUNTARY_SAVE_LIMIT) : voluntary,
  };
}

/** localStorage key for the interruption and the voluntary saves. */
export const SAVED_GAMES_KEY = 'w3dts-chess-saves';

/** Bus event carrying the cabinet after it is written. */
export const CHESS_SAVES_EVENT = 'w3dts-chess-saves';

/**
 * Clears the interruption and leaves the voluntary list as it is.
 * @param cabinet - Current cabinet.
 */
export function dropInterrupt(cabinet: SaveCabinet): SaveCabinet {
  return { interrupt: null, voluntary: cabinet.voluntary };
}

/**
 * Removes one voluntary save. The interruption stays.
 * @param cabinet - Current cabinet.
 * @param id - Fiche to remove.
 */
export function dropVoluntary(cabinet: SaveCabinet, id: string): SaveCabinet {
  return {
    interrupt: cabinet.interrupt,
    voluntary: cabinet.voluntary.filter((game) => game.id !== id),
  };
}

/**
 * Writes a live table into the interruption slot.
 * A finished game clears that slot. An intact start leaves the cabinet unchanged.
 * @param cabinet - Current cabinet.
 * @param raw - Candidate interruption.
 * @param finished - True when the table is mate, a flag, or a finished lesson.
 */
export function noteInterrupt(cabinet: SaveCabinet, raw: unknown, finished: boolean): SaveCabinet {
  const game = acceptSavedGame(raw);
  if (game) return putInterrupt(cabinet, game);
  if (finished) return dropInterrupt(cabinet);
  return cabinet;
}

function parseMode(value: unknown): SavedShellMode | null {
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
  return null;
}

function finiteSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function finiteIndex(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}

function learnLineDone(mode: SavedShellMode, eco: unknown, plyIndex: number | undefined): boolean {
  if (mode !== 'learn' || plyIndex === undefined || typeof eco !== 'string') return false;
  const opening = ECO_OPENINGS.find((item) => item.eco === eco);
  return Boolean(opening && plyIndex >= opening.sans.length);
}

function intactStart(fen: string, whiteSeconds: number, blackSeconds: number, plyIndex: number | undefined): boolean {
  return fen === ChessMatch.starting().fen() && whiteSeconds === CLOCK_START_S && blackSeconds === CLOCK_START_S && (plyIndex === undefined || plyIndex === 0);
}
