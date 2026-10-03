/**
 * @file bookMoveSpline.ts
 * @project w3dts
 * @description World polyline for the book-move hint (CHESS-B6b). GPU-less.
 */

import { CHESS_BOARD_SURFACE_Y, CHESS_SQUARE_SIZE, squareToWorld } from './chessBoard';
import type { ChessSquareName } from '../rules/chessTypes';

export type BookMoveSplinePoint = [number, number, number];

function fileIndex(square: ChessSquareName): number {
  return square.charCodeAt(0) - 97;
}

function rankIndex(square: ChessSquareName): number {
  return square.charCodeAt(1) - 49;
}

function worldXZ(file: number, rank: number, y: number): BookMoveSplinePoint {
  return [(file - 3.5) * CHESS_SQUARE_SIZE, y, (rank - 3.5) * CHESS_SQUARE_SIZE];
}

/** Elbow of the knight L (after the two-step), in file/rank indices. */
export function knightElbowIndices(
  from: ChessSquareName,
  to: ChessSquareName
): { file: number; rank: number } {
  const f0 = fileIndex(from);
  const r0 = rankIndex(from);
  const df = fileIndex(to) - f0;
  const dr = rankIndex(to) - r0;
  if (Math.abs(df) === 2) return { file: f0 + df, rank: r0 };
  return { file: f0, rank: r0 + dr };
}

function lerp3(
  a: BookMoveSplinePoint,
  b: BookMoveSplinePoint,
  t: number,
  lift: number
): BookMoveSplinePoint {
  const s = Math.sin(Math.PI * t);
  return [a[0] + (b[0] - a[0]) * t, CHESS_BOARD_SURFACE_Y + lift * s, a[2] + (b[2] - a[2]) * t];
}

function sampleSegment(
  a: BookMoveSplinePoint,
  b: BookMoveSplinePoint,
  count: number,
  lift: number,
  skipFirst: boolean
): BookMoveSplinePoint[] {
  const out: BookMoveSplinePoint[] = [];
  const start = skipFirst ? 1 : 0;
  for (let i = start; i < count; i++) {
    out.push(lerp3(a, b, i / (count - 1), lift));
  }
  return out;
}

export interface SampleBookMoveSplineOptions {
  knight?: boolean;
  liftY?: number;
  samples?: number;
}

/**
 * Polyline `from → to` slightly above the varnish.
 * Knight: two-segment **L** (not the diagonal). Others: single lifted arc.
 */
export function sampleBookMoveSpline(
  from: ChessSquareName,
  to: ChessSquareName,
  options: SampleBookMoveSplineOptions = {}
): BookMoveSplinePoint[] {
  const lift = options.liftY ?? 0.028;
  const samples = Math.max(8, options.samples ?? 20);
  const a = squareToWorld(from, CHESS_BOARD_SURFACE_Y);
  const b = squareToWorld(to, CHESS_BOARD_SURFACE_Y);
  const start: BookMoveSplinePoint = [a[0]!, a[1]!, a[2]!];
  const end: BookMoveSplinePoint = [b[0]!, b[1]!, b[2]!];
  if (!options.knight) {
    const pts: BookMoveSplinePoint[] = [];
    for (let i = 0; i < samples; i++) {
      pts.push(lerp3(start, end, i / (samples - 1), lift));
    }
    return pts;
  }
  const elbow = knightElbowIndices(from, to);
  const mid = worldXZ(elbow.file, elbow.rank, CHESS_BOARD_SURFACE_Y);
  const half = Math.max(5, Math.ceil(samples / 2));
  return [
    ...sampleSegment(start, mid, half, lift * 0.75, false),
    ...sampleSegment(mid, end, half, lift * 0.75, true),
  ];
}

export function bookMoveSplineLength(points: readonly BookMoveSplinePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const q = points[i - 1]!;
    len += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  return len;
}
