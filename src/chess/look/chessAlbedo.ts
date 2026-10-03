/**
 * @file chessAlbedo.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description CPU albedo fill (wood board, ivory / ebony pieces) — no GPU required.
 */

import { CHESS_BOARD_BORDER_FRAC, CHESS_BOARD_INNER_FRAC } from '../board/chessBoard';

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number): number {
  let total = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    total += valueNoise(x * freq, y * freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return total;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function setPx(
  data: Uint8ClampedArray,
  size: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
): void {
  const i = (y * size + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
}

/**
 * Cathedral / fibre grain. `along` is fibre direction, `across` is growth-ring axis.
 * Light = Wood094 honey; dark = Wood051 walnut (tighter, lower contrast).
 */
function sampleWoodGrain(
  along: number,
  across: number,
  seed: number,
  kind: 'light' | 'dark'
): number {
  const stretch = kind === 'light' ? 5.4 : 8.8;
  const acrossScale = kind === 'light' ? 1.12 : 1.28;
  const pA = along * stretch + seed * 17.3;
  const pC = across * acrossScale + seed * 4.1;
  const warp = fbm(pA * 0.42, pC * 0.52) * (kind === 'light' ? 2.05 : 1.28);
  const cathedralAmp = kind === 'light' ? 1.7 : 0.82;
  const cathedral = Math.sin(pC * Math.PI * 1.32 + fbm(pC * 0.68, seed * 5.1) * 1.7) * cathedralAmp;
  const ringCoord = pA + warp + cathedral;
  const ringFreq = kind === 'light' ? 11.2 : 18.4;
  const rings = 0.5 + 0.5 * Math.sin(ringCoord * ringFreq);
  const pores = fbm(pA * 3.6, pC * 16.0);
  let grain = mix(rings, pores, kind === 'light' ? 0.34 : 0.26);
  grain = Math.pow(clamp01(grain), kind === 'light' ? 0.7 : 0.88);
  if (kind === 'light') {
    const streak = Math.pow(fbm(pA * 0.85 + 9.2, pC * 24.0), 10);
    grain = mix(grain, 0.1, clamp01(streak * 3.4));
  }
  return clamp01(grain);
}

function woodRgb(grain: number, kind: 'light' | 'dark'): [number, number, number] {
  if (kind === 'light') {
    const hi: [number, number, number] = [216, 188, 154];
    const lo: [number, number, number] = [168, 124, 91];
    return lerp3(hi, lo, grain);
  }
  const hi: [number, number, number] = [74, 54, 46];
  const lo: [number, number, number] = [36, 24, 20];
  return lerp3(hi, lo, mix(0.22, 0.82, grain));
}

export type BoardAlbedoCell =
  | { kind: 'frame' }
  | { kind: 'square'; fx: number; fy: number; lu: number; lv: number; light: boolean };

/** UV cell for the checker albedo (frame vs 8×8 square + local UV). */
export function boardAlbedoCell(u: number, v: number): BoardAlbedoCell {
  if (
    u < CHESS_BOARD_BORDER_FRAC ||
    v < CHESS_BOARD_BORDER_FRAC ||
    u >= 1 - CHESS_BOARD_BORDER_FRAC ||
    v >= 1 - CHESS_BOARD_BORDER_FRAC
  ) {
    return { kind: 'frame' };
  }
  const su = ((u - CHESS_BOARD_BORDER_FRAC) / CHESS_BOARD_INNER_FRAC) * 8;
  const sv = ((v - CHESS_BOARD_BORDER_FRAC) / CHESS_BOARD_INNER_FRAC) * 8;
  const fx = Math.min(7, Math.floor(su));
  const fy = Math.min(7, Math.floor(sv));
  const lu = su - fx;
  const lv = sv - fy;
  const light = (fx + (7 - fy)) % 2 === 0;
  return { kind: 'square', fx, fy, lu, lv, light };
}

export function fillBoardAlbedo(data: Uint8ClampedArray, size: number): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const cell = boardAlbedoCell(u, v);
      if (cell.kind === 'frame') {
        const grain = sampleWoodGrain(u * 8.5, v * 1.15, 0.41, 'dark');
        const rgb = woodRgb(grain, 'dark');
        setPx(data, size, x, y, rgb[0], rgb[1], rgb[2]);
        continue;
      }
      const seed = hash2(cell.fx * 1.73, cell.fy * 3.11);
      const grain = cell.light
        ? sampleWoodGrain(cell.lu + seed, cell.lv, seed, 'light')
        : sampleWoodGrain(cell.lv + seed * 0.5, cell.lu, seed + 0.37, 'dark');
      const rgb = woodRgb(grain, cell.light ? 'light' : 'dark');
      setPx(data, size, x, y, rgb[0], rgb[1], rgb[2]);
    }
  }
}

export function fillIvoryAlbedo(data: Uint8ClampedArray, size: number): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash2(x * 0.2, y * 0.2) * 16;
      setPx(data, size, x, y, 232 + n, 224 + n * 0.7, 208 + n * 0.4);
    }
  }
}

export function fillEbonyAlbedo(data: Uint8ClampedArray, size: number): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash2(x * 0.18, y * 0.22) * 18;
      setPx(data, size, x, y, 28 + n, 24 + n, 22 + n);
    }
  }
}
