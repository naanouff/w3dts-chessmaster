/**
 * @file chessBoard.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description World ↔ algebraic square mapping for a centred 8×8 board (white at −Z).
 */

import { vec3 } from 'gl-matrix';
import type { ChessSquareName } from '../rules/chessTypes';

/** Square edge length in metres (full-size tournament-ish). */
export const CHESS_SQUARE_SIZE = 0.06;

/** 8×8 playing-surface extent in metres (not including the wooden frame). */
export const CHESS_BOARD_EXTENT = CHESS_SQUARE_SIZE * 8;

/**
 * Wooden frame on each edge of the board albedo, as a fraction of the cube UV.
 * Must match {@link fillBoardAlbedo}.
 */
export const CHESS_BOARD_BORDER_FRAC = 0.06;

/** Inner UV span occupied by the 8×8 checker (`1 - 2 * border`). */
export const CHESS_BOARD_INNER_FRAC = 1 - 2 * CHESS_BOARD_BORDER_FRAC;

/**
 * Visual cube XZ size including the frame. Playing squares stay {@link CHESS_BOARD_EXTENT}.
 */
export const CHESS_BOARD_MESH_EXTENT = CHESS_BOARD_EXTENT / CHESS_BOARD_INNER_FRAC;

/** Fine 45° chamfer on board edges and corners (metres). */
export const CHESS_BOARD_BEVEL_M = 0.002;

/** Slab thickness (metres). Visual cube centre sits at `-height/2`. */
export const CHESS_BOARD_BODY_HEIGHT = 0.024;

/** Y of the playing surface (piece origins sit on this plane, above the varnish quad). */
export const CHESS_BOARD_SURFACE_Y = 0.001;

const HALF_SQUARES = 3.5;
const FILES = 'abcdefgh';

function isSquareName(value: string): value is ChessSquareName {
  return /^[a-h][1-8]$/.test(value);
}

/**
 * World-space centre of a square. X = files (a −X … h +X), Z = ranks (1 −Z … 8 +Z).
 */
export function squareToWorld(square: ChessSquareName, y: number = CHESS_BOARD_SURFACE_Y): vec3 {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  const x = (file - HALF_SQUARES) * CHESS_SQUARE_SIZE;
  const z = (rank - HALF_SQUARES) * CHESS_SQUARE_SIZE;
  return vec3.fromValues(x, y, z);
}

/**
 * Nearest square for a world XZ, or `null` when outside the board (no snap).
 */
export function worldToSquare(x: number, z: number): ChessSquareName | null {
  const half = CHESS_BOARD_EXTENT / 2;
  if (x < -half || x >= half || z < -half || z >= half) return null;
  const file = Math.floor((x + half) / CHESS_SQUARE_SIZE);
  const rank = Math.floor((z + half) / CHESS_SQUARE_SIZE);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  const name = `${FILES[file]}${rank + 1}`;
  return isSquareName(name) ? name : null;
}

/**
 * Snap XZ onto a square centre, or `null` outside the board.
 */
export function snapWorldToSquareCenter(
  x: number,
  z: number,
  y: number = CHESS_BOARD_SURFACE_Y
): vec3 | null {
  const square = worldToSquare(x, z);
  if (!square) return null;
  return squareToWorld(square, y);
}
