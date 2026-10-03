/**
 * @file chessGraphics.test.ts
 * @description Internal resolution caps and which post passes stay enabled.
 */

import { describe, expect, it } from 'vitest';
import {
  FLUID_GRAPHICS,
  GRAPHICS_PRESETS,
  gamePassNames,
  gameSurfacePixels,
  matchingGraphicsPreset,
  pieceTextureSize,
} from '../src/renderer/graphics/chessGraphicsSettings';

describe('chess graphics', () => {
  it('caps a 4K framebuffer to 1080p on the long side', () => {
    expect(gameSurfacePixels(3840, 2160, 1, '1080')).toEqual({ width: 1920, height: 1080 });
  });

  it('keeps a 4K framebuffer when the cap is 4K', () => {
    expect(gameSurfacePixels(3840, 2160, 1, '2160')).toEqual({ width: 3840, height: 2160 });
  });

  it('uses device pixels for native and still caps 1080p', () => {
    expect(gameSurfacePixels(1920, 1080, 2, 'native')).toEqual({ width: 3840, height: 2160 });
    expect(gameSurfacePixels(1920, 1080, 2, '1080')).toEqual({ width: 1920, height: 1080 });
  });

  it('does not upscale a window that is already under the cap', () => {
    expect(gameSurfacePixels(1280, 720, 1, '1080')).toEqual({ width: 1280, height: 720 });
  });

  it('drops occlusion, reflections and bloom in the fluid preset', () => {
    const names = gamePassNames(FLUID_GRAPHICS);
    expect(names).toContain('01_Shadows');
    expect(names).toContain('07_FXAA');
    expect(names).not.toContain('04b_HBAO');
    expect(names).not.toContain('05_SSR_Floor');
    expect(names).not.toContain('06_Bright');
  });

  it('enables the heavy passes for the quality preset', () => {
    const quality = GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite');
    expect(quality).toBeDefined();
    const names = gamePassNames(quality!.settings);
    expect(names).toEqual(
      expect.arrayContaining(['04d_HBAO_Apply', '05b_SSR_Composite', '06d_BloomAdd'])
    );
    expect(matchingGraphicsPreset(quality!.settings)).toBe('qualite');
  });

  it('maps texture quality to the baked sizes', () => {
    expect(pieceTextureSize('low')).toBe(256);
    expect(pieceTextureSize('medium')).toBe(512);
    expect(pieceTextureSize('high')).toBe(1024);
    expect(FLUID_GRAPHICS.textureQuality).toBe('low');
    expect(GRAPHICS_PRESETS.find((preset) => preset.id === 'equilibre')?.settings.textureQuality).toBe(
      'medium'
    );
    expect(GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite')?.settings.textureQuality).toBe(
      'high'
    );
  });
});
