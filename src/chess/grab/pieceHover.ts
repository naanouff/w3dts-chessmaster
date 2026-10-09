/**
 * @file pieceHover.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Square the pointer would grab before the click.
 */

import type { ChessColor, ChessSquareName } from '../rules/chessTypes';
import type { ChessPlayMode } from '../play/parseChessDemoQuery';

/** Inputs that match the grab filter in the host. */
export interface PieceHoverInput {
  /** Square under the ray, or null when nothing was hit. */
  square: ChessSquareName | null;
  /** Colour of the piece on that square, or null when empty. */
  pieceColor: ChessColor | null;
  sideToMove: ChessColor;
  localColor: ChessColor;
  playMode: ChessPlayMode;
  gameOver: boolean;
  cpuBusy: boolean;
  motionBusy: boolean;
}

/**
 * Square of the piece a click would lift, or null when the grab would refuse.
 * @param input - Same filters as the host select-down path.
 * @returns Home square of that piece, or null.
 */
export function pieceHoverSquare(input: PieceHoverInput): ChessSquareName | null {
  if (input.gameOver || input.cpuBusy || input.motionBusy) return null;
  if (input.square === null || input.pieceColor === null) return null;
  if (input.pieceColor !== input.sideToMove) return null;
  if (input.playMode !== 'hotseat' && input.pieceColor !== input.localColor) return null;
  return input.square;
}
