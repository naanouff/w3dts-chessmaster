/**
 * Scale and emissive contract for the Atelier, Salon and Club props.
 *
 * Masters stay unit-normalised in docs/raw_assets. This module is the length
 * the cleaner applies, and which props emit. Bake sizes are 256–2048; the
 * client picks one per prop from scene texel density. Draco is for meshes at
 * or above DRACO_VERTEX_THRESHOLD; these props are a few thousand vertices.
 */

/** Bake ladder for scene props. Load size is chosen by texel density. */
export const SET_TEXTURE_SIZES = [256, 512, 1024, 2048];

/** Geometry below this stays uncompressed. The file weight is the JPEG maps. */
export const DRACO_VERTEX_THRESHOLD = 20000;

/** Mean RGB above this becomes emissive. The threshold itself stays black. */
export const EMISSIVE_LUMA_THRESHOLD = 200;

/**
 * @param {number} vertexCount
 * @returns {boolean}
 */
export function needsDraco(vertexCount) {
  return vertexCount >= DRACO_VERTEX_THRESHOLD;
}

/**
 * Averages normals of vertices that share a position when they meet under the crease.
 * A sharper corner keeps its own normal. Split vertices stay split, so the UVs do not move.
 * @param {Float32Array} positions
 * @param {Float32Array} normals
 * @param {number} creaseRadians
 * @returns {Float32Array}
 */
export function smoothSplitNormals(positions, normals, creaseRadians) {
  if (positions.length !== normals.length || positions.length % 3 !== 0) {
    throw new Error('smooth normals need matching float3 arrays');
  }
  const count = positions.length / 3;
  const cosLimit = Math.cos(creaseRadians);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-8);
  const quantize = 1e5 / span;
  /** @type {Map<string, number[]>} */
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const key = [
      Math.round(positions[i * 3] * quantize),
      Math.round(positions[i * 3 + 1] * quantize),
      Math.round(positions[i * 3 + 2] * quantize),
    ].join(',');
    const group = groups.get(key);
    if (group) group.push(i);
    else groups.set(key, [i]);
  }
  const out = new Float32Array(normals.length);
  for (const group of groups.values()) {
    const parent = group.map((_, index) => index);
    const find = (index) => {
      let cursor = index;
      while (parent[cursor] !== cursor) {
        parent[cursor] = parent[parent[cursor]];
        cursor = parent[cursor];
      }
      return cursor;
    };
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const i = group[a];
        const j = group[b];
        const dot =
          normals[i * 3] * normals[j * 3] +
          normals[i * 3 + 1] * normals[j * 3 + 1] +
          normals[i * 3 + 2] * normals[j * 3 + 2];
        if (dot + 1e-6 >= cosLimit) parent[find(a)] = find(b);
      }
    }
    const sum = new Map();
    for (let a = 0; a < group.length; a++) {
      const root = find(a);
      const acc = sum.get(root) ?? [0, 0, 0];
      const i = group[a];
      acc[0] += normals[i * 3];
      acc[1] += normals[i * 3 + 1];
      acc[2] += normals[i * 3 + 2];
      sum.set(root, acc);
    }
    for (let a = 0; a < group.length; a++) {
      const acc = sum.get(find(a));
      const length = Math.hypot(acc[0], acc[1], acc[2]) || 1;
      const i = group[a];
      out[i * 3] = acc[0] / length;
      out[i * 3 + 1] = acc[1] / length;
      out[i * 3 + 2] = acc[2] / length;
    }
  }
  return out;
}

/**
 * Uniform scale that makes one axis of a bounding box the given length.
 * @param {number[]} min
 * @param {number[]} max
 * @param {0 | 1 | 2} axis
 * @param {number} metres
 * @returns {number}
 */
export function scaleOf(min, max, axis, metres) {
  const span = max[axis] - min[axis];
  if (!(span > 0) || !(metres > 0)) throw new Error('scale needs a positive span and length');
  return metres / span;
}

/**
 * @param {number} channel - sRGB channel in 0..1.
 * @returns {number}
 */
export function srgbChannelToLinear(channel) {
  if (channel <= 0.04045) return channel / 12.92;
  return ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * Copies albedo texels brighter than the threshold. Darker texels stay black.
 * @param {Uint8Array} rgb
 * @param {number} threshold
 * @returns {Uint8Array}
 */
export function emissiveFromAlbedo(rgb, threshold) {
  if (rgb.length % 3 !== 0) throw new Error('RGB byte length');
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const luma = (rgb[i] + rgb[i + 1] + rgb[i + 2]) / 3;
    if (luma > threshold) {
      out[i] = rgb[i];
      out[i + 1] = rgb[i + 1];
      out[i + 2] = rgb[i + 2];
    }
  }
  return out;
}

/** Blue channel of metallic-roughness below this is treated as glass, not copper. */
export const GLASS_METAL_MAX = 50;

/** Neutral panes stay under this max-minus-min. Verdigris is more saturated. */
export const GLASS_CHROMA_MAX = 22;

/** Below this the texel is a gap, not a pane. */
export const GLASS_LUMA_MIN = 45;

/** sRGB candle behind the glass. */
const GLASS_GLOW = [255, 196, 120];

/**
 * Paints a warm glow on neutral, non-metallic panes. Copper and dark gaps stay black.
 * @param {Uint8Array} rgb - Albedo, three bytes per texel.
 * @param {Uint8Array} metal - Metallic channel, one byte per texel.
 * @returns {Uint8Array}
 */
export function emissiveFromGlass(rgb, metal) {
  if (rgb.length !== metal.length * 3) throw new Error('glass mask length');
  const out = new Uint8Array(rgb.length);
  for (let texel = 0, i = 0; texel < metal.length; texel++, i += 3) {
    const hi = Math.max(rgb[i], rgb[i + 1], rgb[i + 2]);
    const lo = Math.min(rgb[i], rgb[i + 1], rgb[i + 2]);
    const luma = (rgb[i] + rgb[i + 1] + rgb[i + 2]) / 3;
    if (metal[texel] < GLASS_METAL_MAX && hi - lo < GLASS_CHROMA_MAX && luma > GLASS_LUMA_MIN) {
      out[i] = GLASS_GLOW[0];
      out[i + 1] = GLASS_GLOW[1];
      out[i + 2] = GLASS_GLOW[2];
    }
  }
  return out;
}

/**
 * Props the client fetches from `public/sets`. Procedural pieces (cyclorama,
 * club glass table, rail, garden hedge) stay out of this list.
 * Keep in sync with `chessSetProps` — `tests/setAssets.test.ts` checks both.
 * @type {Record<string, readonly string[]>}
 */
export const SET_RUNTIME_PROPS = {
  atelier: ['table', 'plateau-toile', 'tabouret', 'softbox', 'projecteur'],
  salon: ['table', 'napperon', 'plateau', 'lampe', 'cheminee', 'fauteuil', 'bibliotheque', 'tapis', 'dalle'],
  club: ['bar', 'tabouret', 'tube', 'enseigne', 'bouteilles', 'dalle'],
  jardin: ['table', 'coupe', 'dalle', 'banc', 'arrosoir', 'glycine'],
  terrasse: ['table', 'lanterne', 'coupe', 'balustrade', 'banc', 'dalle'],
};

/** @type {SetProp[]} */
export const SET_PROPS = [
  { scene: 'atelier', file: 'table', axis: 0, metres: 1.8, emissive: { mode: 'none' } },
  { scene: 'atelier', file: 'plateau-toile', axis: 0, metres: 0.28, emissive: { mode: 'none' } },
  { scene: 'atelier', file: 'tabouret', axis: 1, metres: 0.45, emissive: { mode: 'none' } },
  { scene: 'atelier', file: 'softbox', axis: 1, metres: 1.2, emissive: { mode: 'mask', strength: 4 } },
  { scene: 'atelier', file: 'projecteur', axis: 1, metres: 1.6, emissive: { mode: 'mask', strength: 4 } },
  { scene: 'atelier', file: 'cyclorama', axis: 0, metres: 6, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'table', axis: 0, metres: 1.6, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'napperon', axis: 0, metres: 0.7, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'plateau', axis: 0, metres: 0.32, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'lampe', axis: 1, metres: 0.45, emissive: { mode: 'glass', strength: 2 } },
  { scene: 'salon', file: 'cheminee', axis: 0, metres: 1.4, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'fauteuil', axis: 1, metres: 0.78, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'bibliotheque', axis: 1, metres: 2.2, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'tapis', axis: 0, metres: 2, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'dalle', axis: 0, metres: 0.8, emissive: { mode: 'none' } },
  { scene: 'club', file: 'table', axis: 0, metres: 1.6, emissive: { mode: 'none' } },
  { scene: 'club', file: 'rail', axis: 0, metres: 0.7, emissive: { mode: 'factor', color: [0, 0.95, 1], strength: 3 } },
  { scene: 'club', file: 'bar', axis: 1, metres: 1.1, emissive: { mode: 'none' } },
  { scene: 'club', file: 'tabouret', axis: 1, metres: 0.45, emissive: { mode: 'none' } },
  { scene: 'club', file: 'tube', axis: 0, metres: 1.2, emissive: { mode: 'factor', color: [1, 1, 1], strength: 2 } },
  { scene: 'club', file: 'enseigne', axis: 0, metres: 0.6, emissive: { mode: 'mask', strength: 2 } },
  { scene: 'club', file: 'bouteilles', axis: 1, metres: 0.3, emissive: { mode: 'none' } },
  { scene: 'club', file: 'dalle', axis: 0, metres: 1, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'table', axis: 0, metres: 1.5, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'coupe', axis: 0, metres: 0.18, smooth: Math.PI / 3, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'dalle', axis: 0, metres: 0.3, pitch: -Math.PI / 2, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'haie', axis: 0, metres: 2, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'banc', axis: 0, metres: 1.4, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'arrosoir', axis: 0, metres: 0.4, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'glycine', axis: 1, metres: 0.8, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'table', axis: 0, metres: 1.3, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'lanterne', axis: 1, metres: 0.28, emissive: { mode: 'glass', strength: 2 } },
  { scene: 'terrasse', file: 'coupe', axis: 0, metres: 0.16, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'balustrade', axis: 0, metres: 2.4, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'banc', axis: 0, metres: 1.6, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'dalle', axis: 2, metres: 0.6, emissive: { mode: 'none' } },
];

/**
 * @param {string} scene
 * @param {string} file
 * @returns {SetProp}
 */
export function setProp(scene, file) {
  const found = SET_PROPS.find((prop) => prop.scene === scene && prop.file === file);
  if (!found) throw new Error(`unknown prop ${scene}/${file}`);
  return found;
}
