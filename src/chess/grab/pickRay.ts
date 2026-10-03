/**
 * @file pickRay.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description World ray from NDC through a camera view-projection (no viewer dependency).
 */

import { mat4, quat, vec3, vec4 } from 'gl-matrix';

export interface ChessPickRay {
  origin: [number, number, number];
  direction: [number, number, number];
}

const invVp = mat4.create();
const clipNear = vec4.create();
const clipFar = vec4.create();
const worldNear = vec4.create();
const worldFar = vec4.create();
const lookView = mat4.create();
const lookProj = mat4.create();
const eyeTmp = vec3.create();
const rotTmp = quat.create();
const fwdTmp = vec3.create();
const targetTmp = vec3.create();
const UP = vec3.fromValues(0, 1, 0);

/**
 * Perspective view-projection looking from `eye` toward `target` (Y-up).
 * `aspect` must be the pick canvas width/height — not ECS `camera.aspect`.
 */
export function viewProjectionLookAt(
  eye: readonly [number, number, number] | vec3,
  target: readonly [number, number, number] | vec3,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
  out: mat4 = mat4.create()
): mat4 {
  const a = Number.isFinite(aspect) && aspect > 1e-6 ? aspect : 1;
  mat4.lookAt(lookView, eye, target, UP);
  mat4.perspective(lookProj, fovY, a, near, far);
  return mat4.multiply(out, lookProj, lookView);
}

/**
 * View-projection matching the camera system: eye at the world
 * translation, look along local −Z.
 */
export function viewProjectionFromWorldTransform(
  worldTransform: mat4,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
  out: mat4 = mat4.create()
): mat4 {
  mat4.getTranslation(eyeTmp, worldTransform);
  mat4.getRotation(rotTmp, worldTransform);
  vec3.set(fwdTmp, 0, 0, -1);
  vec3.transformQuat(fwdTmp, fwdTmp, rotTmp);
  vec3.add(targetTmp, eyeTmp, fwdTmp);
  return viewProjectionLookAt(eyeTmp, targetTmp, fovY, aspect, near, far, out);
}

/**
 * Builds a world-space ray from NDC through the inverse view-projection matrix.
 */
export function pickRayFromViewProjection(
  viewProjection: mat4,
  ndcX: number,
  ndcY: number
): ChessPickRay | null {
  if (!mat4.invert(invVp, viewProjection)) return null;
  vec4.set(clipNear, ndcX, ndcY, -1, 1);
  vec4.set(clipFar, ndcX, ndcY, 1, 1);
  vec4.transformMat4(worldNear, clipNear, invVp);
  vec4.transformMat4(worldFar, clipFar, invVp);
  if (Math.abs(worldNear[3]!) < 1e-8 || Math.abs(worldFar[3]!) < 1e-8) return null;
  const nx = worldNear[0]! / worldNear[3]!;
  const ny = worldNear[1]! / worldNear[3]!;
  const nz = worldNear[2]! / worldNear[3]!;
  const fx = worldFar[0]! / worldFar[3]!;
  const fy = worldFar[1]! / worldFar[3]!;
  const fz = worldFar[2]! / worldFar[3]!;
  const dir = vec3.fromValues(fx - nx, fy - ny, fz - nz);
  if (vec3.length(dir) < 1e-8) return null;
  vec3.normalize(dir, dir);
  return { origin: [nx, ny, nz], direction: [dir[0]!, dir[1]!, dir[2]!] };
}
