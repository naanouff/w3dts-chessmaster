/**
 * @file pieceTravel.ts
 * @project w3dts
 * @description Lifted XZ arc for programmatic piece motion (CHESS-B6c). GPU-less.
 */

import { CHESS_BOARD_SURFACE_Y, squareToWorld } from './chessBoard';
import type { ChessSquareName } from '../rules/chessTypes';

export function easeSmoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Default hop height (~pawn). */
export const CHESS_PIECE_TRAVEL_LIFT_Y = 0.042;

/** World position along a single lifted arc (all roles, including knight). */
export function samplePieceTravel(
  from: ChessSquareName,
  to: ChessSquareName,
  t: number,
  liftY: number = CHESS_PIECE_TRAVEL_LIFT_Y
): [number, number, number] {
  const a = squareToWorld(from, CHESS_BOARD_SURFACE_Y);
  const b = squareToWorld(to, CHESS_BOARD_SURFACE_Y);
  const u = easeSmoothstep(t);
  const s = Math.sin(Math.PI * u);
  return [
    a[0]! + (b[0]! - a[0]!) * u,
    CHESS_BOARD_SURFACE_Y + liftY * s,
    a[2]! + (b[2]! - a[2]!) * u,
  ];
}

export function samplePieceTravelWorld(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number
): [number, number, number] {
  const u = easeSmoothstep(t);
  const s = Math.sin(Math.PI * u);
  const lift = Math.max(0.012, Math.abs(to[1]! - from[1]!) + CHESS_PIECE_TRAVEL_LIFT_Y * 0.35);
  return [
    from[0] + (to[0] - from[0]) * u,
    from[1] + (to[1] - from[1]) * u + lift * s,
    from[2] + (to[2] - from[2]) * u,
  ];
}
