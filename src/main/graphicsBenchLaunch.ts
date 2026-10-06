/**
 * @file graphicsBenchLaunch.ts
 * @description Pure launch contract for the graphics bench window.
 */

export const GRAPHICS_BENCH_CHROMIUM_FLAGS = ['--disable-gpu-vsync'] as const;

export interface GraphicsBenchLaunch {
  search: string;
  width: number;
  height: number;
  persistBounds: false;
  /** Repo-relative Electron profile. Kept out of the saved player profile. */
  userDataDir: string;
}

/**
 * Window the bench should open. Absent when the env flag is off.
 * @param env - Process environment. Only `CHESS_GRAPHICS_BENCH=1` starts a bench.
 */
export function graphicsBenchLaunch(env: {
  CHESS_GRAPHICS_BENCH?: string;
  CHESS_BENCH_WIDTH?: string;
  CHESS_BENCH_HEIGHT?: string;
  CHESS_BENCH_PASS?: string;
}): GraphicsBenchLaunch | null {
  if (env.CHESS_GRAPHICS_BENCH !== '1') return null;
  const width = Number(env.CHESS_BENCH_WIDTH);
  const height = Number(env.CHESS_BENCH_HEIGHT);
  const pass = env.CHESS_BENCH_PASS === 'motion' ? 'motion' : 'rest';
  return {
    search: `bench=graphics&benchPass=${pass}&chess=hotseat`,
    width: Number.isFinite(width) && width >= 640 ? Math.round(width) : 1280,
    height: Number.isFinite(height) && height >= 480 ? Math.round(height) : 800,
    persistBounds: false,
    userDataDir: 'tmp/bench-userdata',
  };
}
