/**
 * @file piecePose.test.ts
 * @project w3dts
 * @description Idle pieces stay Y-up with locked tilt.
 */

import { describe, expect, it } from 'vitest';
import { TransformComponent } from '@naanouff/w3dts-core';
import { ColliderComponent, RigidBodyComponent } from '@naanouff/w3dts-physics';
import { quat } from 'gl-matrix';
import { lockChessPieceTilt, seatChessPieceUpright, setChessPieceHeld } from '../src/chess/physics/piecePose';

describe('chess piece pose', () => {
  it('clears rotation and inverse inertia when seating upright', () => {
    const t = new TransformComponent();
    quat.fromEuler(t.rotation, 25, 0, -18);
    const body = new RigidBodyComponent({ mass: 0.04 });
    body.angularVelocity[0] = 4;
    seatChessPieceUpright(t, body);
    expect(t.rotation[0]).toBeCloseTo(0);
    expect(t.rotation[3]).toBeCloseTo(1);
    expect(body.inverseInertiaTensor[0]).toBe(0);
    expect(body.inverseInertiaTensor[4]).toBe(0);
    expect(body.inverseInertiaTensor[8]).toBe(0);
    expect(body.angularVelocity[0]).toBe(0);
  });

  it('makes a held piece kinematic without gravity then seats it again', () => {
    const body = new RigidBodyComponent({ mass: 0.04, isKinematic: true });
    const collider = new ColliderComponent({ type: 'AABB', size: [0.02, 0.02, 0.02] });
    setChessPieceHeld(body, collider, true);
    expect(body.isKinematic).toBe(true);
    expect(body.useGravity).toBe(false);
    lockChessPieceTilt(body);
    setChessPieceHeld(body, collider, false);
    expect(body.isKinematic).toBe(true);
    expect(body.isSleeping).toBe(true);
  });
});
