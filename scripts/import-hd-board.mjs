/**
 * Imports chess_board_B.glb into the same interleaved mesh as the Staunton pieces.
 *
 * The file is Z-up (pygltflib, no axis conversion): the board lies in XY and
 * the thickness is Z. This turns it Y-up and scales the 1 m side to the visual
 * board extent used by chessBoard.ts. The top face sits at y = 0.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'docs/raw_assets/board/chess_board_B.glb');
const outDir = join(root, 'public/models/chess');

/** Must match CHESS_BOARD_MESH_EXTENT in src/chess/board/chessBoard.ts. */
const SQUARE = 0.06;
const MESH_EXTENT = (SQUARE * 8) / (1 - 2 * 0.06);
/** Authored X/Y span of the GLB, metres. */
const SOURCE_EXTENT = 1;
const SCALE = MESH_EXTENT / SOURCE_EXTENT;
const STRIDE = 20;

const COMPONENT_BYTES = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const COMPONENT_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function parseGlb(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)));
  const binStart = 20 + jsonLength + 8;
  return { json, bin: buffer.subarray(binStart) };
}

function readAccessor(json, bin, index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  const components = COMPONENT_COUNT[accessor.type];
  if (!componentBytes || !components) throw new Error(`unsupported accessor ${index}`);
  const stride = view.byteStride || componentBytes * components;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const out = new Float32Array(accessor.count * components);
  for (let i = 0; i < accessor.count; i++) {
    const offset = start + i * stride;
    for (let c = 0; c < components; c++) {
      const at = offset + c * componentBytes;
      if (accessor.componentType === 5126) out[i * components + c] = bin.readFloatLE(at);
      else if (accessor.componentType === 5125) out[i * components + c] = bin.readUInt32LE(at);
      else if (accessor.componentType === 5123) out[i * components + c] = bin.readUInt16LE(at);
      else throw new Error(`component ${accessor.componentType}`);
    }
  }
  return out;
}

function accumulateTangents(positions, normals, uvs, indices) {
  const count = positions.length / 3;
  const tan = new Float32Array(count * 3);
  const bit = new Float32Array(count * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t];
    const i1 = indices[t + 1];
    const i2 = indices[t + 2];
    const p0x = positions[i0 * 3];
    const p0y = positions[i0 * 3 + 1];
    const p0z = positions[i0 * 3 + 2];
    const e1x = positions[i1 * 3] - p0x;
    const e1y = positions[i1 * 3 + 1] - p0y;
    const e1z = positions[i1 * 3 + 2] - p0z;
    const e2x = positions[i2 * 3] - p0x;
    const e2y = positions[i2 * 3 + 1] - p0y;
    const e2z = positions[i2 * 3 + 2] - p0z;
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
      tan[i * 3] += tx;
      tan[i * 3 + 1] += ty;
      tan[i * 3 + 2] += tz;
      bit[i * 3] += bx;
      bit[i * 3 + 1] += by;
      bit[i * 3 + 2] += bz;
    }
  }
  for (let i = 0; i < count; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    let tx = tan[i * 3];
    let ty = tan[i * 3 + 1];
    let tz = tan[i * 3 + 2];
    const dot = tx * nx + ty * ny + tz * nz;
    tx -= nx * dot;
    ty -= ny * dot;
    tz -= nz * dot;
    let len = Math.hypot(tx, ty, tz);
    if (len < 1e-8) {
      const ax = Math.abs(nx) < 0.9 ? 1 : 0;
      const ay = Math.abs(nx) < 0.9 ? 0 : 1;
      tx = ay * nz;
      ty = ax * nz;
      tz = -ay * nx - ax * ny;
      len = Math.hypot(tx, ty, tz) || 1;
    }
    tan[i * 3] = tx / len;
    tan[i * 3 + 1] = ty / len;
    tan[i * 3 + 2] = tz / len;
    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;
    const bl = Math.hypot(bx, by, bz) || 1;
    const handed = bx * bit[i * 3] + by * bit[i * 3 + 1] + bz * bit[i * 3 + 2];
    const sign = handed < 0 ? -1 : 1;
    bit[i * 3] = (bx / bl) * sign;
    bit[i * 3 + 1] = (by / bl) * sign;
    bit[i * 3 + 2] = (bz / bl) * sign;
  }
  return { tan, bit };
}

const { json, bin } = parseGlb(readFileSync(source));
const prim = json.meshes[0].primitives[0];
const srcPos = readAccessor(json, bin, prim.attributes.POSITION);
const srcN = readAccessor(json, bin, prim.attributes.NORMAL);
const srcUv = readAccessor(json, bin, prim.attributes.TEXCOORD_0);
const srcIndex = readAccessor(json, bin, prim.indices);
const count = srcPos.length / 3;
const positions = new Float32Array(count * 3);
const normals = new Float32Array(count * 3);
let maxY = -Infinity;
for (let i = 0; i < count; i++) {
  const x = srcPos[i * 3] * SCALE;
  const y = srcPos[i * 3 + 2] * SCALE;
  const z = -srcPos[i * 3 + 1] * SCALE;
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;
  const nx = srcN[i * 3];
  const ny = srcN[i * 3 + 1];
  const nz = srcN[i * 3 + 2];
  const nl = Math.hypot(nx, nz, ny) || 1;
  normals[i * 3] = nx / nl;
  normals[i * 3 + 1] = nz / nl;
  normals[i * 3 + 2] = -ny / nl;
  if (y > maxY) maxY = y;
}
for (let i = 0; i < count; i++) positions[i * 3 + 1] -= maxY;

const indices = new Uint32Array(srcIndex.length);
for (let i = 0; i < srcIndex.length; i++) indices[i] = srcIndex[i];
const { tan, bit } = accumulateTangents(positions, normals, srcUv, indices);
const vertices = new Float32Array(count * STRIDE);
let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxZ = -Infinity;
let minZ = Infinity;
for (let i = 0; i < count; i++) {
  const o = i * STRIDE;
  const x = positions[i * 3];
  const y = positions[i * 3 + 1];
  const z = positions[i * 3 + 2];
  vertices[o] = x;
  vertices[o + 1] = y;
  vertices[o + 2] = z;
  vertices[o + 3] = srcUv[i * 2];
  vertices[o + 4] = srcUv[i * 2 + 1];
  vertices[o + 5] = srcUv[i * 2];
  vertices[o + 6] = srcUv[i * 2 + 1];
  vertices[o + 7] = normals[i * 3];
  vertices[o + 8] = normals[i * 3 + 1];
  vertices[o + 9] = normals[i * 3 + 2];
  vertices[o + 10] = tan[i * 3];
  vertices[o + 11] = tan[i * 3 + 1];
  vertices[o + 12] = tan[i * 3 + 2];
  vertices[o + 13] = bit[i * 3];
  vertices[o + 14] = bit[i * 3 + 1];
  vertices[o + 15] = bit[i * 3 + 2];
  vertices[o + 16] = 1;
  vertices[o + 17] = 1;
  vertices[o + 18] = 1;
  vertices[o + 19] = 1;
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (y < minY) minY = y;
  if (z < minZ) minZ = z;
  if (z > maxZ) maxZ = z;
}

const index16 = new Uint16Array(indices);
const header = Buffer.alloc(16);
header.writeUInt32LE(0x534d3357, 0);
header.writeUInt32LE(1, 4);
header.writeUInt32LE(count, 8);
header.writeUInt32LE(indices.length, 12);
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'chess_board_B.wmesh'),
  Buffer.concat([header, Buffer.from(vertices.buffer), Buffer.from(index16.buffer)])
);
console.log(
  `chess_board_B  tris=${indices.length / 3}  xz=${(maxX - minX).toFixed(4)}  thickness=${(-minY).toFixed(4)}  top=0`
);
console.log(`bounds x ${minX.toFixed(4)}..${maxX.toFixed(4)}  z ${minZ.toFixed(4)}..${maxZ.toFixed(4)}`);
