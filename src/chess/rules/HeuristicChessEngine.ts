/**
 * @file HeuristicChessEngine.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-27
 * @description Negamax material search over ChessMatch (CHESS-B1). Not Stockfish.
 */

import { ChessMatch } from './ChessMatch';
import type { ChessEngineMove, IChessEngine } from './IChessEngine';
import type { ChessPieceRole } from './chessTypes';

const MATERIAL: Record<ChessPieceRole, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
};

const MATE = 10_000;

export interface HeuristicChessEngineOptions {
  /** Full-move plies (1 = greedy capture, 2 = reply). */
  depth?: number;
  /** Delay so the human drop is visible before the reply. */
  thinkMs?: number;
}

function evaluateSideToMove(match: ChessMatch): number {
  if (match.isCheckmate()) return -MATE;
  if (match.isStalemate()) return 0;
  let white = 0;
  for (const piece of match.pieces()) {
    const v = MATERIAL[piece.role];
    white += piece.color === 'white' ? v : -v;
  }
  if (match.isCheck()) white += match.sideToMove() === 'white' ? -25 : 25;
  return match.sideToMove() === 'white' ? white : -white;
}

function negamax(
  match: ChessMatch,
  depth: number
): { score: number; move: ChessEngineMove | null } {
  const moves = match.legalMoves();
  if (depth <= 0 || moves.length === 0 || match.isEnd()) {
    return { score: evaluateSideToMove(match), move: null };
  }
  let bestScore = -Infinity;
  let bestMove: ChessEngineMove | null = moves[0] ?? null;
  const fen = match.fen();
  for (const move of moves) {
    const child = ChessMatch.fromFen(fen);
    if (!child.tryMove(move.from, move.to).ok) continue;
    const score = -negamax(child, depth - 1).score;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return { score: bestScore, move: bestMove };
}

/** In-process CPU: material + check, 2-ply by default. */
export class HeuristicChessEngine implements IChessEngine {
  private readonly depth: number;
  private readonly thinkMs: number;

  constructor(options: HeuristicChessEngineOptions = {}) {
    this.depth = Math.max(1, Math.floor(options.depth ?? 2));
    this.thinkMs = Math.max(0, options.thinkMs ?? 280);
  }

  public async chooseMove(fen: string): Promise<ChessEngineMove | null> {
    if (this.thinkMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.thinkMs);
      });
    }
    const match = ChessMatch.fromFen(fen);
    if (match.isEnd()) return null;
    return negamax(match, this.depth).move;
  }
}
