/**
 * @file grabMath.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Pure pointer / ray helpers for fingertip grab (no GPU).
 */

import { vec3 } from 'gl-matrix';

export const CHESS_GRAB_FREQUENCY_HZ = 8;
export const CHESS_GRAB_DAMPING_RATIO = 0.55;
export const CHESS_GRAB_LIFT_M = 0.025;

export interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts client coordinates to NDC (x,y in [-1,1], +Y up).
 * Points outside the rect are still converted (needed while dragging off-canvas).
 */
export function clientPointToNdc(
  clientX: number,
  clientY: number,
  rect: ClientRectLike
): { ndcX: number; ndcY: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  return { ndcX: u * 2 - 1, ndcY: 1 - v * 2 };
}

/**
 * Intersects a world ray with the plane y = planeY. Returns null if parallel or behind the origin.
 */
export function intersectRayHorizontalPlane(
  origin: readonly [number, number, number] | vec3,
  direction: readonly [number, number, number] | vec3,
  planeY: number
): vec3 | null {
  const dy = direction[1]!;
  if (Math.abs(dy) < 1e-8) return null;
  const t = (planeY - origin[1]!) / dy;
  if (t < 0) return null;
  return vec3.fromValues(origin[0]! + direction[0]! * t, planeY, origin[2]! + direction[2]! * t);
}

const SPRING_DT_MAX = 1 / 30;

/**
 * Semi-implicit Euler spring toward `target` (under-damped fingertip follow).
 * Mutates `pos` and `vel` in place.
 */
export function stepChessGrabSpring(
  pos: vec3,
  vel: vec3,
  target: readonly [number, number, number] | vec3,
  dt: number,
  frequencyHz: number = CHESS_GRAB_FREQUENCY_HZ,
  dampingRatio: number = CHESS_GRAB_DAMPING_RATIO
): void {
  const h = Math.max(0, Math.min(dt, SPRING_DT_MAX));
  if (h <= 0) return;
  const omega = 2 * Math.PI * Math.max(1e-3, frequencyHz);
  const damp = 2 * dampingRatio * omega;
  const stiff = omega * omega;
  for (let i = 0; i < 3; i++) {
    const acc = stiff * (target[i]! - pos[i]!) - damp * vel[i]!;
    vel[i]! += acc * h;
    pos[i]! += vel[i]! * h;
  }
}
