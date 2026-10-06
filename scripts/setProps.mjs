/**
 * Scale and emissive contract for the Atelier, Salon and Club props.
 *
 * Masters stay unit-normalised in docs/raw_assets. This module is the length
 * the cleaner applies, and which props emit. Texture sizes match the piece
 * ladder in chessGraphicsSettings.ts. Draco is for meshes at or above
 * DRACO_VERTEX_THRESHOLD; these props are a few thousand vertices.
 */

/** Fluide, Équilibré, Qualité, then the master size the ambiance review reads. */
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
  { scene: 'salon', file: 'lampe', axis: 1, metres: 0.45, emissive: { mode: 'mask', strength: 2 } },
  { scene: 'salon', file: 'cheminee', axis: 0, metres: 1.4, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'fauteuil', axis: 1, metres: 0.78, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'bibliotheque', axis: 1, metres: 2.2, emissive: { mode: 'none' } },
  { scene: 'salon', file: 'tapis', axis: 0, metres: 2, emissive: { mode: 'none' } },
  { scene: 'club', file: 'table', axis: 0, metres: 1.6, emissive: { mode: 'none' } },
  { scene: 'club', file: 'rail', axis: 0, metres: 0.7, emissive: { mode: 'factor', color: [0, 0.95, 1], strength: 3 } },
  { scene: 'club', file: 'bar', axis: 1, metres: 1.1, emissive: { mode: 'none' } },
  { scene: 'club', file: 'tabouret', axis: 1, metres: 0.45, emissive: { mode: 'none' } },
  { scene: 'club', file: 'tube', axis: 0, metres: 1.2, emissive: { mode: 'factor', color: [1, 1, 1], strength: 2 } },
  { scene: 'club', file: 'enseigne', axis: 0, metres: 0.6, emissive: { mode: 'mask', strength: 2 } },
  { scene: 'club', file: 'bouteilles', axis: 1, metres: 0.3, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'table', axis: 0, metres: 1.5, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'coupe', axis: 0, metres: 0.18, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'dalle', axis: 0, metres: 0.3, pitch: -Math.PI / 2, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'haie', axis: 0, metres: 2, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'banc', axis: 0, metres: 1.4, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'arrosoir', axis: 0, metres: 0.4, emissive: { mode: 'none' } },
  { scene: 'jardin', file: 'glycine', axis: 1, metres: 0.8, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'table', axis: 0, metres: 1.3, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'lanterne', axis: 1, metres: 0.28, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'coupe', axis: 0, metres: 0.16, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'balustrade', axis: 0, metres: 1.2, emissive: { mode: 'none' } },
  { scene: 'terrasse', file: 'banc', axis: 0, metres: 1.6, emissive: { mode: 'none' } },
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
