/**
 * @file chessCameraArrival.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Fly-in from the room's opening frame to the game camera.
 */

import type { ChessAmbianceId } from './chessAmbiance';
import { CHESS_REVIEW_POSES } from './chessSetReview';

type Vec3 = readonly [number, number, number];

/** One room's opening move. `ease` is applied before the spline is sampled. */
export interface ChessCameraArrival {
  duration: number;
  ease: 'out' | 'inOut';
  eye: readonly Vec3[];
  look: readonly Vec3[];
}

const GAME_EYE = CHESS_REVIEW_POSES.game.eye;
const GAME_LOOK = CHESS_REVIEW_POSES.game.target;

const ARRIVALS: Record<ChessAmbianceId, ChessCameraArrival> = {
  atelier: {
    duration: 4.5,
    ease: 'out',
    eye: [[1.35, 0.72, -1.15], GAME_EYE],
    look: [[0, 0.04, 0.1], GAME_LOOK],
  },
  salon: {
    duration: 6,
    ease: 'inOut',
    eye: [
      [0.2, 0.7, 1.55],
      [0.9, 0.6, 0.4],
      GAME_EYE,
    ],
    look: [
      [0, 0.08, 0],
      [0, 0.05, 0],
      GAME_LOOK,
    ],
  },
  club: {
    duration: 2.8,
    ease: 'out',
    eye: [[-1.6, 0.35, -1.4], GAME_EYE],
    look: [[0, 0.05, 0.2], GAME_LOOK],
  },
  jardin: {
    duration: 5,
    ease: 'out',
    eye: [[0.35, 1.05, -2.2], GAME_EYE],
    look: [[0, 0.06, 0.35], GAME_LOOK],
  },
};

/**
 * Opening move for one room. The review does not play it.
 * @param id - Room id.
 * @returns Duration, ease, and the eye and look splines.
 */
export function chessCameraArrival(id: ChessAmbianceId): ChessCameraArrival {
  return ARRIVALS[id];
}

/**
 * Eye and look-at at a raw time in the move. 0 is the opening frame, 1 is the game camera.
 * @param id - Room id.
 * @param unit - Un-eased progress, from 0 to 1.
 * @returns Positions in metres.
 */
export function chessCameraArrivalPose(
  id: ChessAmbianceId,
  unit: number
): { eye: [number, number, number]; look: [number, number, number] } {
  const move = ARRIVALS[id];
  const t = ease(move.ease, clamp01(unit));
  if (t <= 0) return { eye: tuple(move.eye[0]), look: tuple(move.look[0]) };
  if (t >= 1) {
    return { eye: tuple(move.eye[move.eye.length - 1]), look: tuple(move.look[move.look.length - 1]) };
  }
  return { eye: catmull(move.eye, t), look: catmull(move.look, t) };
}

function tuple(point: Vec3 | undefined): [number, number, number] {
  return [point?.[0] ?? 0, point?.[1] ?? 0, point?.[2] ?? 0];
}

function clamp01(unit: number): number {
  if (unit <= 0) return 0;
  if (unit >= 1) return 1;
  return unit;
}

function ease(kind: ChessCameraArrival['ease'], t: number): number {
  if (kind === 'out') return 1 - (1 - t) ** 3;
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Uniform Catmull-Rom through every key, matching a non-closed spline. */
function catmull(points: readonly Vec3[], t: number): [number, number, number] {
  const count = points.length;
  const first = points[0] ?? [0, 0, 0];
  if (count < 2) return [first[0], first[1], first[2]];
  let span = (count - 1) * t;
  let index = Math.floor(span);
  let weight = span - index;
  if (weight === 0 && index === count - 1) {
    index = count - 2;
    weight = 1;
  }
  const at = (i: number): Vec3 => points[Math.min(count - 1, Math.max(0, i))] ?? first;
  const p0 = at(index === 0 ? index : index - 1);
  const p1 = at(index);
  const p2 = at(index > count - 2 ? count - 1 : index + 1);
  const p3 = at(index > count - 3 ? count - 1 : index + 2);
  const w2 = weight * weight;
  const w3 = w2 * weight;
  const axis = (k: 0 | 1 | 2): number => {
    const a = p0[k];
    const b = p1[k];
    const c = p2[k];
    const d = p3[k];
    return (
      0.5 *
      (2 * b +
        (-a + c) * weight +
        (2 * a - 5 * b + 4 * c - d) * w2 +
        (-a + 3 * b - 3 * c + d) * w3)
    );
  };
  return [axis(0), axis(1), axis(2)];
}
