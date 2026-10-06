/**
 * @file runGraphicsBench.ts
 * @description Samples the live engine for one bench window, then reports the JSON.
 */

import type { Engine } from '@naanouff/w3dts-core';
import { useChessGraphicsSettings } from './chessGraphicsSettings';
import {
  collectGraphicsBench,
  GRAPHICS_BENCH_SAMPLE_FRAMES,
  GRAPHICS_BENCH_WARMUP_FRAMES,
  readGraphicsBenchProbe,
  takeInstalledBenchWorkMedian,
  type GraphicsBenchWindowReport,
} from './graphicsBench';
import { setGraphicsBenchMotion, readGraphicsBenchPose } from './graphicsBenchMotion';

/**
 * Runs the rest matrix or the motion pass for the current canvas size.
 * Frame time is the GPU-queue median, not the display interval.
 * @param engine - Running chess engine.
 * @param canvas - Game view whose client size is the window under test.
 */
export async function runGraphicsBench(
  engine: Engine,
  canvas: HTMLCanvasElement
): Promise<GraphicsBenchWindowReport> {
  const pass = new URLSearchParams(window.location.search).get('benchPass') === 'motion' ? 'motion' : 'rest';
  const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  return collectGraphicsBench(pass, canvas.clientWidth, canvas.clientHeight, dpr, {
    async apply(settings) {
      useChessGraphicsSettings(settings);
    },
    async sample() {
      const frameTimeMs = await takeInstalledBenchWorkMedian(
        GRAPHICS_BENCH_WARMUP_FRAMES,
        GRAPHICS_BENCH_SAMPLE_FRAMES,
        () => new Promise((resolve) => setTimeout(resolve, 5))
      );
      return { ...readGraphicsBenchProbe(engine.perfMonitor), frameTimeMs };
    },
    setMotion: setGraphicsBenchMotion,
    pose: readGraphicsBenchPose,
  });
}
