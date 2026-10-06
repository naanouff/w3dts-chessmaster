/**
 * @file graphicsBench.ts
 * @description Combinations and sampling plan for the graphics bench.
 */

import {
  FLUID_GRAPHICS,
  GRAPHICS_PRESETS,
  gamePassNames,
  gameSurfacePixels,
  pieceTextureSize,
  upscaleRenderScale,
  type ChessGraphicsSettings,
  type ChessResolution,
  type ChessTextureQuality,
  type ChessUpscale,
} from './chessGraphicsSettings';

const RESOLUTIONS: ChessResolution[] = ['1080', '1440', '2160', 'native'];
const UPSCALES: ChessUpscale[] = ['off', 'quality', 'performance'];
const TEXTURES: ChessTextureQuality[] = ['low', 'medium', 'high'];
const FLAGS = [false, true] as const;

export const GRAPHICS_BENCH_WARMUP_FRAMES = 45;
export const GRAPHICS_BENCH_SAMPLE_FRAMES = 90;

export const GRAPHICS_BENCH_WINDOWS: { width: number; height: number }[] = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3440, height: 1440 },
  { width: 3840, height: 2160 },
];

export const GRAPHICS_MOTION_WINDOWS: { width: number; height: number }[] = [
  { width: 1920, height: 1080 },
  { width: 3440, height: 1440 },
  { width: 3840, height: 2160 },
];

export type GraphicsBenchMotion = 'idle' | 'flight' | 'grab';

export interface GraphicsBenchProbe {
  frameTimeMs: number;
  framesPerSecond: number;
  drawCalls: number;
  triangles: number;
  passMs: Record<string, number>;
  gpuMemoryBytes: number;
}

export interface GraphicsBenchRow {
  settings: ChessGraphicsSettings;
  key: string;
  measured: boolean;
  frameTimeMs: number;
  framesPerSecond: number;
  drawCalls: number;
  triangles: number;
  gpuMemoryBytes: number;
  surface: { width: number; height: number };
  passMs: Record<string, number>;
}

export interface GraphicsBenchMotionRow {
  id: string;
  state: GraphicsBenchMotion;
  settings: ChessGraphicsSettings;
  pose: 'ok' | 'failed';
  frameTimeMs: number | null;
  shadowMs: number | null;
  deltaMs: number | null;
}

export interface GraphicsBenchWindowReport {
  width: number;
  height: number;
  devicePixelRatio: number;
  stopped?: 'vsync' | 'unready';
  fluidMs?: number;
  qualityMs?: number;
  rows: GraphicsBenchRow[];
  motion: GraphicsBenchMotionRow[];
}

/**
 * Keeps pass samples that can sit inside the frame.
 * A longer sample is a leftover trace from an earlier frame, not the steady cost.
 * @param passMs - Last traced sample of each pass name.
 * @param frameTimeMs - Median frame time for the same sample.
 */
export function steadyPassMs(passMs: Record<string, number>, frameTimeMs: number): Record<string, number> {
  const steady: Record<string, number> = {};
  if (!(frameTimeMs > 0)) return steady;
  for (const [name, value] of Object.entries(passMs)) {
    if (value >= 0 && value <= frameTimeMs) steady[name] = value;
  }
  return steady;
}

/** True when the engine recorded a frame after `before`. */
export function graphicsBenchClockAdvanced(before: number, after: number): boolean {
  return Number.isFinite(before) && Number.isFinite(after) && after > before;
}

/**
 * Times the engine frame through GPU completion, and leaves the display present alone.
 * Sync callbacks, such as the shell clock, are not samples.
 * @param device - Device whose queue marks the end of a frame.
 * @param requestFrame - Host scheduler. Defaults to `requestAnimationFrame`.
 * @param now - Millisecond clock. Defaults to `performance.now`.
 * @returns Scheduler plus the median of the next completed frames.
 */
export function createBenchFrameClock(
  device: GPUDevice,
  requestFrame: typeof requestAnimationFrame = requestAnimationFrame,
  now: () => number = () => performance.now()
): BenchFrameClock {
  const work: number[] = [];
  const request: typeof requestAnimationFrame = (callback) =>
    requestFrame((time) => {
      const t0 = now();
      const result: unknown = (callback as (time: number) => unknown)(time);
      if (!isPromise(result)) return;
      void result.then(
        async () => {
          try {
            await device.queue.onSubmittedWorkDone();
          } catch {
            /* A lost queue still counts the frame, so the sampler can finish. */
          }
          work.push(now() - t0);
        },
        () => undefined
      );
    });
  return {
    requestFrame: request,
    async takeWorkMedian(warmup, samples, wait) {
      const from = work.length;
      const need = from + warmup + samples;
      const deadline = performance.now() + 30_000;
      while (work.length < need && performance.now() < deadline) await wait();
      const slice = work.slice(from + warmup, from + warmup + samples);
      if (slice.length < samples) return 0;
      slice.sort((a, b) => a - b);
      return slice[Math.floor((slice.length - 1) / 2)] ?? 0;
    },
  };
}

export interface BenchFrameClock {
  requestFrame: typeof requestAnimationFrame;
  /**
   * Median of the next completed engine frames.
   * Frames already stored belong to the previous setting and are left out.
   * @param warmup - Completed frames to skip.
   * @param samples - Completed frames in the median.
   * @param wait - Yields while the engine produces those frames.
   * @returns Median milliseconds, or 0 when the frames do not arrive.
   */
  takeWorkMedian(warmup: number, samples: number, wait: () => Promise<void>): Promise<number>;
}

let installedClock: BenchFrameClock | null = null;

/**
 * Installs the bench clock on this page.
 * @param device - Device whose queue marks the end of a frame.
 * @returns Scheduler the host assigns to `requestAnimationFrame`.
 */
export function paceBenchFramesToGpu(device: GPUDevice): typeof requestAnimationFrame {
  installedClock = createBenchFrameClock(device);
  return installedClock.requestFrame;
}

/**
 * Median GPU-queue time of the next engine frames on the installed clock.
 * @param warmup - Completed frames to skip.
 * @param samples - Completed frames in the median.
 * @param wait - Yields while the engine produces those frames.
 * @returns Median milliseconds, or 0 when the clock is absent or the frames do not arrive.
 */
export function takeInstalledBenchWorkMedian(
  warmup: number,
  samples: number,
  wait: () => Promise<void>
): Promise<number> {
  if (!installedClock) return Promise.resolve(0);
  return installedClock.takeWorkMedian(warmup, samples, wait);
}

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as Promise<unknown>).then === 'function';
}

/**
 * Copies the latest monitor readings. Pass times are the last traced sample of each name.
 * @param monitor - Engine performance monitor.
 */
export function readGraphicsBenchProbe(monitor: {
  getFrameTime(): number;
  getFPS(): number;
  getDrawCalls(): number;
  getVisibleTriangles(): number;
  getPassTimeHistory(): Map<string, { value: number }[]>;
  getMemoryHistory(): { gpu: { value: number }[] };
}): GraphicsBenchProbe {
  const passMs: Record<string, number> = {};
  for (const [name, points] of monitor.getPassTimeHistory()) {
    const last = points[points.length - 1];
    if (last) passMs[name] = last.value;
  }
  const gpu = monitor.getMemoryHistory().gpu;
  return {
    frameTimeMs: monitor.getFrameTime(),
    framesPerSecond: monitor.getFPS(),
    drawCalls: monitor.getDrawCalls(),
    triangles: monitor.getVisibleTriangles(),
    passMs,
    gpuMemoryBytes: gpu[gpu.length - 1]?.value ?? 0,
  };
}

export interface GraphicsBenchHooks {
  apply(settings: ChessGraphicsSettings): Promise<void>;
  sample(): Promise<GraphicsBenchProbe>;
  setMotion(state: GraphicsBenchMotion): void;
  pose(): {
    position: readonly [number, number, number];
    rotation: readonly [number, number, number, number];
  } | null;
}

/**
 * True when the page search asks for the graphics bench.
 * @param search - `location.search`, with or without the leading `?`.
 */
export function isGraphicsBenchSearch(search: string): boolean {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(raw).get('bench') === 'graphics';
}

/** Every stored graphics option, once. */
export function enumerateGraphicsConfigurations(): ChessGraphicsSettings[] {
  const rows: ChessGraphicsSettings[] = [];
  for (const resolution of RESOLUTIONS) {
    for (const upscale of UPSCALES) {
      for (const textureQuality of TEXTURES) {
        for (const shadows of FLAGS) {
          for (const ambientOcclusion of FLAGS) {
            for (const reflections of FLAGS) {
              for (const bloom of FLAGS) {
                for (const antialiasing of FLAGS) {
                  for (const coachOutline of FLAGS) {
                    rows.push({
                      resolution,
                      upscale,
                      textureQuality,
                      shadows,
                      shadowMode: shadows ? 'hard' : 'off',
                      ambientOcclusion,
                      reflections,
                      bloom,
                      antialiasing,
                      coachOutline,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return rows;
}

/**
 * Identity of a measurement: framebuffer, passes, texture size.
 * @param value - Graphics options.
 * @param clientWidth - CSS width of the game view.
 * @param clientHeight - CSS height of the game view.
 * @param devicePixelRatio - Device pixels per CSS pixel.
 */
export function graphicsBenchKey(
  value: ChessGraphicsSettings,
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number
): string {
  const surface = gameSurfacePixels(clientWidth, clientHeight, devicePixelRatio, value.resolution);
  return `${surface.width}x${surface.height}|${upscaleRenderScale(value.upscale)}|${gamePassNames(value).join(',')}|${pieceTextureSize(value.textureQuality)}`;
}

/** One settings object per distinct cost at this window size. */
export function uniqueGraphicsBenchSettings(
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number
): ChessGraphicsSettings[] {
  const seen = new Set<string>();
  const rows: ChessGraphicsSettings[] = [];
  for (const settings of enumerateGraphicsConfigurations()) {
    const key = graphicsBenchKey(settings, clientWidth, clientHeight, devicePixelRatio);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(settings);
  }
  return rows;
}

/**
 * True when two frame times are too close to show a cost. The present is still capped.
 * @param fluidMs - Fluide frame time.
 * @param qualityMs - Qualité frame time.
 */
export function graphicsBenchVsyncCapped(fluidMs: number, qualityMs: number): boolean {
  const scale = Math.max(Math.abs(fluidMs), Math.abs(qualityMs), 0.001);
  return Math.abs(fluidMs - qualityMs) / scale < 0.02;
}

/**
 * True when a moving piece left the table or tipped over.
 * @param position - World position in metres.
 * @param rotation - Quaternion, identity when the piece stands.
 */
export function graphicsBenchPoseFailed(
  position: readonly number[],
  rotation: readonly number[]
): boolean {
  if (position.length < 3 || rotation.length < 4) return true;
  if (![...position, ...rotation].every((value) => Number.isFinite(value))) return true;
  if (position[1]! > 0.45) return true;
  return !(
    Math.abs(rotation[0]!) < 0.2 &&
    Math.abs(rotation[1]!) < 0.2 &&
    Math.abs(rotation[2]!) < 0.2 &&
    rotation[3]! > 0.95
  );
}

/** Last traced shadow pass, when the monitor recorded one. */
export function shadowPassMs(passMs: Record<string, number>): number | null {
  const name = Object.keys(passMs).find((key) => key.includes('Shadow'));
  return name === undefined ? null : passMs[name]!;
}

/**
 * Median of the sample window. Even counts use the lower middle value.
 * @param waitFrame - Resolves after one presented frame.
 * @param read - Frame time in milliseconds at the current frame.
 */
export async function takeBenchProbe(
  waitFrame: () => Promise<void>,
  read: () => number,
  warmup = GRAPHICS_BENCH_WARMUP_FRAMES,
  samples = GRAPHICS_BENCH_SAMPLE_FRAMES
): Promise<number> {
  for (let i = 0; i < warmup; i++) await waitFrame();
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    await waitFrame();
    values.push(read());
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * One window of the campaign. Rest rows share a measurement per cost key.
 * Motion rows are the presets, plus Qualité without shadows, at rest, in flight, and held.
 */
export async function collectGraphicsBench(
  pass: 'rest' | 'motion',
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number,
  hooks: GraphicsBenchHooks
): Promise<GraphicsBenchWindowReport> {
  const report: GraphicsBenchWindowReport = {
    width: clientWidth,
    height: clientHeight,
    devicePixelRatio,
    rows: [],
    motion: [],
  };
  if (pass === 'motion') {
    report.motion = await collectMotion(hooks);
    return report;
  }
  const cache = new Map<string, { settings: ChessGraphicsSettings; probe: GraphicsBenchProbe }>();
  const fluid = await measure(FLUID_GRAPHICS, clientWidth, clientHeight, devicePixelRatio, hooks, cache);
  const qualitySettings = GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite')!.settings;
  const quality = await measure(qualitySettings, clientWidth, clientHeight, devicePixelRatio, hooks, cache);
  report.fluidMs = fluid.frameTimeMs;
  report.qualityMs = quality.frameTimeMs;
  if (fluid.frameTimeMs <= 0 || quality.frameTimeMs <= 0) {
    report.stopped = 'unready';
    return report;
  }
  if (graphicsBenchVsyncCapped(fluid.frameTimeMs, quality.frameTimeMs)) {
    report.stopped = 'vsync';
    return report;
  }
  for (const settings of enumerateGraphicsConfigurations()) {
    const key = graphicsBenchKey(settings, clientWidth, clientHeight, devicePixelRatio);
    if (!cache.has(key)) {
      await measure(settings, clientWidth, clientHeight, devicePixelRatio, hooks, cache);
    }
    const hit = cache.get(key)!;
    const surface = gameSurfacePixels(clientWidth, clientHeight, devicePixelRatio, settings.resolution);
    report.rows.push({
      settings,
      key,
      measured: JSON.stringify(settings) === JSON.stringify(hit.settings),
      frameTimeMs: hit.probe.frameTimeMs,
      framesPerSecond: hit.probe.framesPerSecond,
      drawCalls: hit.probe.drawCalls,
      triangles: hit.probe.triangles,
      gpuMemoryBytes: hit.probe.gpuMemoryBytes,
      surface,
      passMs: hit.probe.passMs,
    });
  }
  return report;
}

async function measure(
  settings: ChessGraphicsSettings,
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number,
  hooks: GraphicsBenchHooks,
  cache: Map<string, { settings: ChessGraphicsSettings; probe: GraphicsBenchProbe }>
): Promise<GraphicsBenchProbe> {
  const key = graphicsBenchKey(settings, clientWidth, clientHeight, devicePixelRatio);
  const cached = cache.get(key);
  if (cached) return cached.probe;
  await hooks.apply(settings);
  const probe = acceptProbe(await hooks.sample());
  cache.set(key, { settings, probe });
  return probe;
}

function acceptProbe(probe: GraphicsBenchProbe): GraphicsBenchProbe {
  return { ...probe, passMs: steadyPassMs(probe.passMs, probe.frameTimeMs) };
}

function motionLooks(): { id: string; settings: ChessGraphicsSettings }[] {
  const looks = GRAPHICS_PRESETS.map((preset) => ({ id: preset.id, settings: preset.settings }));
  const quality = GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite')!.settings;
  looks.push({
    id: 'qualite-sans-ombres',
    settings: { ...quality, shadows: false, shadowMode: 'off' },
  });
  return looks;
}

async function collectMotion(hooks: GraphicsBenchHooks): Promise<GraphicsBenchMotionRow[]> {
  const rows: GraphicsBenchMotionRow[] = [];
  for (const look of motionLooks()) {
    await hooks.apply(look.settings);
    let idleMs: number | null = null;
    for (const state of ['idle', 'flight', 'grab'] as const) {
      hooks.setMotion(state);
      const probe = acceptProbe(await hooks.sample());
      const pose = hooks.pose();
      const failed = pose === null || graphicsBenchPoseFailed(pose.position, pose.rotation);
      if (failed) {
        rows.push({
          id: look.id,
          state,
          settings: look.settings,
          pose: 'failed',
          frameTimeMs: null,
          shadowMs: null,
          deltaMs: null,
        });
        continue;
      }
      if (state === 'idle') idleMs = probe.frameTimeMs;
      rows.push({
        id: look.id,
        state,
        settings: look.settings,
        pose: 'ok',
        frameTimeMs: probe.frameTimeMs,
        shadowMs: shadowPassMs(probe.passMs),
        deltaMs: state === 'idle' || idleMs === null ? null : probe.frameTimeMs - idleMs,
      });
    }
  }
  return rows;
}
