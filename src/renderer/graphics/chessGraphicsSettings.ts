/**
 * @file chessGraphicsSettings.ts
 * @description Internal resolution and post-process toggles for the chess table.
 * A 4K window otherwise runs HBAO, floor reflections and bloom at full size.
 */

import { DirectionalLightComponent, type Engine } from '@naanouff/w3dts-core';

export type ChessResolution = '1080' | '1440' | '2160' | 'native';

/** Baked piece maps: basse 256, normale 512, haute 1024. */
export type ChessTextureQuality = 'low' | 'medium' | 'high';

export interface ChessGraphicsSettings {
  resolution: ChessResolution;
  textureQuality: ChessTextureQuality;
  shadows: boolean;
  ambientOcclusion: boolean;
  reflections: boolean;
  bloom: boolean;
  /** Silhouette cutout for the coach. Off on Fluide. */
  coachOutline: boolean;
}

const STORAGE_KEY = 'w3dts-chess-graphics';

/** Longest side of the internal framebuffer, in pixels. */
const LONGEST_SIDE: Record<ChessResolution, number> = {
  '1080': 1920,
  '1440': 2560,
  '2160': 3840,
  native: Number.POSITIVE_INFINITY,
};

const CORE_PASSES = [
  '02_Opaques',
  '02b_Decals',
  '03_Skybox',
  '03b_CopySceneForRefraction',
  '04_Transparents',
  'Tone Mapping & Output',
  'Debug Lines Pass',
  '07_FXAA',
];

const TEXTURE_SIZE: Record<ChessTextureQuality, number> = {
  low: 256,
  medium: 512,
  high: 1024,
};

export const TEXTURE_QUALITY_OPTIONS: { id: ChessTextureQuality; label: string }[] = [
  { id: 'low', label: 'Basse' },
  { id: 'medium', label: 'Normale' },
  { id: 'high', label: 'Haute' },
];

export function pieceTextureSize(quality: ChessTextureQuality): number {
  return TEXTURE_SIZE[quality];
}

export const FLUID_GRAPHICS: ChessGraphicsSettings = {
  resolution: '1080',
  textureQuality: 'low',
  shadows: true,
  ambientOcclusion: false,
  reflections: false,
  bloom: false,
  coachOutline: false,
};

export const GRAPHICS_PRESETS: {
  id: string;
  title: string;
  blurb: string;
  settings: ChessGraphicsSettings;
}[] = [
  {
    id: 'fluide',
    title: 'Fluide',
    blurb: '1080p, textures 256',
    settings: FLUID_GRAPHICS,
  },
  {
    id: 'equilibre',
    title: 'Équilibré',
    blurb: '1440p, textures 512',
    settings: {
      resolution: '1440',
      textureQuality: 'medium',
      shadows: true,
      ambientOcclusion: false,
      reflections: false,
      bloom: true,
      coachOutline: true,
    },
  },
  {
    id: 'qualite',
    title: 'Qualité',
    blurb: '4K, textures 1024',
    settings: {
      resolution: '2160',
      textureQuality: 'high',
      shadows: true,
      ambientOcclusion: true,
      reflections: true,
      bloom: true,
      coachOutline: true,
    },
  },
  {
    id: 'natif',
    title: 'Natif',
    blurb: 'Écran natif, textures 1024',
    settings: {
      resolution: 'native',
      textureQuality: 'high',
      shadows: true,
      ambientOcclusion: true,
      reflections: true,
      bloom: true,
      coachOutline: true,
    },
  },
];

export const RESOLUTION_OPTIONS: { id: ChessResolution; label: string }[] = [
  { id: '1080', label: '1080p' },
  { id: '1440', label: '1440p' },
  { id: '2160', label: '4K' },
  { id: 'native', label: 'Natif' },
];

let settings: ChessGraphicsSettings = readStoredSettings();
let target: { engine: Engine; canvas: HTMLCanvasElement } | null = null;
let reloadPieceTextures: ((quality: ChessTextureQuality) => void) | null = null;
const listeners = new Set<(value: ChessGraphicsSettings) => void>();

function isResolution(value: unknown): value is ChessResolution {
  return value === '1080' || value === '1440' || value === '2160' || value === 'native';
}

function isTextureQuality(value: unknown): value is ChessTextureQuality {
  return value === 'low' || value === 'medium' || value === 'high';
}

function textureQualityForResolution(resolution: ChessResolution): ChessTextureQuality {
  if (resolution === '2160' || resolution === 'native') return 'high';
  if (resolution === '1440') return 'medium';
  return 'low';
}

/**
 * Older saves omit the flag. The ring stays off only for the fluid look.
 * @param parsed - Partial settings read from storage.
 */
export function coachOutlineFromStored(parsed: Partial<ChessGraphicsSettings>): boolean {
  if (parsed.coachOutline === true) return true;
  if (parsed.coachOutline === false) return false;
  return (
    parsed.resolution !== '1080' ||
    parsed.ambientOcclusion === true ||
    parsed.reflections === true ||
    parsed.bloom === true
  );
}

function readStoredSettings(): ChessGraphicsSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...FLUID_GRAPHICS };
    const parsed = JSON.parse(raw) as Partial<ChessGraphicsSettings>;
    if (!isResolution(parsed.resolution)) return { ...FLUID_GRAPHICS };
    return {
      resolution: parsed.resolution,
      textureQuality: isTextureQuality(parsed.textureQuality)
        ? parsed.textureQuality
        : textureQualityForResolution(parsed.resolution),
      shadows: parsed.shadows !== false,
      ambientOcclusion: parsed.ambientOcclusion === true,
      reflections: parsed.reflections === true,
      bloom: parsed.bloom === true,
      coachOutline: coachOutlineFromStored(parsed),
    };
  } catch {
    return { ...FLUID_GRAPHICS };
  }
}

export function getChessGraphicsSettings(): ChessGraphicsSettings {
  return settings;
}

export function subscribeChessGraphics(
  listener: (value: ChessGraphicsSettings) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function matchingGraphicsPreset(value: ChessGraphicsSettings): string | null {
  const found = GRAPHICS_PRESETS.find((preset) => sameSettings(preset.settings, value));
  return found?.id ?? null;
}

function sameSettings(a: ChessGraphicsSettings, b: ChessGraphicsSettings): boolean {
  return (
    a.resolution === b.resolution &&
    a.textureQuality === b.textureQuality &&
    a.shadows === b.shadows &&
    a.ambientOcclusion === b.ambientOcclusion &&
    a.reflections === b.reflections &&
    a.bloom === b.bloom &&
    a.coachOutline === b.coachOutline
  );
}

/** Internal framebuffer size. Caps the longest side so a 4K window can render at 1080p. */
export function gameSurfacePixels(
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number,
  resolution: ChessResolution
): { width: number; height: number } {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  let width = Math.max(1, Math.round(clientWidth * dpr));
  let height = Math.max(1, Math.round(clientHeight * dpr));
  const cap = LONGEST_SIDE[resolution];
  const longest = Math.max(width, height);
  if (longest > cap) {
    const scale = cap / longest;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  return { width, height };
}

/** Passes the chess graph may skip. Disabled groups alias their output back to the scene color. */
export function gamePassNames(value: ChessGraphicsSettings): string[] {
  const names = [...CORE_PASSES];
  if (value.shadows) names.unshift('01_Shadows');
  if (value.ambientOcclusion) names.push('04b_HBAO', '04c_HBAO_Blur', '04d_HBAO_Apply');
  if (value.reflections) names.push('05_SSR_Floor', '05b_SSR_Composite');
  if (value.bloom) names.push('06_Bright', '06b_BlurH', '06c_BlurV', '06d_BloomAdd');
  if (value.coachOutline) names.push('04e_CoachMask', '04f_CoachCutout');
  return names;
}

export function applyChessGraphics(
  engine: Engine,
  canvas: HTMLCanvasElement,
  value: ChessGraphicsSettings = settings
): void {
  const pixels = gameSurfacePixels(
    canvas.clientWidth,
    canvas.clientHeight,
    window.devicePixelRatio,
    value.resolution
  );
  if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    engine.setGameViewSurfaceSize(pixels.width, pixels.height);
  }
  engine.setGameActivePasses(gamePassNames(value));
  for (const row of engine.ecsWorld.query([DirectionalLightComponent]).iter()) {
    const light = row[1][0] as DirectionalLightComponent;
    light.shadowsEnabled = value.shadows;
  }
}

export function attachChessGraphics(engine: Engine, canvas: HTMLCanvasElement): void {
  target = { engine, canvas };
  applyChessGraphics(engine, canvas, settings);
}

export function registerPieceTextureReloader(reload: (quality: ChessTextureQuality) => void): void {
  reloadPieceTextures = reload;
}

export function setChessGraphicsSettings(next: ChessGraphicsSettings): void {
  const texturesChanged = next.textureQuality !== settings.textureQuality;
  settings = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  if (target) applyChessGraphics(target.engine, target.canvas, settings);
  if (texturesChanged) reloadPieceTextures?.(settings.textureQuality);
  for (const listener of listeners) listener(settings);
}

export function currentGameSurfaceSize(canvas: HTMLCanvasElement | null): {
  width: number;
  height: number;
} {
  if (!canvas) return gameSurfacePixels(1, 1, 1, settings.resolution);
  return gameSurfacePixels(
    canvas.clientWidth,
    canvas.clientHeight,
    window.devicePixelRatio,
    settings.resolution
  );
}

export function readChessFramesPerSecond(engine: Engine | null): number {
  if (!engine) return 0;
  return Math.round(engine.perfMonitor.getFPS());
}

export function getChessGraphicsEngine(): Engine | null {
  return target?.engine ?? null;
}

export function getChessGraphicsCanvas(): HTMLCanvasElement | null {
  return target?.canvas ?? null;
}
