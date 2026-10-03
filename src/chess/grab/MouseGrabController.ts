/**
 * @file MouseGrabController.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Kinematic fingertip grab with a CPU spring (solver-safe).
 */

import { mat4, quat, vec3 } from 'gl-matrix';
import type { Entity, World } from '@naanouff/w3dts-core';
import { TransformComponent } from '@naanouff/w3dts-core';
import { ColliderComponent, JointComponent, RigidBodyComponent } from '@naanouff/w3dts-physics';
import { CHESS_MASK_PIECE_GRABBED } from '../physics/chessGroups';
import { setChessPieceHeld, seatChessPieceUpright } from '../physics/piecePose';
import { CHESS_GRAB_DAMPING_RATIO, CHESS_GRAB_FREQUENCY_HZ, stepChessGrabSpring } from './grabMath';

const invRot = quat.create();
const localA = vec3.create();

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
 * Motion is kinematic: a dynamic zero-length DISTANCE weld ejected 40 g pieces.
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
    vec3.set(
      localA,
      worldHit[0]! - transform.position[0],
      worldHit[1]! - transform.position[1],
      worldHit[2]! - transform.position[2]
    );
    quat.invert(invRot, transform.rotation);
    vec3.transformQuat(localA, localA, invRot);
    bakeChessTransform(transform);
    world.addComponent(
      entity,
      new JointComponent({
        type: 'DISTANCE',
        connectedEntity: null,
        localAnchorA: [localA[0]!, localA[1]!, localA[2]!],
        localAnchorB: [worldHit[0]!, grabHeightY, worldHit[2]!],
        minDistance: 0,
        maxDistance: 0.04,
        frequency: CHESS_GRAB_FREQUENCY_HZ,
        dampingRatio: CHESS_GRAB_DAMPING_RATIO,
      })
    );
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
    const joint = world.getComponent(entity, JointComponent);
    if (joint) vec3.set(joint.localAnchorB, worldX, grabHeightY, worldZ);
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
    world.removeComponent(entity, JointComponent);
    const collider = world.getComponent(entity, ColliderComponent);
    const body = world.getComponent(entity, RigidBodyComponent);
    if (collider) collider.collisionMask = previousMask;
    if (body && collider) setChessPieceHeld(body, collider, false);
    this.state = null;
    return entity;
  }
}
