/**
 * @file chessGameCamera.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Game camera poses mirrored on Z for the local player's color.
 */

import type { ChessColor } from '../../chess/rules/chessTypes';
import { CHESS_REVIEW_POSES, type ChessReviewFrame } from './chessSetReview';

export type ChessCameraPose = {
  eye: [number, number, number];
  target: [number, number, number];
};

/**
 * Eye and look-at for a review frame, from the local player's side of the board.
 * The board stays algebraic (white −Z). Black mirrors Z so their pieces sit in front.
 * @param frame - Game or wide authoring frame.
 * @param localColor - Side the local client plays.
 */
export function chessGameCameraPose(frame: ChessReviewFrame, localColor: ChessColor): ChessCameraPose {
  const base = CHESS_REVIEW_POSES[frame];
  const eye: [number, number, number] = [base.eye[0], base.eye[1], base.eye[2]];
  const target: [number, number, number] = [base.target[0], base.target[1], base.target[2]];
  if (localColor === 'black') {
    eye[2] = -eye[2];
    target[2] = -target[2];
  }
  return { eye, target };
}

/**
 * Mirrors a world point on Z when the local player is black.
 * @param point - Eye or look-at in metres.
 * @param localColor - Side the local client plays.
 */
export function mirrorCameraPointZ(
  point: readonly [number, number, number],
  localColor: ChessColor
): [number, number, number] {
  if (localColor === 'white') return [point[0], point[1], point[2]];
  return [point[0], point[1], -point[2]];
}
