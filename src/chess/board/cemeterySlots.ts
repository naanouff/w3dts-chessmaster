/**
 * @file cemeterySlots.ts
 * @project w3dts
 * @description Off-board racks for captured pieces (CHESS-B6c). GPU-less.
 */

import {
  CHESS_BOARD_EXTENT,
  CHESS_BOARD_MESH_EXTENT,
  CHESS_BOARD_SURFACE_Y,
  CHESS_SQUARE_SIZE,
  worldToSquare,
} from './chessBoard';
import type { ChessColor } from '../rules/chessTypes';

/** Gap between the wooden frame and the first captured piece. */
const RAIL_GAP = CHESS_SQUARE_SIZE * 0.7;
const SLOT_PITCH = CHESS_SQUARE_SIZE * 0.52;

export interface CemeterySlotPose {
  x: number;
  y: number;
  z: number;
}

/**
 * Two rails along ±X, outside {@link CHESS_BOARD_MESH_EXTENT}.
 * White pieces captured (removed from White) sit on −X; black on +X.
 * Slots fill toward +Z in capture order.
 */
export function assignCemeterySlot(capturedColor: ChessColor, slotIndex: number): CemeterySlotPose {
  const meshHalf = CHESS_BOARD_MESH_EXTENT / 2;
  const xSign = capturedColor === 'white' ? -1 : 1;
  const x = xSign * (meshHalf + RAIL_GAP);
  const z0 = -CHESS_BOARD_EXTENT / 2 + CHESS_SQUARE_SIZE * 0.15;
  return {
    x,
    y: CHESS_BOARD_SURFACE_Y,
    z: z0 + slotIndex * SLOT_PITCH,
  };
}

export function cemeterySlotIsOffBoard(pose: CemeterySlotPose): boolean {
  return worldToSquare(pose.x, pose.z) === null;
}
