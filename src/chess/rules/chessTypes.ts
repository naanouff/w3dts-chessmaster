/**
 * @file chessTypes.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Shared chess square / piece types for rules and spawn.
 */

export type ChessFile = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type ChessRank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type ChessSquareName = `${ChessFile}${ChessRank}`;

export type ChessColor = 'white' | 'black';
export type ChessPieceRole = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export interface ChessPieceOnSquare {
  square: ChessSquareName;
  role: ChessPieceRole;
  color: ChessColor;
}

export type ChessMoveFailReason = 'illegal' | 'game-over' | 'invalid-square';

export interface ChessCastleDelta {
  rookFrom: ChessSquareName;
  rookTo: ChessSquareName;
}

export interface ChessMoveSuccess {
  ok: true;
  from: ChessSquareName;
  to: ChessSquareName;
  san: string;
  capturedSquare: ChessSquareName | null;
  castle: ChessCastleDelta | null;
  promotion: ChessPieceRole | null;
}

export interface ChessMoveFailure {
  ok: false;
  reason: ChessMoveFailReason;
}

export type ChessMoveResult = ChessMoveSuccess | ChessMoveFailure;
