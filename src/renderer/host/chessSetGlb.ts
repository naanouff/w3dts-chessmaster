/**
 * @file chessSetGlb.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Reads a non-Draco set GLB into the engine vertex layout, and places it like the review stage.
 */

import { chessSetPropUrl, chessSetProps, type ChessAmbianceId, type ChessSetPlacement } from './chessAmbiance';

const STRIDE = 20;

interface GlbAccessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}

interface GlbJson {
  accessors: GlbAccessor[];
  bufferViews: Array<{ byteOffset?: number; byteLength: number; byteStride?: number }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number; material?: number }> }>;
  materials?: Array<{
    pbrMetallicRoughness?: {
      baseColorTexture?: { index: number };
      metallicRoughnessTexture?: { index: number };
    };
    normalTexture?: { index: number };
    emissiveTexture?: { index: number };
    emissiveFactor?: number[];
    extensions?: { KHR_materials_emissive_strength?: { emissiveStrength?: number } };
  }>;
  textures?: Array<{ source: number }>;
  images?: Array<{ mimeType?: string; bufferView?: number }>;
}

export interface SetGlbImage {
  mime: string;
  bytes: Uint8Array;
}

/**
 * Prop orientation as a quaternion. Yaw turns around Y, roll around Z, both in radians.
 * `quat.fromEuler` reads degrees, so a placement angle cannot be handed to it.
 * @param yaw - Rotation around Y, radians.
 * @param roll - Rotation around Z, radians.
 * @returns Quaternion `[x, y, z, w]`.
 */
export function setPropRotation(yaw: number, roll: number): [number, number, number, number] {
  const cy = Math.cos(yaw / 2);
  const sy = Math.sin(yaw / 2);
  const cr = Math.cos(roll / 2);
  const sr = Math.sin(roll / 2);
  return [sy * sr, sy * cr, cy * sr, cy * cr];
}

/** The four maps a baked prop can carry. */
export type SetMapKind = 'color' | 'normal' | 'orm' | 'emissive';

/**
 * Texture format for one map. The baked JPEGs are sRGB-encoded, and the engine samples
 * a texture without decoding it, so the color and emissive maps need an sRGB view.
 * Normals and ORM hold data, not color, and stay linear.
 * @param kind - Which map the image feeds.
 * @returns WebGPU texture format.
 */
export function setMapTextureFormat(kind: SetMapKind): GPUTextureFormat {
  return kind === 'color' || kind === 'emissive' ? 'rgba8unorm-srgb' : 'rgba8unorm';
}

export interface SetGlbMesh {
  vertices: Float32Array;
  indices: Uint16Array | Uint32Array;
  color: SetGlbImage | null;
  normal: SetGlbImage | null;
  orm: SetGlbImage | null;
  emissive: SetGlbImage | null;
  emissiveFactor: readonly [number, number, number];
  emissiveStrength: number;
}

/**
 * Local position that puts a prop's anchor on the playing surface or the floor.
 * @param min - Mesh AABB minimum, metres.
 * @param max - Mesh AABB maximum, metres.
 * @param spec - Anchor and offset from the review stage.
 * @param floorY - Table feet height, metres.
 * @returns World position. Yaw and roll stay on the node.
 */
export function placeSetProp(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
  spec: ChessSetPlacement,
  floorY: number
): { x: number; y: number; z: number } {
  const lift = spec.lift ?? 0;
  let y = 0;
  if (spec.anchor === 'top') y = -max[1] + lift;
  if (spec.anchor === 'surface') y = -min[1] + lift;
  if (spec.anchor === 'floor') y = floorY - min[1] + lift;
  return { x: spec.x ?? 0, y, z: spec.z ?? 0 };
}

/**
 * Gray cove opened toward the camera. The Meshy cyclorama is not used.
 * @param floorRun - Flat floor before the quarter circle, metres.
 * @returns Interleaved vertices and triangle indices.
 */
export function cycloramaMesh(floorRun: number): { vertices: Float32Array; indices: Uint16Array } {
  const width = 6;
  const height = 3;
  const radius = 0.8;
  const arcSteps = 20;
  const profile: { z: number; y: number }[] = [{ z: 0, y: 0 }, { z: floorRun, y: 0 }];
  for (let step = 1; step <= arcSteps; step += 1) {
    const theta = -Math.PI / 2 + (step / arcSteps) * (Math.PI / 2);
    profile.push({
      z: floorRun + Math.cos(theta) * radius,
      y: radius + Math.sin(theta) * radius,
    });
  }
  profile.push({ z: floorRun + radius, y: height });
  const positions = new Float32Array(profile.length * 2 * 3);
  const normals = new Float32Array(profile.length * 2 * 3);
  const half = width / 2;
  for (let row = 0; row < profile.length; row += 1) {
    const next = profile[Math.min(row + 1, profile.length - 1)]!;
    const prev = profile[Math.max(row - 1, 0)]!;
    const dz = next.z - prev.z;
    const dy = next.y - prev.y;
    const length = Math.hypot(dz, dy) || 1;
    const point = profile[row]!;
    for (const side of [0, 1]) {
      const at = (row * 2 + side) * 3;
      positions[at] = side === 0 ? -half : half;
      positions[at + 1] = point.y;
      positions[at + 2] = point.z;
      normals[at] = 0;
      normals[at + 1] = dz / length;
      normals[at + 2] = -dy / length;
    }
  }
  const uvs = new Float32Array(profile.length * 2 * 2);
  const indices = new Uint16Array((profile.length - 1) * 6);
  for (let row = 0; row < profile.length - 1; row += 1) {
    const index = row * 2;
    const o = row * 6;
    indices[o] = index;
    indices[o + 1] = index + 2;
    indices[o + 2] = index + 1;
    indices[o + 3] = index + 1;
    indices[o + 4] = index + 2;
    indices[o + 5] = index + 3;
  }
  return { vertices: interleave(positions, normals, uvs, indices), indices };
}

/**
 * Loads every prop of a room. One missing file keeps the cloth plane.
 * @param id - Room id.
 * @param textureSize - 256, 512, or 1024.
 * @param load - Fetches one URL, or returns null when the file is absent.
 * @returns Buffers keyed by prop stem, or null when the set is incomplete.
 */
export async function fetchChessSetBuffers(
  id: ChessAmbianceId,
  textureSize: number,
  load: (url: string) => Promise<ArrayBuffer | null>
): Promise<Map<string, ArrayBuffer> | null> {
  const buffers = new Map<string, ArrayBuffer>();
  for (const file of chessSetProps(id)) {
    const buffer = await load(chessSetPropUrl(id, file, textureSize));
    if (!buffer) return null;
    buffers.set(file, buffer);
  }
  return buffers;
}

/**
 * Reads one baked set GLB. Positions are already in metres.
 * @param buffer - GLB bytes.
 * @returns Vertices in the engine layout, plus the JPEG maps.
 */
export function meshFromSetGlb(buffer: ArrayBuffer): SetGlbMesh {
  const { json, bin } = parseGlb(buffer);
  const primitive = json.meshes?.[0]?.primitives?.[0];
  if (primitive?.attributes.POSITION === undefined) throw new Error('set GLB has no position');
  const positions = readFloats(json, bin, primitive.attributes.POSITION, 3);
  const normals = primitive.attributes.NORMAL
    ? readFloats(json, bin, primitive.attributes.NORMAL, 3)
    : new Float32Array(positions.length);
  const uvs = primitive.attributes.TEXCOORD_0
    ? readFloats(json, bin, primitive.attributes.TEXCOORD_0, 2)
    : new Float32Array((positions.length / 3) * 2);
  const indices = primitive.indices === undefined
    ? sequence(positions.length / 3)
    : readIndices(json, bin, primitive.indices);
  const material = json.materials?.[primitive.material ?? 0];
  const pbr = material?.pbrMetallicRoughness;
  const factor = material?.emissiveFactor ?? [0, 0, 0];
  return {
    vertices: interleave(positions, normals, uvs, indices),
    indices,
    color: imageAt(json, bin, pbr?.baseColorTexture?.index),
    normal: imageAt(json, bin, material?.normalTexture?.index),
    orm: imageAt(json, bin, pbr?.metallicRoughnessTexture?.index),
    emissive: imageAt(json, bin, material?.emissiveTexture?.index),
    emissiveFactor: [factor[0] ?? 0, factor[1] ?? 0, factor[2] ?? 0],
    emissiveStrength: material?.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1,
  };
}

function parseGlb(buffer: ArrayBuffer): { json: GlbJson; bin: Uint8Array } {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as GlbJson;
  const binHeader = 20 + jsonLength;
  const binLength = view.getUint32(binHeader, true);
  return { json, bin: new Uint8Array(buffer, binHeader + 8, binLength) };
}

function readFloats(json: GlbJson, bin: Uint8Array, accessorIndex: number, components: number): Float32Array {
  const accessor = json.accessors[accessorIndex];
  if (!accessor || accessor.componentType !== 5126) throw new Error('expected float accessor');
  const view = json.bufferViews[accessor.bufferView];
  if (!view) throw new Error('missing buffer view');
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? components * 4;
  const out = new Float32Array(accessor.count * components);
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < accessor.count; i += 1) {
    for (let c = 0; c < components; c += 1) {
      out[i * components + c] = data.getFloat32(start + i * stride + c * 4, true);
    }
  }
  return out;
}

function readIndices(json: GlbJson, bin: Uint8Array, accessorIndex: number): Uint16Array | Uint32Array {
  const accessor = json.accessors[accessorIndex];
  const view = accessor ? json.bufferViews[accessor.bufferView] : undefined;
  if (!accessor || !view) throw new Error('missing indices');
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  if (accessor.componentType === 5125) {
    const out = new Uint32Array(accessor.count);
    for (let i = 0; i < accessor.count; i += 1) out[i] = data.getUint32(start + i * 4, true);
    return out;
  }
  const out = new Uint16Array(accessor.count);
  for (let i = 0; i < accessor.count; i += 1) out[i] = data.getUint16(start + i * 2, true);
  return out;
}

function sequence(count: number): Uint16Array {
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i += 1) out[i] = i;
  return out;
}

function imageAt(json: GlbJson, bin: Uint8Array, textureIndex: number | undefined): SetGlbImage | null {
  if (textureIndex === undefined) return null;
  const source = json.textures?.[textureIndex]?.source;
  const image = source === undefined ? undefined : json.images?.[source];
  const view = image?.bufferView === undefined ? undefined : json.bufferViews[image.bufferView];
  if (!image || !view) return null;
  const start = view.byteOffset ?? 0;
  return { mime: image.mimeType ?? 'image/jpeg', bytes: bin.slice(start, start + view.byteLength) };
}

function interleave(
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  indices: Uint16Array | Uint32Array
): Float32Array {
  const count = positions.length / 3;
  const { tan, bit } = tangents(positions, normals, uvs, indices);
  const vertices = new Float32Array(count * STRIDE);
  for (let i = 0; i < count; i += 1) {
    const o = i * STRIDE;
    vertices[o] = positions[i * 3] ?? 0;
    vertices[o + 1] = positions[i * 3 + 1] ?? 0;
    vertices[o + 2] = positions[i * 3 + 2] ?? 0;
    vertices[o + 3] = uvs[i * 2] ?? 0;
    vertices[o + 4] = uvs[i * 2 + 1] ?? 0;
    vertices[o + 5] = vertices[o + 3];
    vertices[o + 6] = vertices[o + 4];
    vertices[o + 7] = normals[i * 3] ?? 0;
    vertices[o + 8] = normals[i * 3 + 1] ?? 1;
    vertices[o + 9] = normals[i * 3 + 2] ?? 0;
    vertices[o + 10] = tan[i * 3] ?? 1;
    vertices[o + 11] = tan[i * 3 + 1] ?? 0;
    vertices[o + 12] = tan[i * 3 + 2] ?? 0;
    vertices[o + 13] = bit[i * 3] ?? 0;
    vertices[o + 14] = bit[i * 3 + 1] ?? 0;
    vertices[o + 15] = bit[i * 3 + 2] ?? 1;
    vertices[o + 16] = 1;
    vertices[o + 17] = 1;
    vertices[o + 18] = 1;
    vertices[o + 19] = 1;
  }
  return vertices;
}

function tangents(
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  indices: Uint16Array | Uint32Array
): { tan: Float32Array; bit: Float32Array } {
  const count = positions.length / 3;
  const tan = new Float32Array(count * 3);
  const bit = new Float32Array(count * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t] ?? 0;
    const i1 = indices[t + 1] ?? 0;
    const i2 = indices[t + 2] ?? 0;
    const p0x = positions[i0 * 3] ?? 0;
    const p0y = positions[i0 * 3 + 1] ?? 0;
    const p0z = positions[i0 * 3 + 2] ?? 0;
    const e1x = (positions[i1 * 3] ?? 0) - p0x;
    const e1y = (positions[i1 * 3 + 1] ?? 0) - p0y;
    const e1z = (positions[i1 * 3 + 2] ?? 0) - p0z;
    const e2x = (positions[i2 * 3] ?? 0) - p0x;
    const e2y = (positions[i2 * 3 + 1] ?? 0) - p0y;
    const e2z = (positions[i2 * 3 + 2] ?? 0) - p0z;
    const du1 = (uvs[i1 * 2] ?? 0) - (uvs[i0 * 2] ?? 0);
    const dv1 = (uvs[i1 * 2 + 1] ?? 0) - (uvs[i0 * 2 + 1] ?? 0);
    const du2 = (uvs[i2 * 2] ?? 0) - (uvs[i0 * 2] ?? 0);
    const dv2 = (uvs[i2 * 2 + 1] ?? 0) - (uvs[i0 * 2 + 1] ?? 0);
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det;
    const tx = f * (dv2 * e1x - dv1 * e2x);
    const ty = f * (dv2 * e1y - dv1 * e2y);
    const tz = f * (dv2 * e1z - dv1 * e2z);
    for (const i of [i0, i1, i2]) {
      tan[i * 3] = (tan[i * 3] ?? 0) + tx;
      tan[i * 3 + 1] = (tan[i * 3 + 1] ?? 0) + ty;
      tan[i * 3 + 2] = (tan[i * 3 + 2] ?? 0) + tz;
    }
  }
  for (let i = 0; i < count; i += 1) {
    const nx = normals[i * 3] ?? 0;
    const ny = normals[i * 3 + 1] ?? 1;
    const nz = normals[i * 3 + 2] ?? 0;
    let tx = tan[i * 3] ?? 0;
    let ty = tan[i * 3 + 1] ?? 0;
    let tz = tan[i * 3 + 2] ?? 0;
    const dot = tx * nx + ty * ny + tz * nz;
    tx -= nx * dot;
    ty -= ny * dot;
    tz -= nz * dot;
    let len = Math.hypot(tx, ty, tz);
    if (len < 1e-8) {
      tx = ny;
      ty = -nx;
      tz = 0;
      len = Math.hypot(tx, ty, tz) || 1;
    }
    tan[i * 3] = tx / len;
    tan[i * 3 + 1] = ty / len;
    tan[i * 3 + 2] = tz / len;
    const bx = ny * (tz / len) - nz * (ty / len);
    const by = nz * (tx / len) - nx * (tz / len);
    const bz = nx * (ty / len) - ny * (tx / len);
    const bl = Math.hypot(bx, by, bz) || 1;
    bit[i * 3] = bx / bl;
    bit[i * 3 + 1] = by / bl;
    bit[i * 3 + 2] = bz / bl;
  }
  return { tan, bit };
}
