/**
 * @file MouseGrabController.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Kinematic fingertip grab with a CPU spring. No physics joint.
 */

import { mat4, vec3 } from 'gl-matrix';
import type { Entity, World } from '@naanouff/w3dts-core';
import { TransformComponent } from '@naanouff/w3dts-core';
import { ColliderComponent, RigidBodyComponent } from '@naanouff/w3dts-physics';
import { CHESS_MASK_PIECE_GRABBED } from '../physics/chessGroups';
import { setChessPieceHeld, seatChessPieceUpright } from '../physics/piecePose';
import { stepChessGrabSpring } from './grabMath';

export interface ChessGrabState {
  entity: Entity;
  previousMask: number;
  grabHeightY: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  velX: number;
  velY: number;
  velZ: number;
}

function bakeChessTransform(transform: TransformComponent): void {
  transform.updateLocalTransform();
  mat4.copy(transform.worldTransform, transform.localTransform);
}

/**
 * Lifts a piece with a damped spring onto the grab plane and follows the cursor.
 * The pose is written on the transform. A physics joint is not used.
 */
export class MouseGrabController {
  private state: ChessGrabState | null = null;

  public get grabbed(): ChessGrabState | null {
    return this.state;
  }

  /** Cursor / drop target XZ on the grab plane (not the lagged piece pose). */
  public dropXZ(): [number, number] | null {
    if (!this.state) return null;
    return [this.state.targetX, this.state.targetZ];
  }

  public begin(
    world: World,
    entity: Entity,
    worldHit: vec3 | readonly [number, number, number],
    grabHeightY: number
  ): boolean {
    this.end(world);
    const transform = world.getComponent(entity, TransformComponent);
    const collider = world.getComponent(entity, ColliderComponent);
    const body = world.getComponent(entity, RigidBodyComponent);
    if (!transform || !collider || !body) return false;
    setChessPieceHeld(body, collider, true);
    seatChessPieceUpright(transform, body);
    bakeChessTransform(transform);
    const previousMask = collider.collisionMask;
    collider.collisionMask = CHESS_MASK_PIECE_GRABBED;
    this.state = {
      entity,
      previousMask,
      grabHeightY,
      targetX: worldHit[0]!,
      targetY: grabHeightY,
      targetZ: worldHit[2]!,
      velX: 0,
      velY: 0,
      velZ: 0,
    };
    return true;
  }

  public updateWorldAnchor(world: World, worldX: number, worldZ: number, dt: number): void {
    if (!this.state) return;
    const { entity, grabHeightY } = this.state;
    this.state.targetX = worldX;
    this.state.targetY = grabHeightY;
    this.state.targetZ = worldZ;
    const transform = world.getComponent(entity, TransformComponent);
    if (!transform) return;
    const vel = vec3.fromValues(this.state.velX, this.state.velY, this.state.velZ);
    stepChessGrabSpring(transform.position, vel, [worldX, grabHeightY, worldZ], dt);
    this.state.velX = vel[0]!;
    this.state.velY = vel[1]!;
    this.state.velZ = vel[2]!;
    bakeChessTransform(transform);
  }

  public end(world: World): Entity | null {
    if (!this.state) return null;
    const { entity, previousMask, targetX, targetY, targetZ } = this.state;
    const transform = world.getComponent(entity, TransformComponent);
    if (transform) {
      vec3.set(transform.position, targetX, targetY, targetZ);
      bakeChessTransform(transform);
    }
    const collider = world.getComponent(entity, ColliderComponent);
    const body = world.getComponent(entity, RigidBodyComponent);
    if (collider) collider.collisionMask = previousMask;
    if (body && collider) setChessPieceHeld(body, collider, false);
    this.state = null;
    return entity;
  }
}
