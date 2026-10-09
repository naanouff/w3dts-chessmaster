/**
 * @file parseChessDemoQuery.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-27
 * @description URL query for ChessDemoProject modes (CHESS-B1 / B2 / B3).
 */

import type { ChessColor } from '../rules/chessTypes';

export type ChessPlayMode = 'cpu' | 'hotseat' | 'p2p' | 'learn' | 'training';

export interface ChessDemoQuery {
  mode: ChessPlayMode;
  localColor: ChessColor;
  eco?: string;
  quiz: boolean;
  /** Heuristic depth for a CPU session. Absent means the project default. */
  cpuDepth?: number;
  /** Online table code. The relay uses it as the room id. */
  room?: string;
  /** Online seat. The host color wins. */
  seat?: 'host' | 'guest';
}

/**
 * Search depth for the heuristic opponent.
 * Levels above 3 stay at 3 so one move cannot freeze the frame.
 * @param level - Slider step, usually 1 through 5.
 * @returns Depth passed to `HeuristicChessEngine`.
 */
export function cpuSearchDepth(level: number): number {
  if (!Number.isFinite(level)) return 2;
  return Math.min(3, Math.max(1, Math.floor(level)));
}

export function parseChessDemoQuery(search: string): ChessDemoQuery {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const modeRaw = (q.get('chess') ?? 'cpu').toLowerCase();
  const mode: ChessPlayMode =
    modeRaw === 'hotseat' || modeRaw === 'local'
      ? 'hotseat'
      : modeRaw === 'p2p'
        ? 'p2p'
        : modeRaw === 'training'
          ? 'training'
          : modeRaw === 'learn' || modeRaw === 'eco' || modeRaw === 'train'
            ? 'learn'
            : 'cpu';
  const colorRaw = (q.get('chessColor') ?? 'white').toLowerCase();
  const localColor: ChessColor = colorRaw === 'black' ? 'black' : 'white';
  const ecoRaw = (q.get('chessEco') ?? q.get('eco') ?? '').trim();
  const quizRaw = (q.get('chessQuiz') ?? '').toLowerCase();
  return {
    mode,
    localColor,
    ...(ecoRaw ? { eco: ecoRaw } : {}),
    quiz: quizRaw === '1' || quizRaw === 'true' || quizRaw === 'yes',
  };
}

const CHESS_QUERY_KEYS = ['chess', 'chessColor', 'chessEco', 'eco', 'chessQuiz'] as const;

/** Object payload from the HUD picker (not a URL). */
export function parseChessDemoSession(raw: unknown): ChessDemoQuery | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const modeRaw = typeof rec.mode === 'string' ? rec.mode.toLowerCase() : '';
  const mode: ChessPlayMode | null =
    modeRaw === 'hotseat' || modeRaw === 'local'
      ? 'hotseat'
      : modeRaw === 'p2p'
        ? 'p2p'
        : modeRaw === 'training'
          ? 'training'
          : modeRaw === 'learn' || modeRaw === 'eco' || modeRaw === 'train'
            ? 'learn'
            : modeRaw === 'cpu'
              ? 'cpu'
              : null;
  if (!mode) return null;
  const colorRaw = typeof rec.localColor === 'string' ? rec.localColor.toLowerCase() : 'white';
  const localColor: ChessColor = colorRaw === 'black' ? 'black' : 'white';
  const ecoRaw = typeof rec.eco === 'string' ? rec.eco.trim() : '';
  const cpuDepth = typeof rec.cpuDepth === 'number' ? cpuSearchDepth(rec.cpuDepth) : undefined;
  const room = typeof rec.room === 'string' ? rec.room.trim() : '';
  const seat = rec.seat === 'host' || rec.seat === 'guest' ? rec.seat : undefined;
  return {
    mode,
    localColor,
    ...(ecoRaw ? { eco: ecoRaw } : {}),
    quiz: rec.quiz === true,
    ...(cpuDepth !== undefined ? { cpuDepth } : {}),
    ...(room ? { room } : {}),
    ...(seat ? { seat } : {}),
  };
}

/** Non-default query keys so `?project=` and other params stay intact. */
export function chessDemoQueryToParams(query: ChessDemoQuery): Record<string, string> {
  const out: Record<string, string> = {};
  if (query.mode !== 'cpu') out.chess = query.mode;
  if (query.localColor !== 'white') out.chessColor = query.localColor;
  if (query.mode === 'learn') {
    if (query.eco) out.chessEco = query.eco;
    if (query.quiz) out.chessQuiz = '1';
  }
  return out;
}

export function mergeChessDemoQueryIntoSearch(search: string, query: ChessDemoQuery): string {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of CHESS_QUERY_KEYS) q.delete(key);
  for (const [key, value] of Object.entries(chessDemoQueryToParams(query))) {
    q.set(key, value);
  }
  return q.toString();
}

export function replaceChessDemoQueryInLocation(query: ChessDemoQuery): void {
  if (typeof window === 'undefined') return;
  const merged = mergeChessDemoQueryIntoSearch(window.location.search, query);
  const qs = merged.length > 0 ? `?${merged}` : '';
  window.history.replaceState(null, '', `${window.location.pathname}${qs}${window.location.hash}`);
}

export function formatChessClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
