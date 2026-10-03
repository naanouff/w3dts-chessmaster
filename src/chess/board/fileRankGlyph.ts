/**
 * @file fileRankGlyph.ts
 * @project w3dts
 * @description Serif (Palatino) file/rank glyphs with a champagne intaglio (CHESS-B6a).
 */

/** 5×7 fallback when no 2D canvas (Node tests). */
const GLYPH_W = 5;
const GLYPH_H = 7;

const FONT: Record<string, readonly string[]> = {
  a: ['.###.', '#...#', '#####', '#...#', '#...#', '#...#', '#...#'],
  b: ['####.', '#...#', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  d: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  e: ['#####', '#....', '####.', '#....', '#....', '#....', '#####'],
  f: ['#####', '#....', '####.', '#....', '#....', '#....', '#....'],
  g: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  h: ['#...#', '#...#', '#####', '#...#', '#...#', '#...#', '#...#'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['#...#', '#...#', '#...#', '#####', '....#', '....#', '....#'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
};

/** Shadowed wall of the cut. */
const GROOVE = { r: 14, g: 10, b: 8 };
/**
 * Champagne / white-gold inlay — cooler and paler than the Metal048C plinth
 * (yellow leaf gold disappears on that frame).
 */
const INLAY = { r: 228, g: 214, b: 176 };
/** Cool catch on the near wall. */
const INLAY_HI = { r: 248, g: 238, b: 214 };

export const CHESS_GLYPH_TEXTURE_SIZE = 128;

const SERIF_STACK =
  '"Palatino Linotype", Palatino, "Book Antiqua", "Iowan Old Style", Georgia, "Times New Roman", serif';

function coverageFromBitmap(glyph: string, size: number): Float32Array {
  const cov = new Float32Array(size * size);
  const rows = FONT[glyph];
  if (!rows) return cov;
  const pad = size * 0.18;
  const inner = size - pad * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5 - pad) / inner;
      const v = (y + 0.5 - pad) / inner;
      if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
      const gx = u * GLYPH_W - 0.5;
      const gy = v * GLYPH_H - 0.5;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;
      const s00 = rows[iy]?.[ix] === '#' ? 1 : 0;
      const s10 = rows[iy]?.[ix + 1] === '#' ? 1 : 0;
      const s01 = rows[iy + 1]?.[ix] === '#' ? 1 : 0;
      const s11 = rows[iy + 1]?.[ix + 1] === '#' ? 1 : 0;
      cov[y * size + x] =
        s00 * (1 - fx) * (1 - fy) + s10 * fx * (1 - fy) + s01 * (1 - fx) * fy + s11 * fx * fy;
    }
  }
  return cov;
}

function coverageFromSerifCanvas(glyph: string, size: number): Float32Array | null {
  try {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : typeof document !== 'undefined'
          ? document.createElement('canvas')
          : null;
    if (!canvas) return null;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const px = Math.round(size * 0.58);
    ctx.font = `600 ${px}px ${SERIF_STACK}`;
    const metrics = ctx.measureText(glyph);
    const ascent = metrics.actualBoundingBoxAscent || px * 0.7;
    const descent = metrics.actualBoundingBoxDescent || px * 0.2;
    const cy = (size + ascent - descent) * 0.5;
    const cx = size * 0.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, size * 0.055);
    ctx.strokeText(glyph, cx, cy);
    ctx.fillText(glyph, cx, cy);
    const img = ctx.getImageData(0, 0, size, size);
    const cov = new Float32Array(size * size);
    const pxData = img.data;
    for (let i = 0; i < size * size; i++) {
      cov[i] = (pxData[i * 4 + 3] ?? 0) / 255;
    }
    return cov;
  } catch {
    return null;
  }
}

function sampleCov(cov: Float32Array, size: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= size || y >= size) return 0;
  return cov[y * size + x] ?? 0;
}

function blurCoverage(src: Float32Array, size: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          s += sampleCov(src, size, x + ox, y + oy);
        }
      }
      out[y * size + x] = s / 9;
    }
  }
  return out;
}

function dilateCoverage(src: Float32Array, size: number, radius: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let m = 0;
      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const v = sampleCov(src, size, x + ox, y + oy);
          if (v > m) m = v;
        }
      }
      out[y * size + x] = m;
    }
  }
  return out;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * V-cut: dark channel, champagne inlay on the floor, lit lip. Shallower than a
 * deep intaglio so it sits in the gold without looking drilled.
 */
function engraveCoverage(coverage: Float32Array, size: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  const floor = blurCoverage(coverage, size);
  const channel = blurCoverage(
    dilateCoverage(coverage, size, Math.max(1, Math.round(size * 0.028))),
    size
  );
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = sampleCov(channel, size, x, y);
      if (ch < 0.03) continue;
      const fill = sampleCov(floor, size, x, y);
      const gx = sampleCov(channel, size, x + 1, y) - sampleCov(channel, size, x - 1, y);
      const gy = sampleCov(channel, size, x, y + 1) - sampleCov(channel, size, x, y - 1);
      const glen = Math.hypot(gx, gy);
      const nx = glen > 1e-5 ? gx / glen : 0;
      const ny = glen > 1e-5 ? gy / glen : 0;
      const ndot = -(nx * 0.42 + ny * 0.9);
      const inChannel = smoothstep(0.04, 0.28, ch);
      const inFloor = smoothstep(0.12, 0.55, fill);
      const wall = inChannel * (1 - inFloor);
      const lip = smoothstep(0.04, 0.5, glen);
      const highlight = clamp01(ndot) * lip * wall;
      const occlude = Math.max(wall * (0.4 + 0.4 * clamp01(-ndot)), wall * (1 - inFloor) * 0.22);
      const i = (y * size + x) * 4;
      const r = GROOVE.r * occlude + INLAY.r * inFloor * (1 - highlight) + INLAY_HI.r * highlight;
      const g = GROOVE.g * occlude + INLAY.g * inFloor * (1 - highlight) + INLAY_HI.g * highlight;
      const b = GROOVE.b * occlude + INLAY.b * inFloor * (1 - highlight) + INLAY_HI.b * highlight;
      data[i] = Math.round(Math.min(255, r));
      data[i + 1] = Math.round(Math.min(255, g));
      data[i + 2] = Math.round(Math.min(255, b));
      data[i + 3] = Math.round(Math.min(255, inChannel * 255));
    }
  }
  return data;
}

/**
 * RGBA8 serif glyph. Transparent outside the cut.
 * Browser: Palatino (empatements). Node: bilinear 5×7. Champagne inlay, not plinth gold.
 */
export function fillChessGlyphAlbedo(
  glyph: string,
  size = CHESS_GLYPH_TEXTURE_SIZE
): Uint8ClampedArray {
  const coverage = coverageFromSerifCanvas(glyph, size) ?? coverageFromBitmap(glyph, size);
  return engraveCoverage(coverage, size);
}
