/**
 * @file terraceStage.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Winter-terrace layout for the review: props and the moonlight sky.
 */

import type { ChessSetPlacement } from './chessAmbiance';

/**
 * Hour that puts the procedural sun below the horizon.
 * The gradient is the blue hour; the moon disk is what remains.
 */
export const TERRACE_SKY_HOUR = 20;

/** Above 1, the sky shader draws no stars. */
export const TERRACE_STAR_CUTOFF = 1.2;

/**
 * Direction of the moon disk in the procedural sky. The shader puts it opposite the sun.
 * @param hour - Same clock as the skybox `timeOfDay`.
 * @returns Unit vector. A camera looking along it sees the disk.
 */
export function skyMoonDirection(hour: number): [number, number, number] {
  const sunAngle = ((hour - 6) / 24) * Math.PI * 2;
  const x = Math.cos(sunAngle);
  const y = Math.sin(sunAngle);
  const z = 0.2;
  const length = Math.hypot(x, y, z) || 1;
  return [-x / length, -y / length, -z / length];
}

/** Moonlit blue, darker than the garden evening. Linear RGB. */
export const TERRACE_SKY_STOPS: readonly { offset: number; color: readonly [number, number, number] }[] = [
  { offset: 0, color: [0.04, 0.05, 0.09] },
  { offset: 0.42, color: [0.18, 0.24, 0.38] },
  { offset: 0.62, color: [0.1, 0.14, 0.26] },
  { offset: 1, color: [0.04, 0.06, 0.14] },
];

/**
 * Shadow fit for the doubled rail, set back from the table.
 * @returns World AABB in metres.
 */
export function terraceShadowBox(): {
  min: [number, number, number];
  max: [number, number, number];
} {
  return { min: [-3.2, -1.4, -1.2], max: [3.2, 1.6, 5.2] };
}

/** Long side of one slate slab, along Z. */
export const TERRACE_SLAB_Z = 0.6;
/**
 * Width left on X when Z is scaled to {@link TERRACE_SLAB_Z}.
 * The master span on X is 0.974 of the long side, about 58.4 cm.
 */
export const TERRACE_SLAB_X = 0.5845;

/** Slabs across the terrace the wide camera sees. They do not cast. */
function terraceSlabs(): ChessSetPlacement[] {
  const slabs: ChessSetPlacement[] = [];
  for (let ix = -5; ix <= 4; ix++) {
    for (let iz = -4; iz <= 8; iz++) {
      slabs.push({
        file: 'dalle',
        anchor: 'floor',
        x: (ix + 0.5) * TERRACE_SLAB_X,
        z: (iz + 0.5) * TERRACE_SLAB_Z,
        lift: 0.008,
        cast: false,
      });
    }
  }
  return slabs;
}

/**
 * Props of the winter terrace, in spawn order.
 * Bowls sit on the left of the board, one lantern on the right. The back rail is two bays of 2.4 m.
 * The U is open toward the camera and sits behind the table. The bench backrest is at
 * local −Z; yaw −π/2 turns that back against the right rail, in the far corner.
 * @returns Placements. No cypress and no backdrop.
 */
export function terraceStagePlacements(): ChessSetPlacement[] {
  return [
    { file: 'table', anchor: 'top' },
    { file: 'coupe', anchor: 'surface', x: -0.48, z: -0.1 },
    { file: 'coupe', anchor: 'surface', x: -0.48, z: 0.14 },
    { file: 'lanterne', anchor: 'surface', x: 0.48, z: -0.14 },
    { file: 'balustrade', anchor: 'floor', x: -1.2, z: 4.4 },
    { file: 'balustrade', anchor: 'floor', x: 1.2, z: 4.4 },
    { file: 'balustrade', anchor: 'floor', x: -2.51, z: 3.2, yaw: Math.PI / 2 },
    { file: 'balustrade', anchor: 'floor', x: 2.51, z: 3.2, yaw: -Math.PI / 2 },
    { file: 'banc', anchor: 'floor', x: 2.15, z: 3.3, yaw: -Math.PI / 2 },
    ...terraceSlabs(),
  ];
}
