/**
 * @file texelDensity.test.ts
 * @description Hero pieces keep the pawn ladder; scene props use one eighth of that density.
 */

import { describe, expect, it } from 'vitest';
import { pieceBakeSizes, BOARD_BAKE_SIZES } from '../scripts/pieceBakeSizes.mjs';
import { pieceTextureSize } from '../src/renderer/graphics/chessGraphicsSettings';
import {
  boardTextureSize,
  pickAvailableBakeSize,
  roleTextureSize,
  sceneTextureSize,
  setPropTextureSize,
  shippedBoardTextureSizes,
  shippedPieceTextureSizes,
  shippedSetTextureSizes,
} from '../src/renderer/graphics/texelDensity';

describe('texel density', () => {
  it('keeps the pawn ladder on the subject and lifts queen, king and board one step', () => {
    expect(pieceTextureSize('low')).toBe(256);
    expect(pieceTextureSize('medium')).toBe(512);
    expect(pieceTextureSize('high')).toBe(1024);
    expect(roleTextureSize('pawn', 'high')).toBe(1024);
    expect(roleTextureSize('rook', 'high')).toBe(1024);
    expect(roleTextureSize('queen', 'low')).toBe(512);
    expect(roleTextureSize('king', 'high')).toBe(2048);
    expect(boardTextureSize('low')).toBe(512);
    expect(boardTextureSize('medium')).toBe(1024);
    expect(boardTextureSize('high')).toBe(2048);
  });

  it('sizes a scene prop at one eighth of the pawn density, clamped to the bake ladder', () => {
    // 1.8 m table at Fluide: 256 / 0.054 / 8 * 1.8 ≈ 1067 → 1024
    expect(sceneTextureSize(1.8, 'low')).toBe(1024);
    // Same table at Qualité: ≈ 4267 → 2048 (bake cap)
    expect(sceneTextureSize(1.8, 'high')).toBe(2048);
    // Small coupe: ≈ 107 → 256 (bake floor)
    expect(sceneTextureSize(0.18, 'low')).toBe(256);
    // Coupe 0.18 m at Équilibré: ≈ 213 → 256
    expect(setPropTextureSize('jardin', 'coupe', 'medium')).toBe(256);
    expect(setPropTextureSize('terrasse', 'balustrade', 'high')).toBe(2048);
  });

  it('falls back to the nearest bake size that exists', () => {
    expect(pickAvailableBakeSize(1024, (size) => size === 512 || size === 2048)).toBe(512);
    expect(pickAvailableBakeSize(1024, (size) => size === 2048)).toBe(2048);
    expect(pickAvailableBakeSize(256, () => false)).toBeNull();
  });

  it('ships only the bake sizes each asset can request across Fluide to Qualité', () => {
    expect(shippedPieceTextureSizes('pawn')).toEqual([256, 512, 1024]);
    expect(shippedPieceTextureSizes('rook')).toEqual([256, 512, 1024]);
    expect(shippedPieceTextureSizes('queen')).toEqual([512, 1024, 2048]);
    expect(shippedPieceTextureSizes('king')).toEqual([512, 1024, 2048]);
    expect(shippedBoardTextureSizes()).toEqual([512, 1024, 2048]);
    expect(shippedSetTextureSizes('atelier', 'table')).toEqual([1024, 2048]);
    // Coupe 0.18 m: Fluide/Équilibré → 256, Qualité → 512
    expect(shippedSetTextureSizes('jardin', 'coupe')).toEqual([256, 512]);
    expect(pieceBakeSizes('b_pion')).toEqual(shippedPieceTextureSizes('pawn'));
    expect(pieceBakeSizes('b_reine')).toEqual(shippedPieceTextureSizes('queen'));
    expect([...BOARD_BAKE_SIZES]).toEqual(shippedBoardTextureSizes());
  });
});

