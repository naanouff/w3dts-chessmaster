/**
 * @file grabMath.test.ts
 * @project w3dts
 * @description NDC mapping and ray–plane intersection for fingertip grab.
 */

import { describe, expect, it } from 'vitest';
import { mat4, vec3, vec4 } from 'gl-matrix';
import { TransformComponent, World } from '@naanouff/w3dts-core';
import { ColliderComponent, raycast } from '@naanouff/w3dts-physics';
import {
  CHESS_GROUP_PIECE,
  clientPointToNdc,
  intersectRayHorizontalPlane,
  pickRayFromViewProjection,
  stepChessGrabSpring,
  squareToWorld,
  stauntonPieceColliderShapes,
  viewProjectionLookAt,
} from '../src/chess/index';

describe('grab math', () => {
  it('maps the rect centre to NDC origin', () => {
    const ndc = clientPointToNdc(60, 40, { left: 10, top: 10, width: 100, height: 60 });
    expect(ndc).not.toBeNull();
    expect(ndc!.ndcX).toBeCloseTo(0);
    expect(ndc!.ndcY).toBeCloseTo(0);
  });

  it('rejects a zero-size rect', () => {
    expect(clientPointToNdc(0, 0, { left: 0, top: 0, width: 0, height: 10 })).toBeNull();
  });

  it('hits a horizontal plane in front of the ray', () => {
    const hit = intersectRayHorizontalPlane([0, 2, 0], [0, -1, 0], 0.05);
    expect(hit).not.toBeNull();
    expect(hit![1]).toBeCloseTo(0.05);
    expect(intersectRayHorizontalPlane([0, 0, 0], [1, 0, 0], 1)).toBeNull();
    expect(intersectRayHorizontalPlane([0, 0, 0], [0, 1, 0], -1)).toBeNull();
  });

  it('springs toward the target without snapping in one step', () => {
    const pos = vec3.fromValues(0, 0, 0);
    const vel = vec3.fromValues(0, 0, 0);
    stepChessGrabSpring(pos, vel, [0.1, 0.08, -0.05], 1 / 60);
    expect(pos[0]).toBeGreaterThan(0);
    expect(pos[0]).toBeLessThan(0.1);
    expect(pos[1]).toBeGreaterThan(0);
    expect(pos[1]).toBeLessThan(0.08);
    for (let i = 0; i < 90; i++) stepChessGrabSpring(pos, vel, [0.1, 0.08, -0.05], 1 / 60);
    expect(pos[0]).toBeCloseTo(0.1, 2);
    expect(pos[1]).toBeCloseTo(0.08, 2);
    expect(pos[2]).toBeCloseTo(-0.05, 2);
  });

  it('builds a pick ray from an identity VP looking down -Z', () => {
    const vp = mat4.create();
    const ray = pickRayFromViewProjection(vp, 0, 0);
    expect(ray).not.toBeNull();
    const len = Math.hypot(ray!.direction[0], ray!.direction[1], ray!.direction[2]);
    expect(len).toBeCloseTo(1);
    expect(Number.isFinite(ray!.origin[2])).toBe(true);
  });

  it('hits a pawn collider from the table camera through the piece NDC', () => {
    const world = new World();
    const entity = world.createEntity();
    const transform = new TransformComponent();
    const pos = squareToWorld('e2');
    vec3.copy(transform.position, pos);
    transform.updateLocalTransform();
    world.addComponent(entity, transform);
    world.addComponent(
      entity,
      new ColliderComponent({
        shapes: stauntonPieceColliderShapes('pawn'),
        collisionGroup: CHESS_GROUP_PIECE,
      })
    );

    const vp = viewProjectionLookAt(
      [0, 0.55, -0.72],
      [0, 0.02, 0],
      (38 * Math.PI) / 180,
      16 / 9,
      0.05,
      20
    );
    const clip = vec4.fromValues(pos[0]!, pos[1]! + 0.03, pos[2]!, 1);
    vec4.transformMat4(clip, clip, vp);
    expect(clip[3]).not.toBeCloseTo(0);
    const ndcX = clip[0]! / clip[3]!;
    const ndcY = clip[1]! / clip[3]!;
    const ray = pickRayFromViewProjection(vp, ndcX, ndcY);
    expect(ray).not.toBeNull();
    const hit = raycast(world, ray!.origin, ray!.direction, 8, {
      collisionMask: CHESS_GROUP_PIECE,
    });
    expect(hit?.entity).toBe(entity);
  });
});
