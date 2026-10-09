/**
 * @file chessOrbitLimits.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Player orbit bounds: ±30° yaw/pitch, 30 cm–1 m zoom, fixed focus (no pan).
 */

import { vec3 } from 'gl-matrix';
import type { OrbitalCameraController } from '@naanouff/w3dts-core';
import type { ChessPieceRole } from '../../chess/rules/chessTypes';
import type { ChessReviewFrame } from './chessSetReview';

/** Closest orbit radius from the board focus, in metres. */
export const CHESS_ORBIT_MIN_M = 0.3;

/** Farthest orbit radius from the board focus, in metres. */
export const CHESS_ORBIT_MAX_M = 1;

/** Max yaw or pitch offset from the rest pose, in radians (30°). */
export const CHESS_ORBIT_ANGLE_LIMIT = Math.PI / 6;

/** Rest pose the player may orbit around after a game framing. */
export type ChessOrbitRest = {
  azimuth: number;
  polar: number;
  focus: readonly [number, number, number];
};

/**
 * Shortest signed delta from `rest` to `value`, in (−π, π].
 */
function shortestAngleDelta(value: number, rest: number): number {
  let delta = value - rest;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Clamps one spherical angle to ±limit around a rest value.
 * Yaw wraps through ±π so the white-side rest at π does not snap through 0 (lateral).
 * @param value - Current angle in radians.
 * @param rest - Rest angle in radians.
 * @param limit - Half-range in radians.
 */
export function clampChessOrbitAngle(value: number, rest: number, limit: number): number {
  const delta = Math.max(-limit, Math.min(limit, shortestAngleDelta(value, rest)));
  return rest + delta;
}

/**
 * Rest orbit from a game eye and look-at. Same spherical convention as the orbital controller.
 * @param eye - Camera position in metres.
 * @param look - Focus point in metres.
 */
export function chessOrbitRestFromEyeLook(
  eye: readonly [number, number, number],
  look: readonly [number, number, number]
): ChessOrbitRest {
  const dx = eye[0] - look[0];
  const dy = eye[1] - look[1];
  const dz = eye[2] - look[2];
  const radius = Math.hypot(dx, dy, dz) || 1;
  return {
    azimuth: Math.atan2(dx, dz),
    polar: Math.acos(Math.max(-1, Math.min(1, dy / radius))),
    focus: [look[0], look[1], look[2]],
  };
}

/**
 * True when the match (or game-frame review) should keep the tight orbit.
 * Arrival, wide frame, and piece close-ups stay free.
 */
export function chessOrbitLimitsActive(input: {
  arriving: boolean;
  piece: ChessPieceRole | null;
  frame: ChessReviewFrame;
}): boolean {
  if (input.arriving) return false;
  if (input.piece !== null) return false;
  return input.frame === 'game';
}

/**
 * Sets the zoom band on the orbit controller. Call after {@link OrbitalCameraController.frameBoundingBox},
 * which rewrites min/max from the framed box.
 */
export function configureChessOrbitDistances(orbit: OrbitalCameraController): void {
  orbit.minDistance = CHESS_ORBIT_MIN_M;
  orbit.maxDistance = CHESS_ORBIT_MAX_M;
}

/**
 * Keeps yaw, pitch, and focus inside the player orbit. Disables pan by pinning the focus.
 * Always re-applies angles after {@link OrbitalCameraController.setTarget}, which re-derives
 * yaw via atan2 and would otherwise lerp white-side π ↔ −π through a lateral view.
 * @param orbit - Active orbital controller.
 * @param rest - Rest pose from the last game framing.
 */
export function enforceChessOrbitLimits(orbit: OrbitalCameraController, rest: ChessOrbitRest): void {
  configureChessOrbitDistances(orbit);
  const azimuth = clampChessOrbitAngle(orbit.azimuth, rest.azimuth, CHESS_ORBIT_ANGLE_LIMIT);
  const polar = clampChessOrbitAngle(orbit.polar, rest.polar, CHESS_ORBIT_ANGLE_LIMIT);
  orbit.setTarget(vec3.fromValues(rest.focus[0], rest.focus[1], rest.focus[2]));
  orbit.setOrbitAngles(azimuth, polar, true);
}
