/**
 * @file graphicsBench.test.ts
 * @description Graphics bench combinations, dedupe, and the launch contract.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLUID_GRAPHICS,
  GRAPHICS_PRESETS,
  matchingGraphicsPreset,
} from '../src/renderer/graphics/chessGraphicsSettings';
import {
  GRAPHICS_BENCH_SAMPLE_FRAMES,
  GRAPHICS_BENCH_WARMUP_FRAMES,
  GRAPHICS_BENCH_WINDOWS,
  GRAPHICS_MOTION_WINDOWS,
  collectGraphicsBench,
  enumerateGraphicsConfigurations,
  graphicsBenchKey,
  graphicsBenchPoseFailed,
  graphicsBenchClockAdvanced,
  graphicsBenchVsyncCapped,
  createBenchFrameClock,
  steadyPassMs,
  takeBenchProbe,
  uniqueGraphicsBenchSettings,
} from '../src/renderer/graphics/graphicsBench';
import {
  GRAPHICS_BENCH_CHROMIUM_FLAGS,
  graphicsBenchLaunch,
} from '../src/main/graphicsBenchLaunch';

describe('graphics bench combinations', () => {
  it('lists every resolution, texture and toggle once', () => {
    const rows = enumerateGraphicsConfigurations();
    expect(rows).toHaveLength(4 * 3 * 3 * 64);
    const keys = new Set(rows.map((row) => JSON.stringify(row)));
    expect(keys.size).toBe(rows.length);
    expect(rows.some((row) => row.antialiasing === false)).toBe(true);
  });

  it('keeps one framebuffer for every resolution on a 1080p window', () => {
    const rows = enumerateGraphicsConfigurations().filter(
      (row) =>
        row.textureQuality === 'low' &&
        row.shadows &&
        !row.ambientOcclusion &&
        !row.reflections &&
        !row.bloom &&
        row.antialiasing &&
        !row.coachOutline
    );
    const surfaces = new Set(rows.map((row) => graphicsBenchKey(row, 1920, 1080, 1).split('|')[0]));
    expect(surfaces.size).toBe(1);
  });

  it('shares a key when the surface, passes and texture size match', () => {
    const wide = { ...FLUID_GRAPHICS, resolution: '1440' as const };
    const native = { ...FLUID_GRAPHICS, resolution: 'native' as const };
    expect(graphicsBenchKey(wide, 1920, 1080, 1)).toBe(graphicsBenchKey(native, 1920, 1080, 1));
    expect(graphicsBenchKey(wide, 1920, 1080, 1)).not.toBe(
      graphicsBenchKey({ ...wide, shadows: false }, 1920, 1080, 1)
    );
    expect(graphicsBenchKey(wide, 1920, 1080, 1)).not.toBe(
      graphicsBenchKey({ ...wide, upscale: 'quality' }, 1920, 1080, 1)
    );
  });

  it('does not launch Electron or write a file', () => {
    const source = readFileSync(
      new URL('../src/renderer/graphics/graphicsBench.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toContain('electron');
    expect(source).not.toContain('writeFile');
  });

  it('measures each cost once on a 1080p window', () => {
    const unique = uniqueGraphicsBenchSettings(1920, 1080, 1);
    expect(unique.length).toBe(3 * 3 * 64);
  });
});

describe('graphics bench campaign', () => {
  it('waits about 45 frames then takes the median of about 90', async () => {
    let frames = 0;
    const median = await takeBenchProbe(
      async () => {
        frames += 1;
      },
      () => frames
    );
    expect(GRAPHICS_BENCH_WARMUP_FRAMES).toBe(45);
    expect(GRAPHICS_BENCH_SAMPLE_FRAMES).toBe(90);
    expect(frames).toBe(135);
    expect(median).toBe(90);
  });

  it('does not treat a zero clock as a capped present', async () => {
    const report = await collectGraphicsBench('rest', 1920, 1080, 1, {
      async apply() {},
      async sample() {
        return probe(0);
      },
      setMotion() {},
      pose: () => null,
    });
    expect(report.stopped).toBe('unready');
  });

  it('drops a pass sample that cannot fit in the frame', () => {
    expect(steadyPassMs({ '01_Shadows': 0.2, '04b_HBAO': 757 }, 1.93)).toEqual({ '01_Shadows': 0.2 });
    expect(steadyPassMs({ '01_Shadows': 0.2 }, 0)).toEqual({});
  });

  it('requires a new engine frame during the sample', () => {
    expect(graphicsBenchClockAdvanced(10, 10)).toBe(false);
    expect(graphicsBenchClockAdvanced(10, 12)).toBe(true);
  });

  it('presets pass records only the four named looks', async () => {
    const report = await collectGraphicsBench('presets', 1920, 1080, 1, {
      async apply() {},
      async sample() {
        return probe(5);
      },
      setMotion() {},
      pose: () => null,
    });
    expect(report.stopped).toBeUndefined();
    expect(report.rows).toHaveLength(4);
    expect(report.rows.map((row) => matchingGraphicsPreset(row.settings))).toEqual([
      'fluide',
      'equilibre',
      'qualite',
      'natif',
    ]);
  });

  it('stops only when matched fluid and quality sit on a display period', async () => {
    expect(graphicsBenchVsyncCapped(16.7, 16.7)).toBe(true);
    expect(graphicsBenchVsyncCapped(10, 10)).toBe(true);
    expect(graphicsBenchVsyncCapped(4.2, 11.8)).toBe(false);
    // Fast GPU: Fluide and Qualité can share a CPU-bound slice without a vsync cap.
    expect(graphicsBenchVsyncCapped(7.3, 7.4)).toBe(false);
    const report = await collectGraphicsBench('rest', 1920, 1080, 1, {
      async apply() {},
      async sample() {
        return probe(16.7);
      },
      setMotion() {},
      pose: () => null,
    });
    expect(report.stopped).toBe('vsync');
    expect(report.rows).toEqual([]);
  });

  it('copies one measurement onto every combination with the same key', async () => {
    const seen = new Set<string>();
    const report = await collectGraphicsBench('rest', 1920, 1080, 1, {
      async apply(settings) {
        seen.add(graphicsBenchKey(settings, 1920, 1080, 1));
      },
      async sample() {
        return probe(seen.size);
      },
      setMotion() {},
      pose: () => null,
    });
    expect(report.stopped).toBeUndefined();
    expect(report.rows).toHaveLength(4 * 3 * 3 * 64);
    // Qualité adds fog and depth of field. The matrix leaves both off, so that look is measured once more.
    expect(seen.size).toBe(3 * 3 * 64 + 1);
    const aliased = report.rows.filter((row) => !row.measured);
    expect(aliased.length).toBeGreaterThan(0);
    expect(aliased.every((row) => row.frameTimeMs > 0)).toBe(true);
  });

  it('walks the five desktop sizes and the three motion sizes', () => {
    expect(GRAPHICS_BENCH_WINDOWS).toEqual([
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
      { width: 3440, height: 1440 },
      { width: 3840, height: 2160 },
    ]);
    expect(GRAPHICS_MOTION_WINDOWS).toEqual([
      { width: 1920, height: 1080 },
      { width: 3440, height: 1440 },
      { width: 3840, height: 2160 },
    ]);
  });

  it('measures presets and a shadowless quality look in three motion states', async () => {
    const motions: string[] = [];
    const report = await collectGraphicsBench('motion', 3440, 1440, 1, {
      async apply() {},
      async sample() {
        return probe(motions.length + 1, { '01_Shadows': 0.4 });
      },
      setMotion(state) {
        motions.push(state);
      },
      pose: () => ({ position: [0, 0.04, 0], rotation: [0, 0, 0, 1] }),
    });
    expect(report.rows).toHaveLength(0);
    expect(report.motion).toHaveLength(15);
    expect(new Set(report.motion.map((row) => row.id))).toEqual(
      new Set(['fluide', 'equilibre', 'qualite', 'natif', 'qualite-sans-ombres'])
    );
    expect(report.motion.filter((row) => row.state === 'flight')).toHaveLength(5);
    const bare = report.motion.find((row) => row.id === 'qualite-sans-ombres' && row.state === 'idle');
    expect(bare?.settings.shadows).toBe(false);
    expect(GRAPHICS_PRESETS).toHaveLength(4);
    const flight = report.motion.find((row) => row.id === 'fluide' && row.state === 'flight');
    expect(flight?.deltaMs).toBe(1);
    expect(flight?.shadowMs).toBe(0.4);
    expect(motions.filter((state) => state === 'grab').length).toBe(5);
  });

  it('records a broken pose as a failed line without a frame time', async () => {
    const report = await collectGraphicsBench('motion', 1920, 1080, 1, {
      async apply() {},
      async sample() {
        return probe(8);
      },
      setMotion() {},
      pose: () => ({ position: [Number.NaN, 0, 0], rotation: [0, 0, 0, 1] }),
    });
    expect(graphicsBenchPoseFailed([Number.NaN, 0, 0], [0, 0, 0, 1])).toBe(true);
    expect(graphicsBenchPoseFailed([0, 2, 0], [0, 0, 0, 1])).toBe(true);
    expect(graphicsBenchPoseFailed([0, 0.04, 0], [0.7, 0, 0, 0.7])).toBe(true);
    expect(graphicsBenchPoseFailed([0, 0.04, 0], [0, 0, 0, 1])).toBe(false);
    expect(report.motion.every((row) => row.pose === 'failed' && row.frameTimeMs === null)).toBe(true);
  });
});

describe('graphics bench launch', () => {
  it('opens the bench query at the imposed size and does not save the bounds', () => {
    expect(graphicsBenchLaunch({})).toBeNull();
    expect(
      graphicsBenchLaunch({
        CHESS_GRAPHICS_BENCH: '1',
        CHESS_BENCH_WIDTH: '1920',
        CHESS_BENCH_HEIGHT: '1080',
        CHESS_BENCH_PASS: 'motion',
      })
    ).toEqual({
      search: 'bench=graphics&benchPass=motion&chess=hotseat',
      width: 1920,
      height: 1080,
      persistBounds: false,
      userDataDir: 'tmp/bench-userdata',
    });
    expect(
      graphicsBenchLaunch({
        CHESS_GRAPHICS_BENCH: '1',
        CHESS_BENCH_WIDTH: '1920',
        CHESS_BENCH_HEIGHT: '1080',
        CHESS_BENCH_PASS: 'presets',
      })?.search
    ).toBe('bench=graphics&benchPass=presets&chess=hotseat');
  });

  it('does not pass the switch that kills the GPU command buffer', () => {
    expect(GRAPHICS_BENCH_CHROMIUM_FLAGS).toEqual(['--disable-gpu-vsync']);
  });

  it('times a frame until the GPU queue finishes and ignores a sync callback', async () => {
    const releases: Array<() => void> = [];
    const device = {
      queue: {
        onSubmittedWorkDone: () => new Promise<void>((resolve) => releases.push(resolve)),
      },
    } as GPUDevice;
    const queued: FrameRequestCallback[] = [];
    let nowMs = 0;
    const clock = createBenchFrameClock(
      device,
      ((callback: FrameRequestCallback) => {
        queued.push(callback);
        return queued.length;
      }) as typeof requestAnimationFrame,
      () => nowMs
    );
    clock.requestFrame(() => undefined);
    queued[0]!(0);
    await flushPromises();
    expect(releases).toHaveLength(0);

    const durations = [4, 10, 6];
    const median = await clock.takeWorkMedian(1, 2, async () => {
      const duration = durations.shift();
      if (duration === undefined) return;
      let releaseFrame: () => void = () => {};
      clock.requestFrame(() => new Promise<void>((resolve) => {
        releaseFrame = resolve;
      }));
      queued[queued.length - 1]!(0);
      nowMs += duration;
      releaseFrame();
      await flushPromises();
      releases.shift()?.();
      await flushPromises();
    });
    expect(median).toBe(6);
  });

  it('records a frame when the GPU queue rejects', async () => {
    const device = {
      queue: {
        onSubmittedWorkDone: () => Promise.reject(new Error('lost')),
      },
    } as GPUDevice;
    const queued: FrameRequestCallback[] = [];
    let nowMs = 0;
    const clock = createBenchFrameClock(
      device,
      ((callback: FrameRequestCallback) => {
        queued.push(callback);
        return queued.length;
      }) as typeof requestAnimationFrame,
      () => nowMs
    );
    const median = await clock.takeWorkMedian(0, 1, async () => {
      let releaseFrame: () => void = () => {};
      clock.requestFrame(() => new Promise<void>((resolve) => {
        releaseFrame = resolve;
      }));
      queued[queued.length - 1]!(0);
      nowMs += 3;
      releaseFrame();
      await flushPromises();
    });
    expect(median).toBe(3);
  });

  it('arms those switches before the window opens', () => {
    const source = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
    const arm = source.indexOf('appendSwitch');
    const open = source.indexOf('app.whenReady');
    expect(arm).toBeGreaterThan(-1);
    expect(arm).toBeLessThan(open);
    expect(source.indexOf("setPath('userData'")).toBeGreaterThan(-1);
    expect(source.indexOf("setPath('userData'")).toBeLessThan(open);
    expect(source).toContain('child-process-gone');
    expect(source).toContain('graphicsBenchLaunch');
  });

  it('paces frames to the GPU before the engine loop starts', () => {
    const source = readFileSync(new URL('../src/renderer/startChessHost.ts', import.meta.url), 'utf8');
    const pace = source.indexOf('paceBenchFramesToGpu');
    const start = source.indexOf("engine.start('ChessDemoProject')");
    expect(pace).toBeGreaterThan(-1);
    expect(pace).toBeLessThan(start);
  });
});

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function probe(frameTimeMs: number, passMs: Record<string, number> = {}): {
  frameTimeMs: number;
  framesPerSecond: number;
  drawCalls: number;
  triangles: number;
  passMs: Record<string, number>;
  gpuMemoryBytes: number;
} {
  return {
    frameTimeMs,
    framesPerSecond: 60,
    drawCalls: 10,
    triangles: 1000,
    passMs,
    gpuMemoryBytes: 0,
  };
}
