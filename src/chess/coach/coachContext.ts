/**
 * @file coachContext.ts
 * @description Position snapshot the table publishes for the coach drawer.
 */

import type { ChessColor } from '../rules/chessTypes';

export const CHESS_COACH_CONTEXT_EVENT = 'w3dts-chess-coach-context';
export const CHESS_COACH_OBJECT_EVENT = 'w3dts-chess-coach-object';

export interface CoachTrainingView {
  held: boolean;
  localColor: ChessColor;
  lastUserSan: string | null;
  lastUserFen: string | null;
  /** Ten-minute clocks. Off while the student is studying. */
  clock: boolean;
}

export interface CoachContext {
  fen: string;
  history: string[];
  sideToMove: ChessColor;
  training: CoachTrainingView | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseChessCoachContext(raw: unknown): CoachContext | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.fen !== 'string' || raw.fen.length === 0) return null;
  if (raw.sideToMove !== 'white' && raw.sideToMove !== 'black') return null;
  const history = Array.isArray(raw.history)
    ? raw.history.filter((item): item is string => typeof item === 'string').slice(-24)
    : [];
  let training: CoachTrainingView | null = null;
  if (raw.training !== null && raw.training !== undefined) {
    if (!isRecord(raw.training)) return null;
    if (raw.training.localColor !== 'white' && raw.training.localColor !== 'black') return null;
    const last = raw.training.lastUserSan;
    const fen = raw.training.lastUserFen;
    training = {
      held: raw.training.held === true,
      localColor: raw.training.localColor,
      lastUserSan: typeof last === 'string' && last.length > 0 ? last : null,
      lastUserFen: typeof fen === 'string' && fen.length > 0 ? fen : null,
      clock: raw.training.clock === true,
    };
  }
  return { fen: raw.fen, history, sideToMove: raw.sideToMove, training };
}
