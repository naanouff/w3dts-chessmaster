/**
 * @file gardenStage.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Hanging-garden layout: pergola, terracotta floor, and the evening sea sky.
 */

import type { ChessAmbianceId, ChessSetPlacement } from './chessAmbiance';
import { TERRACE_SKY_HOUR, TERRACE_SKY_STOPS, TERRACE_STAR_CUTOFF } from './terraceStage';

/** Footprint of the timber frame, metres. Four posts, open toward the camera. */
export const GARDEN_PERGOLA_WIDTH = 4;
export const GARDEN_PERGOLA_DEPTH = 3;
export const GARDEN_PERGOLA_HEIGHT = 2.6;

/**
 * Hour that parks the procedural sun low on +X, the right of the table.
 * The gradient stops carry the evening colours; the hour only places the disk.
 */
export const GARDEN_SKY_HOUR = 7.05;

/**
 * Disk radius in the sky shader. The graph default, 0.05, is about 18°.
 * 0.008 is about 7°, still a disk, no longer a blob.
 */
export const GARDEN_SUN_SIZE = 0.008;

/** Graph default, restored when the room is not the garden. */
export const STUDIO_SUN_SIZE = 0.05;

/** Noon studio sky shared by the three playable rooms. */
export const STUDIO_SKY_HOUR = 12;

const TIMBER: readonly [number, number, number] = [0.42, 0.28, 0.14];

/** One cube of the procedural pergola. */
export interface GardenBuiltPiece {
  name: 'post' | 'beam' | 'rafter';
  /** Centre, metres above the floor. */
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  color: readonly [number, number, number];
  roughness: number;
  metal: number;
  shadow: boolean;
}

/**
 * Timber frame. No leaves, no sea band, no GLB.
 * Posts span 4 m across and 3 m deep, and rise 2.6 m.
 * @returns Cubes in spawn order.
 */
export function gardenPergolaPieces(): readonly GardenBuiltPiece[] {
  const height = GARDEN_PERGOLA_HEIGHT;
  const halfW = GARDEN_PERGOLA_WIDTH / 2;
  const halfD = GARDEN_PERGOLA_DEPTH / 2;
  const centerZ = 0.6;
  const frontZ = centerZ - halfD;
  const backZ = centerZ + halfD;
  const post = 0.12;
  const beam = 0.12;
  const beamY = height - beam / 2;
  const timber = { color: TIMBER, roughness: 0.72, metal: 0, shadow: true as const };
  const posts: GardenBuiltPiece[] = (
    [
      [-halfW, frontZ],
      [halfW, frontZ],
      [-halfW, backZ],
      [halfW, backZ],
    ] as const
  ).map(([x, z]) => ({
    name: 'post' as const,
    position: [x, height / 2, z] as const,
    scale: [post, height, post] as const,
    ...timber,
  }));
  const beams: GardenBuiltPiece[] = [
    {
      name: 'beam',
      position: [0, beamY, frontZ],
      scale: [GARDEN_PERGOLA_WIDTH + post, beam, 0.1],
      ...timber,
    },
    {
      name: 'beam',
      position: [0, beamY, backZ],
      scale: [GARDEN_PERGOLA_WIDTH + post, beam, 0.1],
      ...timber,
    },
    {
      name: 'beam',
      position: [-halfW, beamY, centerZ],
      scale: [0.1, beam, GARDEN_PERGOLA_DEPTH + post],
      ...timber,
    },
    {
      name: 'beam',
      position: [halfW, beamY, centerZ],
      scale: [0.1, beam, GARDEN_PERGOLA_DEPTH + post],
      ...timber,
    },
  ];
  const rafters: GardenBuiltPiece[] = [];
  for (let i = -2; i <= 2; i++) {
    rafters.push({
      name: 'rafter',
      position: [i * 0.8, height + 0.025, centerZ],
      scale: [0.07, 0.05, GARDEN_PERGOLA_DEPTH + 0.24],
      ...timber,
    });
  }
  return [...posts, ...beams, ...rafters];
}

/**
 * Shadow fit for the terrace. The board box would leave the tiles and the posts outside the sun.
 * @returns World AABB in metres.
 */
export function gardenShadowBox(): {
  min: [number, number, number];
  max: [number, number, number];
} {
  return { min: [-2.4, -1.2, -2.4], max: [2.4, 2.8, 4.4] };
}

const TILE = 0.3;

/** 30 cm tiles across the terrace the wide camera sees. They do not cast. */
function gardenTiles(): ChessSetPlacement[] {
  const tiles: ChessSetPlacement[] = [];
  for (let ix = -8; ix <= 7; ix++) {
    for (let iz = -8; iz <= 13; iz++) {
      tiles.push({
        file: 'dalle',
        anchor: 'floor',
        x: (ix + 0.5) * TILE,
        z: (iz + 0.5) * TILE,
        lift: 0.008,
        cast: false,
      });
    }
  }
  return tiles;
}

/**
 * Props of the hanging garden, in spawn order.
 * The pergola is not a file: {@link gardenPergolaPieces} builds it.
 * @returns Placements. Glycine hangs from the beams.
 */
export function gardenStagePlacements(): ChessSetPlacement[] {
  const hang = 1.66;
  return [
    { file: 'table', anchor: 'top' },
    { file: 'coupe', anchor: 'surface', x: -0.58, z: 0.04 },
    { file: 'coupe', anchor: 'surface', x: 0.58, z: 0.04 },
    { file: 'banc', anchor: 'floor', x: 0, z: 3.05, yaw: Math.PI },
    { file: 'arrosoir', anchor: 'floor', x: -1.15, z: 3.05 },
    ...gardenTiles(),
    { file: 'glycine', anchor: 'floor', x: -1.4, z: -0.85, lift: hang },
    { file: 'glycine', anchor: 'floor', x: -0.45, z: -0.85, lift: hang },
    { file: 'glycine', anchor: 'floor', x: 0.5, z: -0.85, lift: hang },
    { file: 'glycine', anchor: 'floor', x: 1.4, z: -0.85, lift: hang },
    { file: 'glycine', anchor: 'floor', x: -1.7, z: 0.35, lift: hang },
    { file: 'glycine', anchor: 'floor', x: 1.7, z: 0.35, lift: hang },
  ];
}

/** One sky pass the room can retint. The engine reads these fields every frame. */
export interface RoomSkyPass {
  name: string;
  skyboxParams?: {
    timeOfDay?: number;
    sunSize?: number;
    starsThreshold?: number;
    gradientStops?: { offset: number; color: [number, number, number] }[];
  };
}

const GARDEN_STOPS: readonly { offset: number; color: readonly [number, number, number] }[] = [
  { offset: 0, color: [0.35, 0.22, 0.12] },
  { offset: 0.42, color: [1, 0.78, 0.52] },
  { offset: 0.58, color: [0.72, 0.78, 0.9] },
  { offset: 1, color: [0.42, 0.58, 0.88] },
];

const STUDIO_STOPS: readonly { offset: number; color: readonly [number, number, number] }[] = [
  { offset: 0, color: [0.62, 0.62, 0.64] },
  { offset: 0.5, color: [0.82, 0.82, 0.84] },
  { offset: 1, color: [0.9, 0.9, 0.92] },
];

/** Noon sky. Stars stay rare, as in the graph. */
const STUDIO_STARS = 0.995;

/**
 * Evening sea for the garden, blue hour for the terrace, noon studio otherwise.
 * @param passes - Render-graph passes. Missing sky is a no-op.
 * @param id - Room on screen.
 */
export function applyRoomSky(passes: readonly RoomSkyPass[] | undefined, id: ChessAmbianceId): void {
  if (!passes) return;
  const sky = passes.find((pass) => pass.name === '03_Skybox');
  if (!sky?.skyboxParams) return;
  const chosen =
    id === 'jardin'
      ? { hour: GARDEN_SKY_HOUR, stops: GARDEN_STOPS, stars: STUDIO_STARS, sunSize: GARDEN_SUN_SIZE }
      : id === 'terrasse'
        ? { hour: TERRACE_SKY_HOUR, stops: TERRACE_SKY_STOPS, stars: TERRACE_STAR_CUTOFF, sunSize: STUDIO_SUN_SIZE }
        : { hour: STUDIO_SKY_HOUR, stops: STUDIO_STOPS, stars: STUDIO_STARS, sunSize: STUDIO_SUN_SIZE };
  sky.skyboxParams.timeOfDay = chosen.hour;
  sky.skyboxParams.sunSize = chosen.sunSize;
  sky.skyboxParams.starsThreshold = chosen.stars;
  sky.skyboxParams.gradientStops = chosen.stops.map((stop) => ({
    offset: stop.offset,
    color: [stop.color[0], stop.color[1], stop.color[2]],
  }));
}

/** Height-fog density of the review. The graph default. The garden is a quarter of this. */
const REVIEW_FOG_DENSITY = 0.06;

/** One fog pass the room can thin. The engine reads the uniform every frame. */
export interface ReviewFogPass {
  name: string;
  uniforms?: { fogParams?: { value: number[] } };
}

/**
 * Sets the haze density for the room. The garden is open air, a quarter of the other rooms.
 * @param passes - Render-graph passes. A missing fog pass is a no-op.
 * @param id - Room on screen.
 */
export function applyReviewFog(passes: readonly ReviewFogPass[] | undefined, id: ChessAmbianceId): void {
  const fog = passes?.find((pass) => pass.name === '09_Fog');
  const value = fog?.uniforms?.fogParams?.value;
  if (!value) return;
  value[0] = id === 'jardin' ? REVIEW_FOG_DENSITY / 4 : REVIEW_FOG_DENSITY;
}
