/**
 * @file trainingReview.ts
 * @description Ply log, undo, and when the heuristic may answer in training.
 */

import type { ChessColor } from '../rules/chessTypes';
import type { ChessPlayMode } from '../play/parseChessDemoQuery';

export interface TrainingPly {
  fenBefore: string;
  san: string;
  color: ChessColor;
}

export interface TrainingUndo {
  log: TrainingPly[];
  fen: string;
  undoneSan: string;
  removedReplySan: string | null;
}

export function recordPly(log: readonly TrainingPly[], ply: TrainingPly): TrainingPly[] {
  return [...log, ply];
}

export function lastUserPly(log: readonly TrainingPly[], local: ChessColor): TrainingPly | null {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const ply = log[i];
    if (ply && ply.color === local) return ply;
  }
  return null;
}

export function canUndoMyMove(log: readonly TrainingPly[], local: ChessColor): boolean {
  return lastUserPly(log, local) !== null;
}

/**
 * Drop the student's last ply. If the computer already answered, drop that reply first.
 * The returned FEN is the position before the student's ply.
 */
export function undoMyMove(log: readonly TrainingPly[], local: ChessColor): TrainingUndo | null {
  const mine = lastUserPly(log, local);
  if (!mine) return null;
  const index = log.lastIndexOf(mine);
  const reply = log[index + 1];
  const removedReplySan = reply && reply.color !== local ? reply.san : null;
  const end = removedReplySan ? index + 2 : index + 1;
  return {
    log: log.slice(0, index).concat(log.slice(end)),
    fen: mine.fenBefore,
    undoneSan: mine.san,
    removedReplySan,
  };
}

export function shouldCpuReply(input: {
  mode: ChessPlayMode;
  held: boolean;
  busy: boolean;
  motion: boolean;
  gameOver: boolean;
  side: ChessColor;
  local: ChessColor;
}): boolean {
  if (input.mode !== 'cpu' && input.mode !== 'training') return false;
  if (input.mode === 'training' && input.held) return false;
  if (input.busy || input.motion || input.gameOver) return false;
  return input.side !== input.local;
}
