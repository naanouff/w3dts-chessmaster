/**
 * @file texelDensity.ts
 * @project w3dts
 * @description Texture sizes from a pawn reference density, with a lighter scene budget.
 */

import type { ChessPieceRole } from '../../chess/rules/chessTypes';
import { setProp } from '../../../scripts/setProps.mjs';
import { pieceTextureSize, type ChessTextureQuality } from './chessGraphicsSettings';

/** World height of the baked pawn, in metres. */
export const PAWN_HEIGHT_M = 0.054;

/** Scene props target this fraction of the pawn texel density. */
export const SCENE_DENSITY_RATIO = 1 / 8;

/** Sizes the bake and the installer ship. */
export const TEXTURE_BAKE_SIZES = [256, 512, 1024, 2048] as const;

export type TextureBakeSize = (typeof TEXTURE_BAKE_SIZES)[number];

/**
 * Playing-board maps: one step above the pawn ladder.
 * @param quality - Options texture tier.
 */
export function boardTextureSize(quality: ChessTextureQuality): TextureBakeSize {
  return stepUp(asBakeSize(pieceTextureSize(quality)));
}

/**
 * Per-role piece maps. Queen and king take the board step; the rest stay on the pawn ladder.
 * @param role - Staunton role.
 * @param quality - Options texture tier.
 */
export function roleTextureSize(role: ChessPieceRole, quality: ChessTextureQuality): TextureBakeSize {
  const subject = asBakeSize(pieceTextureSize(quality));
  return role === 'queen' || role === 'king' ? stepUp(subject) : subject;
}

/**
 * Scene prop maps at one eighth of the pawn density for the prop's scale length.
 * @param metres - World size on the prop's scale axis.
 * @param quality - Options texture tier.
 */
export function sceneTextureSize(metres: number, quality: ChessTextureQuality): TextureBakeSize {
  if (!(metres > 0) || !Number.isFinite(metres)) return asBakeSize(pieceTextureSize(quality));
  const density = (pieceTextureSize(quality) / PAWN_HEIGHT_M) * SCENE_DENSITY_RATIO;
  return snapBakeSize(density * metres);
}

/**
 * Scene prop maps from the SET_PROPS length.
 * @param scene - Room id.
 * @param file - Prop stem.
 * @param quality - Options texture tier.
 */
export function setPropTextureSize(
  scene: string,
  file: string,
  quality: ChessTextureQuality
): TextureBakeSize {
  return sceneTextureSize(setProp(scene, file).metres, quality);
}

function asBakeSize(size: number): TextureBakeSize {
  if ((TEXTURE_BAKE_SIZES as readonly number[]).includes(size)) return size as TextureBakeSize;
  return snapBakeSize(size);
}

function stepUp(size: TextureBakeSize): TextureBakeSize {
  const index = TEXTURE_BAKE_SIZES.indexOf(size);
  return TEXTURE_BAKE_SIZES[Math.min(TEXTURE_BAKE_SIZES.length - 1, index + 1)]!;
}

function snapBakeSize(ideal: number): TextureBakeSize {
  let best: TextureBakeSize = TEXTURE_BAKE_SIZES[0];
  let bestErr = Infinity;
  for (const size of TEXTURE_BAKE_SIZES) {
    const err = Math.abs(Math.log2(ideal / size));
    if (err < bestErr) {
      bestErr = err;
      best = size;
    }
  }
  return best;
}

/**
 * Picks the bake size closest to `preferred` among those that exist.
 * @param preferred - Ideal size from density.
 * @param available - True when that size is on disk.
 * @returns A bake size, or null when none exist.
 */
export function pickAvailableBakeSize(
  preferred: number,
  available: (size: TextureBakeSize) => boolean
): TextureBakeSize | null {
  const ordered = [...TEXTURE_BAKE_SIZES].sort((a, b) => {
    const da = Math.abs(Math.log2(a / preferred));
    const db = Math.abs(Math.log2(b / preferred));
    return da - db || a - b;
  });
  for (const size of ordered) {
    if (available(size)) return size;
  }
  return null;
}

const TEXTURE_QUALITIES: ChessTextureQuality[] = ['low', 'medium', 'high'];

function uniqueBakeSizes(sizes: Iterable<TextureBakeSize>): TextureBakeSize[] {
  const set = new Set(sizes);
  return TEXTURE_BAKE_SIZES.filter((size) => set.has(size));
}

/**
 * Bake sizes a piece role can request from Fluide through Qualité.
 * @param role - Staunton role.
 */
export function shippedPieceTextureSizes(role: ChessPieceRole): TextureBakeSize[] {
  return uniqueBakeSizes(TEXTURE_QUALITIES.map((quality) => roleTextureSize(role, quality)));
}

/** Bake sizes the board can request from Fluide through Qualité. */
export function shippedBoardTextureSizes(): TextureBakeSize[] {
  return uniqueBakeSizes(TEXTURE_QUALITIES.map((quality) => boardTextureSize(quality)));
}

/**
 * Bake sizes a scene prop can request from Fluide through Qualité.
 * @param scene - Room id.
 * @param file - Prop stem.
 */
export function shippedSetTextureSizes(scene: string, file: string): TextureBakeSize[] {
  return uniqueBakeSizes(
    TEXTURE_QUALITIES.map((quality) => setPropTextureSize(scene, file, quality))
  );
}
