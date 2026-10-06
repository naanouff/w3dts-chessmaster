/**
 * @file mouseGrab.test.ts
 * @project w3dts
 * @description Kinematic fingertip grab: spring follow and solver-stable hold.
 */

import { describe, expect, it } from 'vitest';
import { TransformComponent, World } from '@naanouff/w3dts-core';
import {
  ColliderComponent,
  JointComponent,
  RigidBodyComponent,
  createPhysicsSystem,
} from '@naanouff/w3dts-physics';
import { CHESS_MASK_PIECE, CHESS_MASK_PIECE_GRABBED, MouseGrabController } from '../src/chess/index';

describe('MouseGrabController', () => {
  it('follows the cursor with a spring and does not attach a physics joint', () => {
    const world = new World();
    const entity = world.createEntity();
    const t = new TransformComponent();
    t.position[1] = 0.05;
    world.addComponent(entity, t);
    world.addComponent(entity, new RigidBodyComponent({ mass: 0.05, isKinematic: true }));
    world.addComponent(
      entity,
      new ColliderComponent({ type: 'AABB', size: [0.02, 0.02, 0.02], collisionMask: CHESS_MASK_PIECE })
    );

    const grab = new MouseGrabController();
    expect(grab.begin(world, entity, [0, 0.05, 0], 0.08)).toBe(true);
    expect(world.getComponent(entity, RigidBodyComponent)?.isKinematic).toBe(true);
    expect(t.position[1]).toBeCloseTo(0.05);
    expect(world.getComponent(entity, JointComponent)).toBeUndefined();
    expect(world.getComponent(entity, ColliderComponent)?.collisionMask).toBe(CHESS_MASK_PIECE_GRABBED);

    grab.updateWorldAnchor(world, 0.1, -0.05, 1 / 60);
    expect(world.getComponent(entity, JointComponent)).toBeUndefined();
    expect(t.position[0]).toBeGreaterThan(0);
    expect(t.position[0]).toBeLessThan(0.1);
    expect(t.position[1]).toBeGreaterThan(0.05);
    expect(t.position[1]).toBeLessThan(0.08);

    expect(grab.dropXZ()?.[0]).toBeCloseTo(0.1);
    expect(grab.end(world)).toBe(entity);
    expect(t.position[0]).toBeCloseTo(0.1);
    expect(t.position[2]).toBeCloseTo(-0.05);
    expect(world.getComponent(entity, JointComponent)).toBeUndefined();
    expect(world.getComponent(entity, ColliderComponent)?.collisionMask).toBe(CHESS_MASK_PIECE);
    expect(world.getComponent(entity, RigidBodyComponent)?.isKinematic).toBe(true);
  });

  it('does not eject a held piece when the physics solver steps', () => {
    const world = new World();
    const system = createPhysicsSystem({ gravity: [0, -9.81, 0], skinWidth: 0.002 });

    const board = world.createEntity();
    const boardT = new TransformComponent();
    boardT.position[1] = -0.012;
    world.addComponent(board, boardT);
    world.addComponent(board, new RigidBodyComponent({ isKinematic: true }));
    world.addComponent(board, new ColliderComponent({ type: 'AABB', size: [0.3, 0.012, 0.3] }));

    const entity = world.createEntity();
    const t = new TransformComponent();
    world.addComponent(entity, t);
    world.addComponent(entity, new RigidBodyComponent({ mass: 0.04, isKinematic: true }));
    world.addComponent(
      entity,
      new ColliderComponent({
        type: 'AABB',
        size: [0.018, 0.02, 0.018],
        collisionMask: CHESS_MASK_PIECE,
      })
    );

    const grab = new MouseGrabController();
    expect(grab.begin(world, entity, [0, 0.02, 0], 0.065)).toBe(true);
    for (let i = 0; i < 30; i++) {
      system(world, 1 / 60, i / 60);
      grab.updateWorldAnchor(world, 0.03, -0.04, 1 / 60);
    }
    expect(Number.isFinite(t.position[0])).toBe(true);
    expect(Number.isFinite(t.position[1])).toBe(true);
    expect(t.position[1]).toBeGreaterThan(0.02);
    expect(t.position[1]).toBeLessThan(0.12);
    expect(Math.abs(t.position[0])).toBeLessThan(0.2);
    expect(Math.abs(t.position[2])).toBeLessThan(0.2);
  });
});
