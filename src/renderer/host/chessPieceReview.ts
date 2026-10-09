/**
 * @file chessPieceReview.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Isolates one piece in the room review, the way a room is isolated.
 */

import type { ChessColor, ChessPieceRole, ChessSquareName } from '../../chess/rules/chessTypes';
import { squareToWorld } from '../../chess/board/chessBoard';
import { stauntonPieceHeight } from '../../chess/geometry/stauntonPieces';

/** No piece selected: the review shows the whole set. */
export type ChessReviewPiece = ChessPieceRole | null;

/** Home square shown when that role is isolated. Black mirrors the white square. */
export const REVIEW_PIECE_SQUARE: Record<ChessColor, Record<ChessPieceRole, ChessSquareName>> = {
  white: {
    pawn: 'e2',
    rook: 'a1',
    knight: 'b1',
    bishop: 'c1',
    queen: 'd1',
    king: 'e1',
  },
  black: {
    pawn: 'e7',
    rook: 'a8',
    knight: 'b8',
    bishop: 'c8',
    queen: 'd8',
    king: 'e8',
  },
};

let piece: ChessReviewPiece = null;
let color: ChessColor = 'white';
const listeners = new Set<(piece: ChessReviewPiece) => void>();
const colorListeners = new Set<(color: ChessColor) => void>();

/**
 * Piece the review is framing. Null shows every piece.
 * @returns The selected role, or null.
 */
export function chessReviewPiece(): ChessReviewPiece {
  return piece;
}

/**
 * Isolates one role, or returns to the full set.
 * @param next - Piece to frame, or null for the set.
 */
export function setChessReviewPiece(next: ChessReviewPiece): void {
  piece = next;
  for (const listener of listeners) listener(piece);
}

/**
 * Subscribes to piece selection. Does not emit the current value.
 * @param listener - Called with the new role.
 * @returns Unsubscribe.
 */
export function subscribeChessReviewPiece(listener: (piece: ChessReviewPiece) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Colour framed by the piece buttons. The full set ignores it.
 * @returns `white` until the review bar picks black.
 */
export function chessReviewColor(): ChessColor {
  return color;
}

/**
 * Chooses which camp the isolated piece belongs to.
 * @param next - White or black.
 */
export function setChessReviewColor(next: ChessColor): void {
  color = next;
  for (const listener of colorListeners) listener(color);
}

/**
 * Subscribes to camp changes. Does not emit the current value.
 * @param listener - Called with the new colour.
 * @returns Unsubscribe.
 */
export function subscribeChessReviewColor(listener: (color: ChessColor) => void): () => void {
  colorListeners.add(listener);
  return () => {
    colorListeners.delete(listener);
  };
}

/**
 * True when this piece stays on screen for the current selection.
 * @param selected - Role being reviewed, or null for the set.
 * @param candidate - One spawned piece.
 * @returns Whether its mesh is drawn.
 */
export function reviewPieceVisible(
  selected: ChessReviewPiece,
  candidate: { color: ChessColor; role: ChessPieceRole; square: string },
  camp: ChessColor = 'white'
): boolean {
  if (selected === null) return true;
  return (
    candidate.color === camp &&
    candidate.role === selected &&
    candidate.square === REVIEW_PIECE_SQUARE[camp][selected]
  );
}

/**
 * Close camera for one piece, on that camp's side of its square.
 * @param boardY - Playing surface of the current room, in metres.
 * @param role - Piece being framed.
 * @param camp - White looks from −Z, black from +Z.
 * @returns Eye and look-at in metres.
 */
export function reviewPieceCamera(
  boardY: number,
  role: ChessPieceRole,
  camp: ChessColor = 'white'
): { eye: readonly [number, number, number]; target: readonly [number, number, number] } {
  const base = squareToWorld(REVIEW_PIECE_SQUARE[camp][role], boardY);
  const height = stauntonPieceHeight(role);
  const side = camp === 'white' ? -0.28 : 0.28;
  return {
    target: [base[0], boardY + height * 0.55, base[2]],
    eye: [base[0] + 0.02, boardY + height * 0.9, base[2] + side],
  };
}
