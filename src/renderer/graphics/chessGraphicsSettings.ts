/**
 * @file chessGraphicsSettings.ts
 * @description Internal resolution and post-process toggles for the chess table.
 * A 4K window otherwise runs HBAO, floor reflections and bloom at full size.
 */

import { DirectionalLightComponent, type Engine } from '@naanouff/w3dts-core';

export type ChessResolution = '1080' | '1440' | '2160' | 'native';

/** Spatial upscale: render under the canvas, then magnify and sharpen back to it. */
export type ChessUpscale = 'off' | 'quality' | 'performance';

/** Subject (pawn) maps: basse 256, normale 512, haute 1024. Scene props use texel density. */
export type ChessTextureQuality = 'low' | 'medium' | 'high';

/** Off, one hard compare, or the same map with the soft filter. */
export type ChessShadowMode = 'off' | 'hard' | 'soft';

/**
 * Fallback split distances in metres. Extent fit ignores them while the board
 * AABB is set. Without it the engine's first plane is 15 m, which smears the table.
 */
const BOARD_SHADOW_SPLITS: [number, number, number, number] = [1.2, 1.2, 1.2, 24];

export interface ChessGraphicsSettings {
  resolution: ChessResolution;
  textureQuality: ChessTextureQuality;
  /** Pass list and the sun flag. Off only; hard and soft both keep the pass. */
  shadows: boolean;
  /** Which shadow path the options apply. */
  shadowMode: ChessShadowMode;
  /** Internal render scale. The canvas keeps the size `resolution` allows. */
  upscale: ChessUpscale;
  ambientOcclusion: boolean;
  reflections: boolean;
  bloom: boolean;
  /** FXAA. On everywhere: it is the pass that writes the final image. */
  antialiasing: boolean;
  /** Height fog. On for Qualité and Natif, the same stack as the review. */
  volume: boolean;
  /** Disk blur around the board. On for Qualité and Natif, the same stack as the review. */
  dof: boolean;
  /** Local scene cubemap. Off on Fluide and Équilibré. Floor SSR stays on `reflections`. */
  reflectionProbes: boolean;
  /** Silhouette cutout for the coach. On for every preset: it marks the piece. */
  coachOutline: boolean;
  /** Hearth, dust and cigar. On for every preset, same as the review. */
  sceneLife: boolean;
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

export const SHADOW_MODE_OPTIONS: ChessShadowMode[] = ['off', 'hard', 'soft'];

/**
 * Edge of one shadow-atlas layer. Hard stays at 1024. Soft doubles it.
 * @param mode - Active shadow choice.
 * @returns Texels per edge.
 */
export function shadowMapSize(mode: ChessShadowMode): number {
  return mode === 'hard' ? 1024 : 2048;
}

/**
 * Reads a stored shadow choice. `cascade` was the frustum mode and comes back as soft.
 * @param parsed - Partial settings read from storage.
 * @returns Mode the options apply.
 */
const UPSCALE_SCALE: Record<ChessUpscale, number> = {
  off: 1,
  quality: 2 / 3,
  performance: 0.5,
};

/** Relative targets stay under 1 so the engine does not rebuild them at the canvas size. */
const RELATIVE_LIMIT = 1 - 1e-4;

/**
 * Fraction of the canvas the scene renders at.
 * @param mode - Upscale choice.
 * @returns 1, two thirds, or one half.
 */
export function upscaleRenderScale(mode: ChessUpscale): number {
  return UPSCALE_SCALE[mode];
}

/**
 * Sharpening applied after the magnify. A one-to-one image stays unsharpened.
 * @param mode - Upscale choice.
 * @returns Weight of the contrast-adaptive sharpen.
 */
export function upscaleSharpness(mode: ChessUpscale): number {
  return mode === 'off' ? 0 : 0.7;
}

/**
 * Reads a stored upscale choice. A profile saved before the option comes back as off.
 * @param parsed - Partial settings read from storage.
 * @returns Mode the options apply.
 */
export function upscaleFromStored(parsed: { upscale?: unknown }): ChessUpscale {
  if (parsed.upscale === 'quality' || parsed.upscale === 'performance') return parsed.upscale;
  return 'off';
}

/**
 * Multiplies relative graph targets by the render scale.
 * Absolute targets keep their texel count. A scaled size stays under 1.
 * @param resources - Texture definitions from the chess graph.
 * @param scale - Fraction from {@link upscaleRenderScale}.
 * @returns The same list, with relative sizes multiplied.
 */
export function scaleChessGraphResources<
  T extends { name: string; sizeType: string; width: number; height: number },
>(resources: readonly T[], scale: number): T[] {
  if (scale === 1) return [...resources];
  return resources.map((resource) => {
    if (resource.sizeType !== 'relative') return { ...resource };
    return {
      ...resource,
      width: Math.min(resource.width * scale, RELATIVE_LIMIT),
      height: Math.min(resource.height * scale, RELATIVE_LIMIT),
    };
  });
}

export function shadowModeFromStored(parsed: {
  shadowMode?: unknown;
  shadows?: unknown;
}): ChessShadowMode {
  if (parsed.shadowMode === 'soft' || parsed.shadowMode === 'cascade') return 'soft';
  if (parsed.shadowMode === 'hard') return 'hard';
  if (parsed.shadowMode === 'off' || parsed.shadows === false) return 'off';
  return 'hard';
}

/**
 * Renderer fields the shadow choice writes.
 * Extent fit only engages once the scene has set `csmIncludeAabb`.
 */
export interface ChessShadowRenderer {
  shadowsEnabled: boolean;
  shadowFilter: 'hard' | 'soft';
  csmCascadeCount: number;
  csmFit: 'frustum' | 'extent';
  csmCascadeSplits: [number, number, number, number] | null;
}

/**
 * Applies the options' shadow choice. Both filters use one map fitted to the board.
 * @param renderer - Engine renderer.
 * @param value - Active graphics settings.
 */
export function applyChessShadowMode(renderer: ChessShadowRenderer, value: ChessGraphicsSettings): void {
  if (value.shadowMode === 'off') {
    renderer.shadowsEnabled = false;
    return;
  }
  renderer.shadowsEnabled = true;
  renderer.shadowFilter = value.shadowMode === 'hard' ? 'hard' : 'soft';
  renderer.csmCascadeCount = 1;
  renderer.csmFit = 'extent';
  renderer.csmCascadeSplits = BOARD_SHADOW_SPLITS;
}

export const FLUID_GRAPHICS: ChessGraphicsSettings = {
  resolution: '1080',
  textureQuality: 'low',
  shadows: true,
  shadowMode: 'hard',
  upscale: 'off',
  ambientOcclusion: false,
  reflections: false,
  bloom: false,
  antialiasing: true,
  volume: false,
  dof: false,
  reflectionProbes: false,
  coachOutline: true,
  sceneLife: true,
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
      shadowMode: 'soft',
      upscale: 'off',
      ambientOcclusion: false,
      reflections: false,
      bloom: true,
      antialiasing: true,


      volume: false,
      dof: false,
      reflectionProbes: false,
      coachOutline: true,
      sceneLife: true,
    },
  },
  {
    id: 'qualite',
    title: 'Qualité',
      blurb: '4K upscalé, textures 1024',
      settings: {
      resolution: '2160',
      textureQuality: 'high',
      shadows: true,
      shadowMode: 'soft',
      upscale: 'quality',
      ambientOcclusion: true,
      reflections: true,
      bloom: true,
      antialiasing: true,
      volume: true,
      dof: true,
      reflectionProbes: true,
      coachOutline: true,
      sceneLife: true,
    },
  },
  {
    id: 'natif',
    title: 'Natif',
      blurb: 'Écran natif upscalé, textures 1024',
      settings: {
      resolution: 'native',
      textureQuality: 'high',
      shadows: true,
      shadowMode: 'soft',
      upscale: 'quality',
      ambientOcclusion: true,
      reflections: true,
      bloom: true,
      antialiasing: true,
      volume: true,
      dof: true,
      reflectionProbes: true,
      coachOutline: true,
      sceneLife: true,
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
let appliedUpscale: ChessUpscale = settings.upscale;
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
 * The ring marks the piece that moves, so every look keeps it.
 * A saved fluid profile stored `false` when that preset used to omit the passes.
 * @param parsed - Partial settings read from storage.
 */
export function coachOutlineFromStored(parsed: Partial<ChessGraphicsSettings>): boolean {
  if (parsed.coachOutline === true) return true;
  if (parsed.coachOutline === false) {
    return (
      parsed.resolution === '1080' &&
      parsed.ambientOcclusion !== true &&
      parsed.reflections !== true &&
      parsed.bloom !== true
    );
  }
  return true;
}

/** Written once the player picks a preset. Older saves open on the review finish. */
const GRAPHICS_FINISH = 1;

function reviewFinish(): ChessGraphicsSettings {
  const quality = GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite')?.settings;
  return { ...(quality ?? FLUID_GRAPHICS) };
}

/**
 * Profile a match opens on. No save, or a save from before the review finish,
 * uses Qualité. A later choice, including Fluide, is kept.
 * @param raw - Stored JSON, or null when nothing was saved.
 * @returns Settings to render with.
 */
export function graphicsFromStored(raw: string | null): ChessGraphicsSettings {
  if (!raw) return reviewFinish();
  try {
    const parsed = JSON.parse(raw) as Partial<ChessGraphicsSettings> & { finish?: number };
    if (parsed.finish !== GRAPHICS_FINISH || !isResolution(parsed.resolution)) return reviewFinish();
    const shadowMode = shadowModeFromStored(parsed);
    return {
      resolution: parsed.resolution,
      textureQuality: isTextureQuality(parsed.textureQuality)
        ? parsed.textureQuality
        : textureQualityForResolution(parsed.resolution),
      shadows: shadowMode !== 'off',
      shadowMode,
      upscale: upscaleFromStored(parsed),
      ambientOcclusion: parsed.ambientOcclusion === true,
      reflections: parsed.reflections === true,
      bloom: parsed.bloom === true,
      antialiasing: parsed.antialiasing !== false,
      volume: parsed.volume === true,
      dof: parsed.dof === true,
      reflectionProbes: parsed.reflectionProbes === true,
      coachOutline: coachOutlineFromStored(parsed),
      sceneLife: true,
    };
  } catch {
    return reviewFinish();
  }
}

function readStoredSettings(): ChessGraphicsSettings {
  try {
    return graphicsFromStored(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return graphicsFromStored(null);
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
    a.shadowMode === b.shadowMode &&
    a.upscale === b.upscale &&
    a.ambientOcclusion === b.ambientOcclusion &&
    a.reflections === b.reflections &&
    a.bloom === b.bloom &&
    a.antialiasing === b.antialiasing &&
    a.volume === b.volume &&
    a.dof === b.dof &&
    a.reflectionProbes === b.reflectionProbes &&
    a.coachOutline === b.coachOutline &&
    a.sceneLife === b.sceneLife
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
  if (value.volume) names.push('09_Fog', '09b_FogComposite');
  if (value.dof) names.push('10_DoF');
  if (value.antialiasing) names.push('07_FXAA');
  if (value.coachOutline) names.push('04e_CoachMask', '04f_CoachCutout');
  names.push('08_Upscale');
  return names;
}

function bindChessPasses(engine: Engine, value: ChessGraphicsSettings): void {
  engine.setGameActivePasses(gamePassNames(value));
  engine.renderer.setShadowMapSize(shadowMapSize(value.shadowMode));
  applyChessShadowMode(engine.renderer, value);
  for (const row of engine.ecsWorld.query([DirectionalLightComponent]).iter()) {
    const light = row[1][0] as DirectionalLightComponent;
    light.shadowsEnabled = value.shadowMode !== 'off';
  }
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
  bindChessPasses(engine, value);
  if (value.upscale === appliedUpscale) return;
  appliedUpscale = value.upscale;
  void engine.reloadGameRenderGraph().then(() => {
    bindChessPasses(engine, value);
  });
}

export function attachChessGraphics(engine: Engine, canvas: HTMLCanvasElement): void {
  target = { engine, canvas };
  applyChessGraphics(engine, canvas, settings);
}

export function registerPieceTextureReloader(reload: (quality: ChessTextureQuality) => void): void {
  reloadPieceTextures = reload;
}

/**
 * Uses a profile for this window only. Nothing is written, so the stored game profile
 * is untouched. The ambiance review judges a room this way.
 * @param next - Profile to render with.
 */
export function useChessGraphicsSettings(next: ChessGraphicsSettings): void {
  const texturesChanged = next.textureQuality !== settings.textureQuality;
  settings = next;
  if (target) applyChessGraphics(target.engine, target.canvas, settings);
  if (texturesChanged) reloadPieceTextures?.(settings.textureQuality);
  for (const listener of listeners) listener(settings);
}

export function setChessGraphicsSettings(next: ChessGraphicsSettings): void {
  try {
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...next, finish: GRAPHICS_FINISH })
    );
  } catch {
    /* private mode */
  }
  useChessGraphicsSettings(next);
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
