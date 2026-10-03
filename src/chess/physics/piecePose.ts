/**
 * @file piecePose.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Keep chess pieces Y-up: origin is the base, which the solver treats as CoM.
 */

import { mat3, quat, vec3 } from 'gl-matrix';
import type { TransformComponent } from '@naanouff/w3dts-core';
import type { ColliderComponent, RigidBodyComponent } from '@naanouff/w3dts-physics';

/** Zero inverse inertia so contact torque cannot tip a piece (base origin ≠ geometric CoM). */
export function lockChessPieceTilt(body: RigidBodyComponent): void {
  mat3.set(body.inverseInertiaTensor, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  mat3.copy(body.inverseInertiaTensorWorld, body.inverseInertiaTensor);
  vec3.set(body.angularVelocity, 0, 0, 0);
  vec3.set(body.biasAngularVelocity, 0, 0, 0);
}

export function seatChessPieceUpright(
  transform: TransformComponent,
  body: RigidBodyComponent | null | undefined
): void {
  quat.identity(transform.rotation);
  transform.updateLocalTransform();
  if (body) lockChessPieceTilt(body);
}

/** Idle pieces stay kinematic so they cannot slide or tip on the board. */
export function setChessPieceHeld(
  body: RigidBodyComponent,
  collider: ColliderComponent,
  held: boolean
): void {
  body.isKinematic = true;
  body.useGravity = !held;
  vec3.set(body.velocity, 0, 0, 0);
  lockChessPieceTilt(body);
  if (held) {
    body.wakeUp();
  } else {
    body.updateInertia(collider);
    body.isSleeping = true;
  }
}
