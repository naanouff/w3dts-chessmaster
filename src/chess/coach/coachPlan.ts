/**
 * @file coachPlan.ts
 * @description Bounded alpha-beta line for the coach. The heuristic opponent is unchanged.
 */

import { ChessMatch } from '../rules/ChessMatch';
import type { ChessColor, ChessPieceRole, ChessSquareName } from '../rules/chessTypes';

const MATERIAL: Record<ChessPieceRole, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
};

const MATE = 10_000;

const NODE_BUDGET: Record<number, number> = {
  1: 80,
  2: 2000,
  3: 8000,
  4: 20_000,
  5: 40_000,
};

export interface CoachGhostStep {
  san: string;
  from: ChessSquareName;
  to: ChessSquareName;
  role: ChessPieceRole;
  color: ChessColor;
}

export interface CoachVariation {
  sans: string[];
  steps: CoachGhostStep[];
  score: number;
}

export interface CoachReview {
  kind: 'mistake' | 'kept';
  gap: number;
  line: CoachVariation;
}

export function clampCoachHorizon(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(5, Math.max(1, Math.floor(raw)));
}

export function coachMaterial(match: ChessMatch): number {
  let white = 0;
  for (const piece of match.pieces()) {
    const value = MATERIAL[piece.role];
    white += piece.color === 'white' ? value : -value;
  }
  return white;
}

function evaluate(match: ChessMatch, depthLeft: number): number {
  if (match.isCheckmate()) {
    const mate = MATE + depthLeft;
    return match.sideToMove() === 'white' ? -mate : mate;
  }
  if (match.isStalemate() || match.isEnd()) return 0;
  let score = coachMaterial(match);
  if (match.isCheck()) score += match.sideToMove() === 'white' ? -25 : 25;
  return score;
}

function orderedMoves(match: ChessMatch): Array<{ from: ChessSquareName; to: ChessSquareName }> {
  const captures: Array<{ from: ChessSquareName; to: ChessSquareName }> = [];
  const quiet: Array<{ from: ChessSquareName; to: ChessSquareName }> = [];
  for (const move of match.legalMoves()) {
    if (match.pieceAt(move.to)) captures.push(move);
    else quiet.push(move);
  }
  return captures.concat(quiet);
}

function search(
  match: ChessMatch,
  depth: number,
  alpha: number,
  beta: number,
  budget: { left: number }
): CoachVariation {
  if (budget.left <= 0 || depth === 0 || match.isEnd()) {
    return { sans: [], steps: [], score: evaluate(match, depth) };
  }
  budget.left -= 1;
  const moves = orderedMoves(match);
  if (moves.length === 0) return { sans: [], steps: [], score: evaluate(match, depth) };
  const maximizing = match.sideToMove() === 'white';
  let bestScore = maximizing ? -Infinity : Infinity;
  let best: CoachVariation = { sans: [], steps: [], score: bestScore };
  for (const move of moves) {
    if (budget.left <= 0) break;
    const piece = match.pieceAt(move.from);
    if (!piece) continue;
    const next = ChessMatch.fromFen(match.fen());
    const result = next.tryMove(move.from, move.to);
    if (!result.ok) continue;
    const child = search(next, depth - 1, alpha, beta, budget);
    const step: CoachGhostStep = {
      san: result.san.replace(/[+#]$/, ''),
      from: move.from,
      to: result.to,
      role: piece.role,
      color: piece.color,
    };
    const score = child.score;
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      best = { sans: [step.san, ...child.sans], steps: [step, ...child.steps], score };
    }
    if (maximizing) alpha = Math.max(alpha, bestScore);
    else beta = Math.min(beta, bestScore);
    if (beta <= alpha) break;
  }
  return best;
}

export function planAhead(fen: string, horizon: number): CoachVariation | null {
  let root: ChessMatch;
  try {
    root = ChessMatch.fromFen(fen);
  } catch {
    return null;
  }
  if (root.isEnd()) return null;
  const depth = clampCoachHorizon(horizon);
  const found = search(root, depth, -Infinity, Infinity, { left: NODE_BUDGET[depth] ?? 80 });
  if (found.steps.length === 0) return null;
  return found;
}

function sideScore(score: number, side: ChessColor): number {
  return side === 'white' ? score : -score;
}

/** Compare the played SAN with the search. A gap of a pawn is a mistake. The move drawn on the board is kept. */
export function reviewPlayedMove(
  fen: string,
  playedSan: string,
  horizon: number,
  shown: readonly CoachGhostStep[] = []
): CoachReview | null {
  const depth = clampCoachHorizon(horizon);
  const best = planAhead(fen, depth);
  if (!best) return null;
  let root: ChessMatch;
  try {
    root = ChessMatch.fromFen(fen);
  } catch {
    return null;
  }
  const side = root.sideToMove();
  const played = root.moveFromSan(playedSan);
  if (!played) return null;
  const advice = shown.find((step) => step.color === side);
  const playedClean = playedSan.trim().replace(/[+#]$/, '');
  if (
    advice &&
    advice.from === played.from &&
    advice.to === played.to &&
    advice.san.replace(/[+#]$/, '') === playedClean
  ) {
    return { kind: 'kept', gap: 0, line: best };
  }
  const after = ChessMatch.fromFen(fen);
  const result = after.tryMove(played.from, played.to);
  if (!result.ok) return null;
  const follow = depth <= 1 ? null : planAhead(after.fen(), depth - 1);
  const playedScore = follow?.score ?? evaluate(after, 0);
  const gap = sideScore(best.score, side) - sideScore(playedScore, side);
  const same = playedClean === best.sans[0];
  return { kind: same || gap < 80 ? 'kept' : 'mistake', gap, line: best };
}
