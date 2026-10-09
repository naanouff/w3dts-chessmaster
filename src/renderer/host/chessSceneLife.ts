/**
 * @file chessSceneLife.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Review-only hearth flicker, dust shafts and the cigar tip.
 */

import { chessSetPunctualLights, type ChessAmbianceId } from './chessAmbiance';

/** Hard cap on one emitter. The fountain demo uses tens of thousands. */
export const SCENE_LIFE_PARTICLE_CAP = 400;

/**
 * Rise, spread and size versus the catalog default of 1.
 * The procedural graph has no separate speed: this is the slower pace.
 */
export const SCENE_LIFE_INTENSITY = 0.5;

/**
 * Cigar smoke pace. Lower than the room columns: the same graph also scales size.
 */
export const CIGAR_SMOKE_INTENSITY = 0.2;

/** Hearth column pace. Short enough to die inside the surround instead of clearing the mantel. */
export const HEARTH_INTENSITY = 0.22;

/**
 * Hearth emitters, metres. The surround's near face is about 1.68;
 * 2.18 sits in the firebox so the mantel depth-tests in front of the quads.
 */
export const HEARTH_MOUTH_Z = 2.18;

/** Stick length in metres. The tip walks this and then starts again. */
export const CIGAR_LENGTH_M = 0.08;

/** Seconds for the tip to travel the stick once. */
export const CIGAR_PERIOD_S = 16;

/** Rooms that receive life. Jardin and terrasse stay as they are. */
export type SceneLifeRoom = 'salon' | 'atelier' | 'club';

export type SceneLifeGraphId = 'fire-realistic' | 'smoke-realistic';

/** `wisp` is the thin cigar curl. The others use the round puff. */
export type SceneLifeSprite = 'puff' | 'wisp';

/** One GPU emitter the review may spawn. Positions are metres. */
export interface SceneLifeEmitter {
  id: string;
  room: SceneLifeRoom;
  graphId: SceneLifeGraphId;
  palette: 'ember' | 'smoke';
  maxParticles: number;
  /** Passed to the graph. Below 1 rises, spreads and draws smaller than the demo. */
  intensity: number;
  /** Billboard texture. The cigar smoke is a wisp, not the round puff. */
  sprite: SceneLifeSprite;
  position: readonly [number, number, number];
  /**
   * Beam direction, applied to the emitter.
   * The procedural graph still rises on world Y, so dust is placed in the shaft, off the squares.
   */
  direction: readonly [number, number, number];
  /** Add the room floor to Y. Atelier lights are already in world space. */
  liftsWithFloor: boolean;
  /** The tip walks the stick. Smoke uses the same point. */
  followsCigar: boolean;
}

let lifeOn = true;
const lifeListeners = new Set<(on: boolean) => void>();

/**
 * Whether the review bar left Vie on. A match ignores this.
 * @returns True until the review switches it off.
 */
export function sceneLifeEnabled(): boolean {
  return lifeOn;
}

/**
 * Switches Vie. Listeners run only when the value changes.
 * @param on - Emitters may spawn in the review.
 */
export function setSceneLifeEnabled(on: boolean): void {
  if (lifeOn === on) return;
  lifeOn = on;
  for (const listener of lifeListeners) listener(lifeOn);
}

/**
 * Hears Vie. The host respawns; the bar redraws.
 * @param listener - Called with the new value.
 * @returns Stops the subscription.
 */
export function subscribeSceneLife(listener: (on: boolean) => void): () => void {
  lifeListeners.add(listener);
  return () => lifeListeners.delete(listener);
}

/** Ember and smoke share one point on the stick. Y is height above the floor. */
export interface CigarTip {
  along: number;
  ember: readonly [number, number, number];
  smoke: readonly [number, number, number];
}

const UP: readonly [number, number, number] = [0, 1, 0];

/** Bar top, metres above the floor. The stick lies on +X from here. */
const CIGAR_ABOVE_FLOOR = 1.12;
const CIGAR_X = 0.55;
const CIGAR_Z = 3.05;

/**
 * Multiplier on the hearth point. Stays inside 0.75..1.25 and is not a constant.
 * @param timeSeconds - Seconds since the review started.
 * @returns Scale applied to the authored intensity.
 */
export function hearthFlicker(timeSeconds: number): number {
  const wave =
    Math.sin(timeSeconds * 6.5) * 0.55 +
    Math.sin(timeSeconds * 11.3 + 1.2) * 0.3 +
    Math.sin(timeSeconds * 2.7 + 0.4) * 0.15;
  const unit = wave * 0.5 + 0.5;
  return 0.75 + unit * 0.5;
}

/**
 * Whether this window should spawn the review's emitters.
 * The review follows Vie. A match follows the preset, which keeps the emitters on.
 * @param review - This window is the room review.
 * @param vie - The review bar left Vie on.
 * @param graphicsLife - The active preset includes scene life.
 * @returns True when the room may spawn fire, dust and the cigar.
 */
export function sceneLifeWanted(review: boolean, vie: boolean, graphicsLife: boolean): boolean {
  return review ? vie : graphicsLife;
}

/**
 * Emitters for one room set. Off when the review or the preset says so.
 * @param review - This window is the room review, or a match whose preset asked for life.
 * @param life - The review bar left Vie on. A match passes true.
 * @returns Emitters for salon, atelier and club.
 */
export function sceneLifeEmitters(review: boolean, life: boolean): readonly SceneLifeEmitter[] {
  if (!review || !life) return [];
  const atelier = chessSetPunctualLights('atelier');
  const hearth = chessSetPunctualLights('salon').find((light) => light.kind === 'point' && light.fromFloor !== null);
  const hearthY = hearth?.fromFloor ?? 0.42;
  const hearthPos: readonly [number, number, number] = [hearth?.position[0] ?? 0, hearthY, HEARTH_MOUTH_Z];
  return [
    emitter('hearth-fire', 'salon', 'fire-realistic', 'ember', 320, hearthPos, UP, true, false, HEARTH_INTENSITY),
    emitter('hearth-smoke', 'salon', 'smoke-realistic', 'smoke', 140, hearthPos, UP, true, false, HEARTH_INTENSITY),
    shaft('softbox-dust', atelier[0]),
    shaft('projector-dust', atelier[1]),
    emitter('cigar-ember', 'club', 'fire-realistic', 'ember', 48, cigarTip(0).ember, UP, true, true),
    emitter(
      'cigar-smoke',
      'club',
      'smoke-realistic',
      'smoke',
      80,
      cigarTip(0).smoke,
      UP,
      true,
      true,
      CIGAR_SMOKE_INTENSITY,
      'wisp'
    ),
  ];
}

/**
 * Tip of the club cigar. Smoke sits on the same point. The walk loops.
 * @param timeSeconds - Seconds since the review started.
 * @returns Distance along the stick and the shared position above the floor.
 */
export function cigarTip(timeSeconds: number): CigarTip {
  const period = CIGAR_PERIOD_S;
  const wrapped = ((timeSeconds % period) + period) % period;
  const along = (wrapped / period) * CIGAR_LENGTH_M;
  const point: readonly [number, number, number] = [CIGAR_X + along, CIGAR_ABOVE_FLOOR, CIGAR_Z];
  return { along, ember: point, smoke: point };
}

/**
 * Emitters of the room on screen.
 * @param review - This window is the room review.
 * @param life - The review bar left Vie on.
 * @param room - Room currently staged.
 * @returns That room's emitters, or none.
 */
export function sceneLifeForRoom(
  review: boolean,
  life: boolean,
  room: ChessAmbianceId
): readonly SceneLifeEmitter[] {
  return sceneLifeEmitters(review, life).filter((item) => item.room === room);
}

function shaft(
  id: string,
  light: { position: readonly [number, number, number]; target: readonly [number, number, number] } | undefined
): SceneLifeEmitter {
  const from = light?.position ?? ([0, 1, 0] as const);
  const to = light?.target ?? ([0, 0, 0] as const);
  const direction = unit(from, to);
  const position: readonly [number, number, number] = [
    from[0] + direction[0] * 0.35,
    from[1] + direction[1] * 0.35,
    from[2] + direction[2] * 0.35,
  ];
  return emitter(id, 'atelier', 'smoke-realistic', 'smoke', 180, position, direction, false, false);
}

function emitter(
  id: string,
  room: SceneLifeRoom,
  graphId: SceneLifeGraphId,
  palette: 'ember' | 'smoke',
  maxParticles: number,
  position: readonly [number, number, number],
  direction: readonly [number, number, number],
  liftsWithFloor: boolean,
  followsCigar: boolean,
  intensity: number = SCENE_LIFE_INTENSITY,
  sprite: SceneLifeSprite = 'puff'
): SceneLifeEmitter {
  return {
    id,
    room,
    graphId,
    palette,
    maxParticles,
    intensity,
    sprite,
    position,
    direction,
    liftsWithFloor,
    followsCigar,
  };
}

function unit(
  from: readonly [number, number, number],
  to: readonly [number, number, number]
): readonly [number, number, number] {
  const x = to[0] - from[0];
  const y = to[1] - from[1];
  const z = to[2] - from[2];
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}
