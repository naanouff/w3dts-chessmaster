/**
 * @file cpuDrawOffer.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Whether the heuristic CPU accepts a draw offer (±50 centipawns).
 */

import { ChessMatch } from './ChessMatch';
import type { ChessPieceRole } from './chessTypes';

const MATERIAL: Record<ChessPieceRole, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
};

const DRAW_BAND = 50;

function whiteMaterialBalance(match: ChessMatch): number {
  let white = 0;
  for (const piece of match.pieces()) {
    const value = MATERIAL[piece.role];
    white += piece.color === 'white' ? value : -value;
  }
  return white;
}

function hasMateInOne(match: ChessMatch): boolean {
  const fen = match.fen();
  for (const move of match.legalMoves()) {
    const child = ChessMatch.fromFen(fen);
    if (!child.tryMove(move.from, move.to).ok) continue;
    if (child.isCheckmate()) return true;
  }
  return false;
}

/**
 * True when the CPU should accept a draw: material within ±50 centipawns,
 * the side to move is not in check, and the side to move has no mate in one.
 * @param fen - Position to judge.
 * @param depth - Reserved for a searched eval; unused while material decides.
 */
export function cpuAcceptsDrawOffer(fen: string, depth: number): boolean {
  void depth;
  const match = ChessMatch.fromFen(fen);
  if (match.isEnd()) return true;
  if (match.isCheck()) return false;
  if (hasMateInOne(match)) return false;
  return Math.abs(whiteMaterialBalance(match)) <= DRAW_BAND;
}
