/**
 * @file chessAmbiance.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Stored room choice, and the props plus lights each room asks the host to load.
 */

import { CHESS_BOARD_BODY_HEIGHT } from '../../chess/board/chessBoard';
import { gardenStagePlacements } from './gardenStage';

/** `atelier`, `salon`, `club`, or the garden staged by the review. */
export type ChessAmbianceId = 'atelier' | 'salon' | 'club' | 'jardin';

/** localStorage key. Not the graphics blob and not the shell prefs. */
export const CHESS_AMBIANCE_KEY = 'w3dts-chess-ambiance';

/** Rooms offered in Options, Atelier first. The garden stays on the review bar. */
export const CHESS_AMBIANCES = ['atelier', 'salon', 'club'] as const;

/** Directional sun while the cloth plane is still the floor. */
const CLOTH_SUN_INTENSITY = 2.65;

export interface ChessAmbianceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ChessSetLook {
  id: ChessAmbianceId;
  /** Directional intensity once the set replaces the cloth. Same numbers as the review stage. */
  sun: number;
  /** Review-stage sun position in metres. Null when that stage leaves the sun off. */
  sunPos: readonly [number, number, number] | null;
  /** Linear RGB of the directional sun. The studio white when omitted. */
  sunColor?: readonly [number, number, number];
  /**
   * Environment fill, the engine stand-in for a hemisphere light. Keeps the corners
   * the punctual lights never reach off pure black.
   */
  ambient: number;
  thumb: string;
}

const LOOKS: Record<ChessAmbianceId, ChessSetLook> = {
  atelier: {
    id: 'atelier',
    sun: 0.36,
    sunPos: [1.6, 6.5, -0.4],
    ambient: 3.5,
    thumb: '/ambiances/atelier-kontrast.png',
  },
  salon: {
    id: 'salon',
    sun: 0.04,
    sunPos: [-1.2, 2.4, 0.4],
    ambient: 0.5,
    thumb: '/ambiances/salon-de-minuit.png',
  },
  club: {
    id: 'club',
    sun: 0,
    sunPos: null,
    ambient: 0.45,
    thumb: '/ambiances/club-neon.png',
  },
  jardin: {
    id: 'jardin',
    sun: 4.6,
    sunPos: [4.5, 0.85, -1.4],
    sunColor: [1, 0.48, 0.16],
    ambient: 0.75,
    thumb: '/ambiances/jardin-suspendu.jpg',
  },
};

/** Directional colour of the three playable rooms. */
export const CHESS_STUDIO_SUN_COLOR: readonly [number, number, number] = [1, 0.97, 0.92];

/** One placed copy of a baked prop. Coordinates match the review stage. */
export interface ChessSetPlacement {
  file: string;
  anchor: 'top' | 'floor' | 'surface';
  x?: number;
  z?: number;
  yaw?: number;
  roll?: number;
  lift?: number;
  /** Multiplier on the baked emissive color. The salon lamp uses the review value. */
  emissiveScale?: number;
  /** Linear RGB written on the emissive color. Tubes use this for cyan and magenta. */
  tint?: readonly [number, number, number];
  /** When false, the copy does not cast. Flat floor tiles use this. */
  cast?: boolean;
}

/** Floor, walls, and the pieces that stay procedural. */
export interface ChessSetShell {
  floor: readonly [number, number, number];
  floorRoughness: number;
  floorMetal: number;
  floorWidth: number;
  floorDepth: number;
  /** When set, the floor's far edge sits on this Z, as in the review stage. */
  floorZMax: number | null;
  room: {
    width: number;
    height: number;
    depth: number;
    color: readonly [number, number, number];
    z: number;
  } | null;
  cove: { zFront: number; floorRun: number } | null;
  glassTable: boolean;
  /** Timber pergola and the sea band, built from cubes. The garden only. */
  pergola: boolean;
}

/** Props loaded from `public/sets`. Procedural pieces and the club rail are absent. */
const PROPS: Record<ChessAmbianceId, readonly string[]> = {
  atelier: ['table', 'plateau-toile', 'tabouret', 'softbox', 'projecteur'],
  salon: ['table', 'napperon', 'plateau', 'lampe', 'cheminee', 'fauteuil', 'bibliotheque', 'tapis'],
  club: ['bar', 'tabouret', 'tube', 'enseigne', 'bouteilles'],
  jardin: ['table', 'coupe', 'dalle', 'banc', 'arrosoir', 'glycine'],
};

const PLACEMENTS: Record<ChessAmbianceId, readonly ChessSetPlacement[]> = {
  atelier: [
    { file: 'table', anchor: 'top' },
    { file: 'plateau-toile', anchor: 'surface', x: -0.5, z: 0.05 },
    { file: 'plateau-toile', anchor: 'surface', x: 0.5, z: 0.05 },
    { file: 'tabouret', anchor: 'floor', x: 0, z: 2.05 },
    { file: 'softbox', anchor: 'floor', x: 1.85, z: 0.45, yaw: -Math.PI / 2 },
    { file: 'projecteur', anchor: 'floor', x: -1.9, z: 0.35, yaw: Math.PI / 2 },
  ],
  salon: [
    { file: 'tapis', anchor: 'floor', lift: 0.006, z: -0.2 },
    { file: 'table', anchor: 'top' },
    { file: 'napperon', anchor: 'surface' },
    { file: 'plateau', anchor: 'surface', x: 0.62, z: 0.04 },
    { file: 'lampe', anchor: 'surface', x: -0.64, z: 0.2, emissiveScale: 0.25 },
    { file: 'cheminee', anchor: 'floor', z: 2.05, yaw: Math.PI },
    { file: 'fauteuil', anchor: 'floor', x: -1.35, z: 1.45, yaw: 2.6 },
    { file: 'fauteuil', anchor: 'floor', x: 1.35, z: 1.45, yaw: -2.6 },
    { file: 'bibliotheque', anchor: 'floor', x: -3.15, z: 0.15, yaw: Math.PI / 2 },
  ],
  club: [
    { file: 'bar', anchor: 'floor', x: 0.35, z: 3.05 },
    { file: 'tabouret', anchor: 'floor', x: -0.55, z: 1.95 },
    { file: 'tabouret', anchor: 'floor', x: 0.2, z: 1.95 },
    { file: 'tabouret', anchor: 'floor', x: 0.95, z: 1.95 },
    { file: 'bouteilles', anchor: 'floor', lift: 1.1, x: -0.55, z: 2.55 },
    { file: 'tube', anchor: 'floor', lift: 0.55, x: -3.85, z: 0.7, roll: Math.PI / 2, tint: [0, 0.95, 1] },
    { file: 'tube', anchor: 'floor', lift: 1.7, x: 0.2, z: 3.7, tint: [1, 0.12, 0.7] },
    { file: 'enseigne', anchor: 'floor', lift: 0.08, x: -1.7, z: 2.55 },
  ],
  jardin: gardenStagePlacements(),
};

/** Millimetre of air so the slab does not z-fight the table it rests on. */
const BOARD_TABLE_CLEARANCE = 0.001;
/** Salon cloth the board sits on. The napperon is about 2 cm thick. */
const SALON_CLOTH_THICKNESS = 0.02;

/**
 * Playing-surface height. The slab hangs {@link CHESS_BOARD_BODY_HEIGHT} below it,
 * so the value includes that thickness and a clearance. Salon adds the cloth.
 */
const BOARD_Y: Record<ChessAmbianceId, number> = {
  atelier: CHESS_BOARD_BODY_HEIGHT + BOARD_TABLE_CLEARANCE,
  salon: CHESS_BOARD_BODY_HEIGHT + BOARD_TABLE_CLEARANCE + SALON_CLOTH_THICKNESS,
  club: CHESS_BOARD_BODY_HEIGHT + BOARD_TABLE_CLEARANCE,
  jardin: CHESS_BOARD_BODY_HEIGHT + BOARD_TABLE_CLEARANCE,
};

/** One review-stage light. A rect is shaded as a spot: the engine has no area light. */
export interface ChessSetLight {
  type: 'spot' | 'point' | 'rect';
  /** sRGB hex, as written in the review stage. */
  color: number;
  intensity: number;
  position: readonly [number, number, number];
  target?: readonly [number, number, number];
  distance?: number;
  angle?: number;
  penumbra?: number;
  width?: number;
  height?: number;
  fromFloor?: number;
  cast?: boolean;
}

/** A spot or a point the host can spawn. Colors are linear. */
export interface ChessPunctualLight {
  kind: 'spot' | 'point';
  color: readonly [number, number, number];
  intensity: number;
  range: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  innerAngle: number;
  outerAngle: number;
  cast: boolean;
  fromFloor: number | null;
}

const LIGHTS: Record<ChessAmbianceId, readonly ChessSetLight[]> = {
  atelier: [
    {
      type: 'rect',
      color: 0xfff7f0,
      intensity: 5,
      width: 0.7,
      height: 1.05,
      position: [1.35, 0.85, 0.4],
      target: [0, 0.15, 0],
    },
    {
      type: 'spot',
      color: 0xfff4ea,
      intensity: 7.2,
      distance: 6,
      angle: 0.45,
      penumbra: 0.65,
      position: [-1.15, 1.4, 0.05],
      target: [0.1, 0.05, 0],
    },
  ],
  salon: [
    {
      type: 'spot',
      color: 0xffb56a,
      intensity: 2.6,
      distance: 4.2,
      angle: 0.85,
      penumbra: 0.45,
      // Inside the shade rather than level with it: 26 cm above the board made a hotspot
      // the inverse square turned into a 3x gradient from the near rank to the far one.
      position: [-0.58, 0.4, 0.16],
      target: [0.2, 0, 0],
    },
    {
      type: 'spot',
      color: 0xfff4ea,
      intensity: 2.2,
      distance: 4,
      angle: 0.95,
      penumbra: 0.7,
      // Behind the game camera, so the faces the player sees are not left in the lamp's shadow.
      position: [0, 0.95, -1.15],
      target: [0, 0.05, 0],
      cast: false,
    },
    {
      type: 'point',
      color: 0xff6a32,
      intensity: 4,
      distance: 2.2,
      fromFloor: 0.42,
      position: [0, 0, 1.72],
    },
  ],
  club: [
    {
      type: 'spot',
      color: 0xf2f6fb,
      intensity: 6.5,
      distance: 3.2,
      angle: 0.6,
      penumbra: 0.5,
      position: [0, 1.35, -0.55],
      target: [0, 0, 0],
    },
    { type: 'point', color: 0x2ee7ff, intensity: 10, distance: 7, fromFloor: 1.3, position: [-3.4, 0, 0.7] },
    { type: 'point', color: 0xff2f8c, intensity: 12, distance: 6.5, fromFloor: 1.85, position: [0.2, 0, 3.2] },
    {
      type: 'spot',
      color: 0xf4f7fb,
      intensity: 1.4,
      distance: 4,
      angle: 0.95,
      penumbra: 0.7,
      position: [0, 0.95, -1.15],
      target: [0, 0.05, 0],
      cast: false,
    },
  ],
  jardin: [
    {
      type: 'spot',
      color: 0xffc070,
      intensity: 26,
      distance: 3.2,
      angle: 0.55,
      penumbra: 0.4,
      // Low, from the right, onto the near tiles. The board stays inside the shade of the pergola.
      position: [1.5, 1.05, -2.15],
      target: [-0.15, -0.55, -1.05],
      cast: false,
    },
    {
      type: 'spot',
      color: 0xffd2a8,
      intensity: 4,
      distance: 8,
      angle: 1,
      penumbra: 0.85,
      position: [0, 2.6, -1.8],
      target: [0, 0, 0.2],
      cast: false,
    },
  ],
};

const SHELLS: Record<ChessAmbianceId, ChessSetShell> = {
  atelier: {
    floor: [0.48, 0.48, 0.45],
    floorRoughness: 0.92,
    floorMetal: 0,
    floorWidth: 14,
    floorDepth: 7,
    floorZMax: 0.7,
    room: null,
    cove: { zFront: 0.62, floorRun: 1.85 },
    glassTable: false,
    pergola: false,
  },
  salon: {
    floor: [0.14, 0.06, 0.03],
    floorRoughness: 0.72,
    floorMetal: 0,
    floorWidth: 14,
    floorDepth: 14,
    floorZMax: null,
    room: { width: 7.2, height: 3.1, depth: 7.2, color: [0.01, 0.008, 0.006], z: 1.15 },
    cove: null,
    glassTable: false,
    pergola: false,
  },
  club: {
    floor: [0.11, 0.12, 0.13],
    floorRoughness: 0.22,
    floorMetal: 0.18,
    floorWidth: 14,
    floorDepth: 14,
    floorZMax: null,
    room: { width: 8.4, height: 3.3, depth: 8.6, color: [0.14, 0.16, 0.18], z: 1.7 },
    cove: null,
    glassTable: true,
    pergola: false,
  },
  jardin: {
    floor: [0.28, 0.12, 0.06],
    floorRoughness: 0.92,
    floorMetal: 0,
    floorWidth: 5.4,
    floorDepth: 5.4,
    floorZMax: null,
    room: null,
    cove: null,
    glassTable: false,
    pergola: true,
  },
};

/**
 * Reads a stored room. Anything else is Atelier.
 * @param raw - Value of `w3dts-chess-ambiance`, or null.
 * @returns A known room id.
 */
export function parseChessAmbiance(raw: string | null): ChessAmbianceId {
  if (raw === 'atelier' || raw === 'salon' || raw === 'club' || raw === 'jardin') return raw;
  return 'atelier';
}

/**
 * Writes the room id and leaves every other key alone.
 * @param storage - Key-value store, usually `localStorage`.
 * @param id - Room to remember.
 */
export function rememberChessAmbiance(storage: ChessAmbianceStorage, id: ChessAmbianceId): void {
  storage.setItem(CHESS_AMBIANCE_KEY, id);
}

/**
 * Thumbnail and sun for one room. The match does not load an HDRI.
 * @param id - Room id.
 * @returns The set the host applies.
 */
export function chessSetLook(id: ChessAmbianceId): ChessSetLook {
  return LOOKS[id];
}

/**
 * Prop file stems for one room. The atelier cyclorama, the club glass table, and the club rail are not included.
 * @param id - Room id.
 * @returns Stems, without `.glb`.
 */
export function chessSetProps(id: ChessAmbianceId): readonly string[] {
  return PROPS[id];
}

/**
 * Copies of each prop, with the same anchors as the review stage.
 * @param id - Room id.
 * @returns Placements. The club table and the cyan rail are not in the list.
 */
export function chessSetPlacements(id: ChessAmbianceId): readonly ChessSetPlacement[] {
  return PLACEMENTS[id];
}

/**
 * Floor, room, cove, and whether the glass table is drawn in code.
 * @param id - Room id.
 * @returns The procedural shell around the props.
 */
export function chessSetShell(id: ChessAmbianceId): ChessSetShell {
  return SHELLS[id];
}

/** Smoked glass of the club table, matching the review MeshPhysicalMaterial. */
export interface ChessGlassTop {
  /** Drawn after the opaques, so refraction samples the room and not the pane itself. */
  alphaMode: 'BLEND';
  /** Linear filter on the light that passes through. Review color `0xb7c2c8`. */
  color: readonly [number, number, number];
  roughness: number;
  metallic: number;
  transmission: number;
  ior: number;
  /** Mesh-local thickness in metres. The pane is 12 mm. */
  thickness: number;
  /** Linear colour white light becomes after `attenuationDistance`. Review `0x1a2228`. */
  attenuationColor: readonly [number, number, number];
  attenuationDistance: number;
  /**
   * Paths left on above the stripped core. Without transmission the compiler
   * forces the factor to zero and the pane stays an opaque slab.
   */
  compile: {
    khrMaterialsTransmission: true;
    khrMaterialsVolume: true;
    khrMaterialsIor: true;
  };
}

function linearFromSrgbByte(byte: number): number {
  const encoded = byte / 255;
  return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
}

/**
 * Optical setup of the club glass top.
 * @returns The review smoked-glass values, in linear RGB.
 */
export function chessGlassTop(): ChessGlassTop {
  return {
    alphaMode: 'BLEND',
    color: [linearFromSrgbByte(0xb7), linearFromSrgbByte(0xc2), linearFromSrgbByte(0xc8)],
    roughness: 0.05,
    metallic: 0,
    transmission: 1,
    ior: 1.45,
    thickness: 0.012,
    attenuationColor: [linearFromSrgbByte(0x1a), linearFromSrgbByte(0x22), linearFromSrgbByte(0x28)],
    attenuationDistance: 0.4,
    compile: {
      khrMaterialsTransmission: true,
      khrMaterialsVolume: true,
      khrMaterialsIor: true,
    },
  };
}

/**
 * How far the playing surface sits above y = 0 so the slab rests on the table.
 * @param id - Room id.
 * @returns Metres. Salon is higher by the cloth.
 */
export function chessSetBoardY(id: ChessAmbianceId): number {
  return BOARD_Y[id];
}

/**
 * Review lights as spots and points. The atelier softbox is the first spot.
 * @param id - Room id.
 * @returns Lights in review order. Y from the floor is still unresolved.
 */
export function chessSetPunctualLights(id: ChessAmbianceId): readonly ChessPunctualLight[] {
  return LIGHTS[id].map(toPunctualLight);
}

function toPunctualLight(light: ChessSetLight): ChessPunctualLight {
  const target = light.target ?? [0, 0, 0];
  if (light.type === 'rect') {
    const dx = target[0] - light.position[0];
    const dy = target[1] - light.position[1];
    const dz = target[2] - light.position[2];
    const distance = Math.hypot(dx, dy, dz) || 1;
    const half = Math.max(light.width ?? 0.5, light.height ?? 0.5) / 2;
    const outer = Math.atan(half / distance);
    return {
      kind: 'spot',
      color: linearFromHex(light.color),
      intensity: light.intensity,
      range: distance * 3,
      position: light.position,
      target,
      innerAngle: outer * 0.35,
      outerAngle: outer,
      cast: false,
      fromFloor: null,
    };
  }
  const outer = light.angle ?? Math.PI / 4;
  const penumbra = light.penumbra ?? 0;
  return {
    kind: light.type === 'point' ? 'point' : 'spot',
    color: linearFromHex(light.color),
    intensity: light.intensity,
    range: light.distance ?? 0,
    position: light.position,
    target,
    innerAngle: outer * (1 - penumbra),
    outerAngle: outer,
    cast: light.cast !== false && light.type === 'spot',
    fromFloor: light.fromFloor ?? null,
  };
}

function linearFromHex(hex: number): [number, number, number] {
  return [linearChannel((hex >> 16) & 255), linearChannel((hex >> 8) & 255), linearChannel(hex & 255)];
}

function linearChannel(byte: number): number {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * Public URL of one baked prop at a texture tier.
 * @param id - Room id.
 * @param file - Prop stem, such as `table`.
 * @param textureSize - 256, 512, or 1024, the same tiers as the piece textures.
 * @returns URL under `/sets/`.
 */
export function chessSetPropUrl(id: ChessAmbianceId, file: string, textureSize: number): string {
  return `/sets/${id}/${textureSize}/${file}.glb`;
}

/**
 * The cloth plane stays until every prop of the room is available.
 * @param id - Room id.
 * @param present - Prop stems that resolved.
 * @returns True when the studio cloth must remain.
 */
export function chessSetKeepsCloth(id: ChessAmbianceId, present: readonly string[]): boolean {
  return chessSetProps(id).some((file) => !present.includes(file));
}

/**
 * Directional sun for the room. The cloth studio keeps one intensity so a missing set stays playable.
 * @param id - Room id.
 * @param cloth - True while `ChessStudioCloth` is the floor.
 * @returns Light intensity.
 */
export function chessSetSunIntensity(id: ChessAmbianceId, cloth: boolean): number {
  if (cloth) return CLOTH_SUN_INTENSITY;
  return LOOKS[id].sun;
}

/**
 * Environment fill for the room. The engine has no hemisphere light, so this is what
 * keeps the surfaces the spots miss from reading as pure black.
 * @param id - Room id.
 * @returns Renderer IBL intensity.
 */
export function chessSetAmbient(id: ChessAmbianceId): number {
  return LOOKS[id].ambient;
}

/** Reflectance of a light square. The board is the brightest thing the camera frames. */
const LIGHT_SQUARE_ALBEDO = 0.8;

/**
 * Linear response of a light square at the centre of the board, summed over the room's
 * lights and its sun. Mirrors the shader: a windowed inverse square, the cosine of the
 * incidence, and a Lambert lobe. Spot cones are ignored, so the figure is an upper bound.
 *
 * Above 1 the tone mapper clips the square to white and the board loses its squares.
 * @param id - Room id.
 * @param floorY - Table feet height, metres, negative below the playing surface.
 * @returns Linear radiance before tone mapping.
 */
export function chessBoardExposure(id: ChessAmbianceId, floorY: number): number {
  const boardY = BOARD_Y[id];
  let total = 0;
  for (const light of chessSetPunctualLights(id)) {
    const y = light.fromFloor === null ? light.position[1] : floorY + light.fromFloor;
    const dy = y - boardY;
    const distance = Math.hypot(light.position[0], dy, light.position[2]);
    if (distance < 1e-6 || dy <= 0) continue;
    const window = Math.max(0, Math.min(1, 1 - (distance / light.range) ** 4));
    total +=
      Math.max(...light.color) *
      light.intensity *
      (window / (distance * distance)) *
      (dy / distance);
  }
  const { sun, sunPos } = LOOKS[id];
  if (sunPos) {
    const length = Math.hypot(sunPos[0], sunPos[1], sunPos[2]) || 1;
    total += sun * (sunPos[1] / length);
  }
  return (LIGHT_SQUARE_ALBEDO / Math.PI) * total;
}

/** Game camera the pawn faces are judged from. Same eye as the match. */
const GAME_CAMERA_EYE: readonly [number, number, number] = [0, 0.55, -0.72];

/**
 * Linear response of a light square turned toward the game camera.
 * A lamp behind the pieces does not count: that is the side the player does not see.
 * @param id - Room id.
 * @param floorY - Table feet height, metres, negative below the playing surface.
 * @returns Linear radiance before tone mapping.
 */
export function chessCameraFaceExposure(id: ChessAmbianceId, floorY: number): number {
  const boardY = BOARD_Y[id];
  const nx = GAME_CAMERA_EYE[0];
  const ny = GAME_CAMERA_EYE[1] - boardY;
  const nz = GAME_CAMERA_EYE[2];
  const nLength = Math.hypot(nx, ny, nz) || 1;
  let total = 0;
  for (const light of chessSetPunctualLights(id)) {
    const y = light.fromFloor === null ? light.position[1] : floorY + light.fromFloor;
    const dx = light.position[0];
    const dy = y - boardY;
    const dz = light.position[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 1e-6) continue;
    const facing = Math.max(0, (nx * dx + ny * dy + nz * dz) / (nLength * distance));
    if (facing <= 0) continue;
    const window = Math.max(0, Math.min(1, 1 - (distance / light.range) ** 4));
    total += Math.max(...light.color) * light.intensity * (window / (distance * distance)) * facing;
  }
  const { sun, sunPos } = LOOKS[id];
  if (sunPos) {
    const length = Math.hypot(sunPos[0], sunPos[1] - boardY, sunPos[2]) || 1;
    const facing = Math.max(
      0,
      (nx * sunPos[0] + ny * (sunPos[1] - boardY) + nz * sunPos[2]) / (nLength * length)
    );
    total += sun * facing;
  }
  return (LIGHT_SQUARE_ALBEDO / Math.PI) * total;
}

const listeners = new Set<(id: ChessAmbianceId) => void>();

let current = parseChessAmbiance(
  typeof globalThis.localStorage === 'undefined'
    ? null
    : globalThis.localStorage.getItem(CHESS_AMBIANCE_KEY)
);

/**
 * Room currently stored. Atelier when nothing was saved.
 * @returns The active room id.
 */
export function getChessAmbiance(): ChessAmbianceId {
  return current;
}

/**
 * Stages a room and tells the host. Only an Options room is written to storage.
 * @param id - Room chosen in Options, or Jardin from the review bar.
 */
export function setChessAmbiance(id: ChessAmbianceId): void {
  const next = parseChessAmbiance(id);
  current = next;
  if ((CHESS_AMBIANCES as readonly string[]).includes(next)) {
    const storage = globalThis.localStorage;
    if (storage) {
      try {
        rememberChessAmbiance(storage, next);
      } catch {
        /* private mode */
      }
    }
  }
  for (const listener of listeners) listener(next);
}

/**
 * Subscribes to room changes. Does not emit the current value.
 * @param listener - Called with the new id.
 * @returns Unsubscribe.
 */
export function subscribeChessAmbiance(listener: (id: ChessAmbianceId) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
