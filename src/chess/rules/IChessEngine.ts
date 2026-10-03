/**
 * @file IChessEngine.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-27
 * @description CPU opponent contract (CHESS-B1). Stockfish UCI remains a later adapter.
 */

import type { ChessPieceRole, ChessSquareName } from './chessTypes';

/** Suggested engine move. Promotion omitted — `ChessMatch.tryMove` auto-queens. */
export interface ChessEngineMove {
  from: ChessSquareName;
  to: ChessSquareName;
  promotion?: ChessPieceRole;
}

/** CPU opponent. `HeuristicChessEngine` is the in-process default. */
export interface IChessEngine {
  chooseMove(fen: string): Promise<ChessEngineMove | null>;
}
