/**
 * @file chessGraphics.test.ts
 * @description Internal resolution caps and which post passes stay enabled.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLUID_GRAPHICS,
  GRAPHICS_PRESETS,
  applyChessGraphics,
  applyChessShadowMode,
  coachOutlineFromStored,
  gamePassNames,
  gameSurfacePixels,
  matchingGraphicsPreset,
  pieceTextureSize,
  scaleChessGraphResources,
  shadowMapSize,
  shadowModeFromStored,
  upscaleFromStored,
  upscaleRenderScale,
  upscaleSharpness,
} from '../src/renderer/graphics/chessGraphicsSettings';

interface ChessGraphJson {
  resources: { name: string; sizeType: string; width: number; height: number }[];
  passes: {
    name: string;
    inputs?: string[];
    outputs?: string[];
    shaderPath?: string;
    outputFormat?: string;
    uniforms?: Record<string, { value: number }>;
  }[];
}

function chessGraph(): ChessGraphJson {
  return JSON.parse(
    readFileSync(new URL('../public/graphs/StandardLitGraphChess.json', import.meta.url), 'utf8')
  ) as ChessGraphJson;
}

describe('chess graphics', () => {
  it('keeps each light record the same length as the engine buffer', () => {
    const shell = readFileSync(
      new URL('../public/shaders/graph_templates/main_shader.wgsl', import.meta.url),
      'utf8'
    );
    const shared = readFileSync(
      new URL('../public/shaders/shared/structs.wgsl', import.meta.url),
      'utf8'
    );
    // Core 0.0.37 appends tangentAndShape. Without it the spots start four floats early and the room goes black.
    for (const source of [shell, shared]) {
      const body = source.slice(source.indexOf('struct LightData'), source.indexOf('struct LightBuffer') > -1
        ? source.indexOf('struct LightBuffer')
        : source.indexOf('struct SceneLights'));
      expect(body).toContain('tangentAndShape');
    }
  });

  it('cuts bloom near the tone mapper white point, on a floating point chain', () => {
    const graph = JSON.parse(
      readFileSync(new URL('../public/graphs/StandardLitGraphChess.json', import.meta.url), 'utf8')
    ) as {
      resources: { name: string; format: string }[];
      passes: { name: string; uniforms?: Record<string, { value: number }> }[];
    };
    const threshold = graph.passes.find((pass) => pass.name === '06_Bright')?.uniforms?.threshold;
    // ACES is already within a few percent of white at 2.0, so a cut above that can never glow.
    expect(threshold?.value).toBeLessThanOrEqual(2);
    expect(threshold?.value).toBeGreaterThan(0.5);
    // The excess only reaches the bright pass while the chain stays floating point.
    const formats = new Map(graph.resources.map((resource) => [resource.name, resource.format]));
    for (const name of ['sceneColor', 'sceneColorSsr', 'bloomTexture', 'bloomScene']) {
      expect(formats.get(name)).toBe('rgba16float');
    }
  });

  it('blooms emissive pixels and leaves specular highlights under the cut', () => {
    const graph = JSON.parse(
      readFileSync(new URL('../public/graphs/StandardLitGraphChess.json', import.meta.url), 'utf8')
    ) as {
      passes: {
        name: string;
        inputs?: string[];
        uniforms?: Record<string, { value: number }>;
      }[];
    };
    const bright = graph.passes.find((pass) => pass.name === '06_Bright');
    // The bright pass must read the opaque target. Later copies force alpha back to 1.
    expect(bright?.inputs).toEqual(['sceneColor']);
    // Opaque pixels store exactly 1. Emissive peaks above that are the only bloom source.
    expect(bright?.uniforms?.threshold?.value).toBe(1);
    const radius = graph.passes.find((pass) => pass.name === '06b_BlurH')?.uniforms?.radius?.value;
    const radiusV = graph.passes.find((pass) => pass.name === '06c_BlurV')?.uniforms?.radius?.value;
    // Wide enough to read as a halo, tight enough that a one-texel kernel stays on the source.
    expect(radius).toBeGreaterThan(1.5);
    expect(radius).toBeLessThanOrEqual(4);
    expect(radiusV).toBe(radius);
    const blurH = readFileSync(
      new URL('../public/shaders/post-processing/blur_h.frag.wgsl', import.meta.url),
      'utf8'
    );
    const blurV = readFileSync(
      new URL('../public/shaders/post-processing/blur_v.frag.wgsl', import.meta.url),
      'utf8'
    );
    // Spacing the five taps by the radius stamps a copy of the neon at each tap: the grid.
    expect(blurH).not.toContain('f32(i) * radius');
    expect(blurV).not.toContain('f32(i) * radius');

    const brightShader = readFileSync(
      new URL('../public/shaders/post-processing/bright.frag.wgsl', import.meta.url),
      'utf8'
    );
    expect(brightShader).toContain('color.a');
    const shell = readFileSync(
      new URL('../public/shaders/graph_templates/main_shader.wgsl', import.meta.url),
      'utf8'
    );
    expect(shell).toContain('final_alpha <= 1.0');
    const pbr = readFileSync(
      new URL('../public/shaders/graph_templates/pbr_master_node.wgsl', import.meta.url),
      'utf8'
    );
    expect(pbr).toContain('emission_peak');
  });

  it('gives the coach mask its own depth so the piece cannot hide the shell', () => {
    const graph = JSON.parse(
      readFileSync(new URL('../public/graphs/StandardLitGraphChess.json', import.meta.url), 'utf8')
    ) as {
      resources: { name: string; format: string }[];
      passes: { name: string; inputs?: string[]; outputs?: string[]; depthLoadOp?: string }[];
    };
    const mask = graph.passes.find((pass) => pass.name === '04e_CoachMask');
    const formats = new Map(graph.resources.map((resource) => [resource.name, resource.format]));
    // The lit shell writes a normal at location 1, so the mask needs that second target.
    // Scene depth rejects the shell: it sits on the piece. A cleared depth of its own lets it draw.
    expect(mask?.inputs ?? []).not.toContain('sceneDepth');
    expect(mask?.outputs).toEqual(['coachMask', 'coachMaskNormal', 'coachMaskDepth']);
    expect(mask?.depthLoadOp).toBe('clear');
    expect(formats.get('coachMask')).toBe('rgba16float');
    expect(formats.get('coachMaskNormal')).toBe('rgba8unorm');
    expect(formats.get('coachMaskDepth')).toBe('depth24plus');
  });

  it('draws a coach ring wide enough to read around a piece', () => {
    const shader = readFileSync(
      new URL('../public/shaders/post-processing/coach_cutout.frag.wgsl', import.meta.url),
      'utf8'
    );
    expect(shader).toContain('dist > 64.0');
    expect(shader).toContain('y <= 8');
  });

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

  it('draws the coach silhouette on the fluid preset', () => {
    const names = gamePassNames(FLUID_GRAPHICS);
    expect(names).toContain('04e_CoachMask');
    expect(names).toContain('04f_CoachCutout');
    expect(FLUID_GRAPHICS.coachOutline).toBe(true);
  });

  it('gates antialiasing on its own flag', () => {
    for (const preset of GRAPHICS_PRESETS) expect(preset.settings.antialiasing).toBe(true);
    expect(gamePassNames(FLUID_GRAPHICS)).toContain('07_FXAA');
    expect(gamePassNames({ ...FLUID_GRAPHICS, antialiasing: false })).not.toContain('07_FXAA');
  });

  it('enables the heavy passes for the quality preset', () => {
    const quality = GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite');
    expect(quality).toBeDefined();
    const names = gamePassNames(quality!.settings);
    expect(names).toEqual(
      expect.arrayContaining([
        '04d_HBAO_Apply',
        '04e_CoachMask',
        '04f_CoachCutout',
        '05b_SSR_Composite',
        '06d_BloomAdd',
      ])
    );
    const balanced = GRAPHICS_PRESETS.find((preset) => preset.id === 'equilibre');
    expect(gamePassNames(balanced!.settings)).toEqual(
      expect.arrayContaining(['04e_CoachMask', '04f_CoachCutout'])
    );
    expect(matchingGraphicsPreset(quality!.settings)).toBe('qualite');
  });

  it('turns the silhouette on for a saved higher look that predates the flag', () => {
    expect(
      coachOutlineFromStored({
        resolution: 'native',
        ambientOcclusion: true,
        reflections: false,
        bloom: false,
      })
    ).toBe(true);
  });

  it('turns the silhouette on for a saved fluid look', () => {
    expect(
      coachOutlineFromStored({
        resolution: '1080',
        ambientOcclusion: false,
        reflections: false,
        bloom: false,
      })
    ).toBe(true);
    expect(
      coachOutlineFromStored({
        resolution: '1080',
        ambientOcclusion: false,
        reflections: false,
        bloom: false,
        coachOutline: false,
      })
    ).toBe(true);
  });

  it('fits one board layer and only changes the shadow filter', () => {
    const renderer = {
      shadowsEnabled: false,
      shadowFilter: 'soft' as 'hard' | 'soft',
      csmCascadeCount: 4,
      csmFit: 'frustum' as 'frustum' | 'extent',
      csmCascadeSplits: null as [number, number, number, number] | null,
    };
    const contact: [number, number, number, number] = [1.2, 1.2, 1.2, 24];
    applyChessShadowMode(renderer, { ...FLUID_GRAPHICS, shadowMode: 'hard', shadows: true });
    expect(renderer.shadowsEnabled).toBe(true);
    expect(renderer.shadowFilter).toBe('hard');
    expect(renderer.csmCascadeCount).toBe(1);
    expect(renderer.csmFit).toBe('extent');
    expect(renderer.csmCascadeSplits).toEqual(contact);

    applyChessShadowMode(renderer, { ...FLUID_GRAPHICS, shadowMode: 'soft', shadows: true });
    expect(renderer.shadowFilter).toBe('soft');
    expect(renderer.csmCascadeCount).toBe(1);
    expect(renderer.csmFit).toBe('extent');
    expect(renderer.csmCascadeSplits).toEqual(contact);

    applyChessShadowMode(renderer, { ...FLUID_GRAPHICS, shadowMode: 'off', shadows: false });
    expect(renderer.shadowsEnabled).toBe(false);
    expect(gamePassNames({ ...FLUID_GRAPHICS, shadowMode: 'off', shadows: false })).not.toContain(
      '01_Shadows'
    );
  });

  it('keeps hard shadows on fluid and soft shadows on the higher presets', () => {
    expect(FLUID_GRAPHICS.shadowMode).toBe('hard');
    expect(FLUID_GRAPHICS.shadows).toBe(true);
    expect(FLUID_GRAPHICS.ambientOcclusion).toBe(false);
    expect(FLUID_GRAPHICS.reflections).toBe(false);
    expect(FLUID_GRAPHICS.bloom).toBe(false);
    expect(GRAPHICS_PRESETS.find((preset) => preset.id === 'fluide')?.settings.shadowMode).toBe('hard');
    for (const id of ['equilibre', 'qualite', 'natif']) {
      expect(GRAPHICS_PRESETS.find((preset) => preset.id === id)?.settings.shadowMode).toBe('soft');
    }
  });

  it('reads a saved cascade profile as soft shadows', () => {
    expect(shadowModeFromStored({ shadowMode: 'cascade' })).toBe('soft');
    expect(shadowModeFromStored({ shadowMode: 'soft' })).toBe('soft');
    expect(shadowModeFromStored({ shadowMode: 'hard' })).toBe('hard');
    expect(shadowModeFromStored({ shadows: false })).toBe('off');
  });

  it('sizes the shadow atlas with the filter', () => {
    expect(shadowMapSize('hard')).toBe(1024);
    expect(shadowMapSize('soft')).toBe(2048);
  });

  it('rebuilds the shadow atlas when the mode changes', () => {
    const sizes: number[] = [];
    const canvas = { clientWidth: 0, clientHeight: 0 } as HTMLCanvasElement;
    const engine = {
      setGameViewSurfaceSize() {},
      setGameActivePasses() {},
      renderer: {
        setShadowMapSize(size: number) {
          sizes.push(size);
        },
        shadowsEnabled: false,
        shadowFilter: 'hard' as const,
        csmCascadeCount: 1,
        csmFit: 'extent' as const,
        csmCascadeSplits: null,
      },
      ecsWorld: { query: () => ({ iter: () => [] as unknown[] }) },
    };
    const previous = globalThis.window;
    globalThis.window = { devicePixelRatio: 1 } as Window & typeof globalThis;
    try {
      applyChessGraphics(engine as never, canvas, { ...FLUID_GRAPHICS, shadowMode: 'soft' });
    } finally {
      globalThis.window = previous;
    }
    expect(sizes).toEqual([2048]);
  });

  it('builds the match shadow atlas from the active mode', () => {
    const source = readFileSync(
      new URL('../src/renderer/host/ChessDemoProject.ts', import.meta.url),
      'utf8'
    );
    expect(source).toContain('setShadowMapSize(shadowMapSize(');
    expect(source).not.toContain('CHESS_SHADOW_MAP_SIZE');
  });

  it('renders under the canvas on the two upscale steps', () => {
    expect(upscaleRenderScale('off')).toBe(1);
    expect(upscaleRenderScale('quality')).toBeCloseTo(2 / 3, 6);
    expect(upscaleRenderScale('performance')).toBe(0.5);
    // Sharpening a one to one image would only add a halo.
    expect(upscaleSharpness('off')).toBe(0);
    expect(upscaleSharpness('quality')).toBeGreaterThan(0);
  });

  it('scales the relative targets and leaves the shadow atlas alone', () => {
    const scaled = new Map(
      scaleChessGraphResources(chessGraph().resources, 0.5).map((resource) => [resource.name, resource])
    );
    expect(scaled.get('sceneColor')?.width).toBe(0.5);
    expect(scaled.get('sceneDepth')?.height).toBe(0.5);
    // An absolute size is a texel count, not a fraction of the canvas.
    expect(scaled.get('shadowMap')?.width).toBe(2048);
    // The engine recreates any relative target at FINAL_OUTPUT size unless it stays under one.
    for (const resource of scaled.values()) {
      if (resource.sizeType !== 'relative') continue;
      expect(resource.width).toBeLessThan(1);
      expect(resource.height).toBeLessThan(1);
    }
  });

  it('keeps occlusion and reflections at half of the render scale', () => {
    const source = new Map(chessGraph().resources.map((resource) => [resource.name, resource]));
    const scaled = new Map(
      scaleChessGraphResources(chessGraph().resources, 0.5).map((resource) => [resource.name, resource])
    );
    for (const name of ['hbaoRaw', 'hbaoBlurred', 'ssrBuffer']) {
      expect(source.get(name)?.width).toBe(0.5);
      expect(scaled.get(name)?.width).toBe(0.25);
    }
  });

  it('leaves the graph untouched when nothing is upscaled', () => {
    const resources = chessGraph().resources;
    expect(scaleChessGraphResources(resources, 1)).toEqual(resources);
  });

  it('always writes the final image through the upscale pass', () => {
    expect(gamePassNames(FLUID_GRAPHICS)).toContain('08_Upscale');
    expect(gamePassNames({ ...FLUID_GRAPHICS, antialiasing: false })).toContain('08_Upscale');
  });

  it('sends the antialiased image to the upscale pass, not to the canvas', () => {
    const graph = chessGraph();
    const formats = new Map(
      chessGraph().resources.map((resource) => [resource.name, resource.sizeType])
    );
    expect(formats.get('ldrAntialiased')).toBe('relative');
    expect(graph.passes.find((pass) => pass.name === '07_FXAA')?.outputs).toEqual(['ldrAntialiased']);
    const upscale = graph.passes.at(-1);
    expect(upscale?.name).toBe('08_Upscale');
    expect(upscale?.inputs).toEqual(['ldrAntialiased']);
    expect(upscale?.outputs).toEqual(['FINAL_OUTPUT']);
    expect(upscale?.shaderPath).toBe('/shaders/post-processing/spatial_upscale.frag.wgsl');
    expect(upscale?.uniforms?.sharpness?.value).toBe(0);
    const fxaa = graph.passes.find((pass) => pass.name === '07_FXAA');
    // The executor assumes rgba16float unless the pass names its format. That mismatches ldrAntialiased.
    expect(fxaa?.outputFormat).toBe('rgba8unorm');
    const shader = readFileSync(
      new URL('../public/shaders/post-processing/spatial_upscale.frag.wgsl', import.meta.url),
      'utf8'
    );
    // Same convention as the bright pass: a bare scalar at binding 2.
    expect(shader).toContain('@group(0) @binding(2) var<uniform> sharpness: f32;');
  });

  it('narrows the occlusion blur to the half size map', () => {
    const blur = chessGraph().passes.find((pass) => pass.name === '04c_HBAO_Blur');
    expect((blur?.uniforms?.blurParams?.value as unknown as number[])[0]).toBe(6);
  });

  it('upscales the two 4K presets and nothing below', () => {
    expect(FLUID_GRAPHICS.upscale).toBe('off');
    for (const id of ['fluide', 'equilibre']) {
      expect(GRAPHICS_PRESETS.find((preset) => preset.id === id)?.settings.upscale).toBe('off');
    }
    for (const id of ['qualite', 'natif']) {
      expect(GRAPHICS_PRESETS.find((preset) => preset.id === id)?.settings.upscale).toBe('quality');
    }
    // Performance is a player choice, never a preset.
    for (const preset of GRAPHICS_PRESETS) expect(preset.settings.upscale).not.toBe('performance');
  });

  it('reads a saved profile with no upscale as off', () => {
    expect(upscaleFromStored({})).toBe('off');
    expect(upscaleFromStored({ upscale: 'quality' })).toBe('quality');
    expect(upscaleFromStored({ upscale: 'performance' })).toBe('performance');
    expect(upscaleFromStored({ upscale: 'fsr' })).toBe('off');
  });

  it('rebuilds the graph when the render scale changes, and puts the passes back', async () => {
    const passLists: string[][] = [];
    let reloads = 0;
    const canvas = { clientWidth: 0, clientHeight: 0 } as HTMLCanvasElement;
    const engine = {
      setGameViewSurfaceSize() {},
      setGameActivePasses(names: string[]) {
        passLists.push(names);
      },
      async reloadGameRenderGraph() {
        reloads += 1;
      },
      renderer: {
        setShadowMapSize() {},
        shadowsEnabled: false,
        shadowFilter: 'hard' as const,
        csmCascadeCount: 1,
        csmFit: 'extent' as const,
        csmCascadeSplits: null,
      },
      ecsWorld: { query: () => ({ iter: () => [] as unknown[] }) },
    };
    const previous = globalThis.window;
    globalThis.window = { devicePixelRatio: 1 } as Window & typeof globalThis;
    try {
      applyChessGraphics(engine as never, canvas, { ...FLUID_GRAPHICS, upscale: 'off' });
      expect(reloads).toBe(0);
      applyChessGraphics(engine as never, canvas, { ...FLUID_GRAPHICS, upscale: 'quality' });
    } finally {
      globalThis.window = previous;
    }
    expect(reloads).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    // The reload turns every pass back on, so the active list has to be written again.
    expect(passLists.length).toBe(3);
    expect(passLists.at(-1)).toContain('08_Upscale');
  });

  it('scales the match targets from the stored profile', () => {
    const source = readFileSync(
      new URL('../src/renderer/host/ChessDemoProject.ts', import.meta.url),
      'utf8'
    );
    expect(source.includes('scaleChessGraphResources')).toBe(true);
    expect(source.includes('registerResource')).toBe(true);
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
