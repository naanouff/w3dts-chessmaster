/**
 * Decodes the Staunton GLBs in docs/raw_assets/pieces/glb into engine meshes.
 *
 * A Draco mesh authored at 0.12 m, or a plain mesh of any height, is scaled
 * to the board and grounded so its base sits at y = 0. This writes an interleaved mesh.
 * Heights match `stauntonPieceHeight`: king 9.2 cm, queen 7.8 cm, bishop and knight
 * 6.2 cm, rook 6 cm, pawn 5.4 cm. Textures stay in the GLB and are baked separately.
 *
 * Black pieces are yawed 180° so identity rotation faces the opponent:
 * white toward +Z, black toward −Z.
 */
import { smoothSplitNormals } from './setProps.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const draco = require('draco3dgltf');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'docs/raw_assets/pieces/glb');
const outDir = join(root, 'public/models/chess');

/**
 * Same metres as `stauntonPieceHeight` in stauntonPieces.ts.
 * Keep both lists identical: one chess rule, two callers.
 */
const STAUNTON_HEIGHT = {
  pion: 0.054,
  tour: 0.06,
  cavalier: 0.062,
  fou: 0.062,
  reine: 0.078,
  roi: 0.092,
};
/** Crease kept sharp. Shallower splits, including the pawn, are averaged. */
const PIECE_NORMAL_CREASE = Math.PI / 3;

/**
 * @param {string} name
 * @returns {number}
 */
export function hdPieceHeight(name) {
  const role = name.replace(/^[bn]_/, '');
  const height = STAUNTON_HEIGHT[role];
  if (!(height > 0)) throw new Error(`unknown piece height for ${name}`);
  return height;
}
const STRIDE = 20;

const PIECES = [
  ['b_pion', false],
  ['b_tour', false],
  ['b_cavalier', false],
  ['b_fou', false],
  ['b_reine', false],
  ['b_roi', false],
  ['n_pion', true],
  ['n_tour', true],
  ['n_cavalier', true],
  ['n_fou', true],
  ['n_reine', true],
  ['n_roi', true],
];

const module = await draco.createDecoderModule({});
mkdirSync(outDir, { recursive: true });

function readAttribute(decoder, geometry, attributeId, stride) {
  const attribute = decoder.GetAttribute(geometry, attributeId);
  const data = new module.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(geometry, attribute, data);
  const out = new Float32Array(data.size());
  for (let i = 0; i < out.length; i++) out[i] = data.GetValue(i);
  module.destroy(data);
  if (out.length !== geometry.num_points() * stride) {
    throw new Error(`attribute ${attributeId} size ${out.length}`);
  }
  return out;
}

function accessorBytes(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  return { accessor, bytes: bin.subarray(start) };
}

function readFloatAccessor(json, bin, accessorIndex, stride) {
  const { accessor, bytes } = accessorBytes(json, bin, accessorIndex);
  const count = accessor.count * stride;
  const copy = Buffer.from(bytes.subarray(0, count * 4));
  return new Float32Array(copy.buffer, copy.byteOffset, count);
}

function readIndices(json, bin, accessorIndex) {
  const { accessor, bytes } = accessorBytes(json, bin, accessorIndex);
  const indices = new Uint32Array(accessor.count);
  if (accessor.componentType === 5125) {
    const copy = Buffer.from(bytes.subarray(0, accessor.count * 4));
    indices.set(new Uint32Array(copy.buffer, copy.byteOffset, accessor.count));
  } else if (accessor.componentType === 5123) {
    const copy = Buffer.from(bytes.subarray(0, accessor.count * 2));
    const src = new Uint16Array(copy.buffer, copy.byteOffset, accessor.count);
    for (let i = 0; i < src.length; i++) indices[i] = src[i];
  } else {
    throw new Error(`index component ${accessor.componentType}`);
  }
  return indices;
}

function decodePlain(json, bin, prim) {
  return {
    positions: readFloatAccessor(json, bin, prim.attributes.POSITION, 3),
    normals: readFloatAccessor(json, bin, prim.attributes.NORMAL, 3),
    uvs: readFloatAccessor(json, bin, prim.attributes.TEXCOORD_0, 2),
    indices: readIndices(json, bin, prim.indices),
  };
}

function decodePiece(name) {
  const file = readFileSync(join(sourceDir, `${name}.glb`));
  const jsonLen = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const prim = json.meshes[0].primitives[0];
  if (!prim.extensions?.KHR_draco_mesh_compression) {
    return decodePlain(json, file.subarray(binStart), prim);
  }
  const view = json.bufferViews[prim.extensions.KHR_draco_mesh_compression.bufferView];
  const start = binStart + (view.byteOffset || 0);
  const bytes = file.subarray(start, start + view.byteLength);
  const decoder = new module.Decoder();
  const buffer = new module.DecoderBuffer();
  buffer.Init(new Int8Array(bytes), bytes.byteLength);
  const geometry = new module.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, geometry);
  if (!status.ok()) throw new Error(`${name}: ${status.error_msg()}`);
  const positions = readAttribute(decoder, geometry, decoder.GetAttributeId(geometry, module.POSITION), 3);
  const normals = readAttribute(decoder, geometry, decoder.GetAttributeId(geometry, module.NORMAL), 3);
  const uvs = readAttribute(decoder, geometry, decoder.GetAttributeId(geometry, module.TEX_COORD), 2);
  const faces = geometry.num_faces();
  const indices = new Uint32Array(faces * 3);
  const face = new module.DracoInt32Array();
  for (let i = 0; i < faces; i++) {
    decoder.GetFaceFromMesh(geometry, i, face);
    indices[i * 3] = face.GetValue(0);
    indices[i * 3 + 1] = face.GetValue(1);
    indices[i * 3 + 2] = face.GetValue(2);
  }
  module.destroy(face);
  module.destroy(buffer);
  module.destroy(geometry);
  module.destroy(decoder);
  return { positions, normals, uvs, indices };
}

function accumulateTangents(positions, normals, uvs, indices) {
  const count = positions.length / 3;
  const tan = new Float32Array(count * 3);
  const bit = new Float32Array(count * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t];
    const i1 = indices[t + 1];
    const i2 = indices[t + 2];
    const p0x = positions[i0 * 3], p0y = positions[i0 * 3 + 1], p0z = positions[i0 * 3 + 2];
    const e1x = positions[i1 * 3] - p0x, e1y = positions[i1 * 3 + 1] - p0y, e1z = positions[i1 * 3 + 2] - p0z;
    const e2x = positions[i2 * 3] - p0x, e2y = positions[i2 * 3 + 1] - p0y, e2z = positions[i2 * 3 + 2] - p0z;
    const du1 = uvs[i1 * 2] - uvs[i0 * 2];
    const dv1 = uvs[i1 * 2 + 1] - uvs[i0 * 2 + 1];
    const du2 = uvs[i2 * 2] - uvs[i0 * 2];
    const dv2 = uvs[i2 * 2 + 1] - uvs[i0 * 2 + 1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det;
    const tx = f * (dv2 * e1x - dv1 * e2x);
    const ty = f * (dv2 * e1y - dv1 * e2y);
    const tz = f * (dv2 * e1z - dv1 * e2z);
    const bx = f * (-du2 * e1x + du1 * e2x);
    const by = f * (-du2 * e1y + du1 * e2y);
    const bz = f * (-du2 * e1z + du1 * e2z);
    for (const i of [i0, i1, i2]) {
      tan[i * 3] += tx; tan[i * 3 + 1] += ty; tan[i * 3 + 2] += tz;
      bit[i * 3] += bx; bit[i * 3 + 1] += by; bit[i * 3 + 2] += bz;
    }
  }
  for (let i = 0; i < count; i++) {
    const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
    let tx = tan[i * 3], ty = tan[i * 3 + 1], tz = tan[i * 3 + 2];
    const dot = tx * nx + ty * ny + tz * nz;
    tx -= nx * dot; ty -= ny * dot; tz -= nz * dot;
    let len = Math.hypot(tx, ty, tz);
    if (len < 1e-8) {
      const ax = Math.abs(nx) < 0.9 ? 1 : 0;
      const ay = Math.abs(nx) < 0.9 ? 0 : 1;
      tx = ay * nz; ty = ax * nz - 0; tz = -ay * nx - ax * ny;
      len = Math.hypot(tx, ty, tz) || 1;
    }
    tan[i * 3] = tx / len; tan[i * 3 + 1] = ty / len; tan[i * 3 + 2] = tz / len;
    let bx = ny * tz - nz * ty;
    let by = nz * tx - nx * tz;
    let bz = nx * ty - ny * tx;
    const bl = Math.hypot(bx, by, bz) || 1;
    const handed = bx * bit[i * 3] + by * bit[i * 3 + 1] + bz * bit[i * 3 + 2];
    const sign = handed < 0 ? -1 : 1;
    bit[i * 3] = (bx / bl) * sign;
    bit[i * 3 + 1] = (by / bl) * sign;
    bit[i * 3 + 2] = (bz / bl) * sign;
  }
  return { tan, bit };
}

function writeMesh(name, turnAround, decoded) {
  const { positions, uvs, indices } = decoded;
  const normals = smoothSplitNormals(positions, decoded.normals, PIECE_NORMAL_CREASE);
  const count = positions.length / 3;
  let minY = Infinity;
  let spanY = 0;
  for (let i = 1; i < positions.length; i += 3) {
    minY = Math.min(minY, positions[i]);
    spanY = Math.max(spanY, positions[i]);
  }
  spanY -= minY;
  const scale = hdPieceHeight(name) / spanY;
  const { tan, bit } = accumulateTangents(positions, normals, uvs, indices);
  const vertices = new Float32Array(count * STRIDE);
  const yaw = turnAround ? -1 : 1;
  let maxY = 0;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const x = positions[i * 3] * scale * yaw;
    const y = (positions[i * 3 + 1] - minY) * scale;
    const z = positions[i * 3 + 2] * scale * yaw;
    vertices[o] = x;
    vertices[o + 1] = y;
    vertices[o + 2] = z;
    vertices[o + 3] = uvs[i * 2];
    vertices[o + 4] = uvs[i * 2 + 1];
    vertices[o + 5] = uvs[i * 2];
    vertices[o + 6] = uvs[i * 2 + 1];
    vertices[o + 7] = normals[i * 3] * yaw;
    vertices[o + 8] = normals[i * 3 + 1];
    vertices[o + 9] = normals[i * 3 + 2] * yaw;
    vertices[o + 10] = tan[i * 3] * yaw;
    vertices[o + 11] = tan[i * 3 + 1];
    vertices[o + 12] = tan[i * 3 + 2] * yaw;
    vertices[o + 13] = bit[i * 3] * yaw;
    vertices[o + 14] = bit[i * 3 + 1];
    vertices[o + 15] = bit[i * 3 + 2] * yaw;
    vertices[o + 16] = 1;
    vertices[o + 17] = 1;
    vertices[o + 18] = 1;
    vertices[o + 19] = 1;
    if (y > maxY) maxY = y;
  }
  const index16 = new Uint16Array(indices);
  const header = Buffer.alloc(16);
  header.writeUInt32LE(0x534d3357, 0);
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(count, 8);
  header.writeUInt32LE(indices.length, 12);
  const out = Buffer.concat([
    header,
    Buffer.from(vertices.buffer),
    Buffer.from(index16.buffer),
  ]);
  writeFileSync(join(outDir, `${name}.wmesh`), out);
  return { vertices: count, triangles: indices.length / 3, height: maxY };
}

const only = new Set(process.argv.slice(2));
for (const [name, turnAround] of PIECES) {
  if (only.size > 0 && !only.has(name)) continue;
  const stats = writeMesh(name, turnAround, decodePiece(name));
  console.log(`${name}  tris=${stats.triangles}  height=${stats.height.toFixed(4)}`);
}
