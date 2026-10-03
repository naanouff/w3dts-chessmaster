/**
 * @file pieceColliders.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Compound AABB recipes matching Staunton silhouettes.
 */

import type { ColliderShapeOptions } from '@naanouff/w3dts-physics';
import { CHESS_BOARD_MESH_EXTENT } from '../board/chessBoard';
import { CHESS_GROUP_PIECE, CHESS_MASK_PIECE } from '../physics/chessGroups';
import type { ChessPieceRole } from '../rules/chessTypes';

function aabb(
  hx: number,
  hy: number,
  hz: number,
  ox: number,
  oy: number,
  oz: number
): ColliderShapeOptions {
  return {
    type: 'AABB',
    size: [hx, hy, hz],
    offset: [ox, oy, oz],
    collisionGroup: CHESS_GROUP_PIECE,
    collisionMask: CHESS_MASK_PIECE,
  };
}

/** Compound OBB stack (base + stem + head). Offsets are shape centres in local space. */
export function stauntonPieceColliderShapes(role: ChessPieceRole): ColliderShapeOptions[] {
  switch (role) {
    case 'pawn':
      return [
        aabb(0.018, 0.006, 0.018, 0, 0.006, 0),
        aabb(0.009, 0.012, 0.009, 0, 0.024, 0),
        aabb(0.014, 0.012, 0.014, 0, 0.042, 0),
      ];
    case 'rook':
      return [
        aabb(0.019, 0.008, 0.019, 0, 0.008, 0),
        aabb(0.014, 0.018, 0.014, 0, 0.03, 0),
        aabb(0.017, 0.01, 0.017, 0, 0.052, 0),
      ];
    case 'knight':
      return [
        aabb(0.018, 0.008, 0.018, 0, 0.008, 0),
        aabb(0.012, 0.016, 0.012, 0, 0.028, 0),
        aabb(0.012, 0.014, 0.014, 0, 0.05, 0.002),
      ];
    case 'bishop':
      return [
        aabb(0.018, 0.007, 0.018, 0, 0.007, 0),
        aabb(0.01, 0.016, 0.01, 0, 0.028, 0),
        aabb(0.012, 0.016, 0.012, 0, 0.048, 0),
      ];
    case 'queen':
      return [
        aabb(0.02, 0.008, 0.02, 0, 0.008, 0),
        aabb(0.011, 0.02, 0.011, 0, 0.032, 0),
        aabb(0.014, 0.018, 0.014, 0, 0.06, 0),
      ];
    case 'king':
      return [
        aabb(0.021, 0.008, 0.021, 0, 0.008, 0),
        aabb(0.012, 0.022, 0.012, 0, 0.034, 0),
        aabb(0.015, 0.02, 0.015, 0, 0.068, 0),
      ];
    default:
      return [aabb(0.016, 0.02, 0.016, 0, 0.02, 0)];
  }
}

/**
 * Board slab in the rigid body's local space. Place the body at the visual cube
 * centre (`y = -halfY`) so the top face sits on the playing surface (world y = 0).
 */
export function boardColliderShape(halfY = 0.012): ColliderShapeOptions {
  const halfXz = CHESS_BOARD_MESH_EXTENT / 2;
  return {
    type: 'AABB',
    size: [halfXz, halfY, halfXz],
    offset: [0, 0, 0],
  };
}
