/**
 * Scales the Atelier, Salon and Club masters and bakes one GLB per texture tier.
 *
 * Masters in docs/raw_assets stay unit-sized with their 2048 JPEG maps.
 * Output is docs/raw_assets/<scene>/baked/<size>/<file>.glb, still gitignored.
 * Metallic factor stays 1 so the ORM texture keeps the metalness.
 * Draco is not applied: these meshes sit under DRACO_VERTEX_THRESHOLD.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  EMISSIVE_LUMA_THRESHOLD,
  MESHY_NORMAL_CREASE,
  SET_PROPS,
  SET_TEXTURE_SIZES,
  emissiveFromAlbedo,
  emissiveFromGlass,
  needsDraco,
  scaleOf,
  smoothSplitNormals,
  srgbChannelToLinear,
} from './setProps.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JPEG_QUALITY = 82;

/**
 * @param {Buffer} file
 * @returns {{ json: any, bin: Buffer }}
 */
export function parseGlb(file) {
  if (file.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength + 8;
  const binLength = file.readUInt32LE(20 + jsonLength);
  return { json, bin: Buffer.from(file.subarray(binStart, binStart + binLength)) };
}

/**
 * @param {any} json
 * @param {Buffer} bin
 * @returns {Buffer}
 */
export function packGlb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + bin.length + binPad;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length + jsonPad, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuf.copy(out, 20);
  out.fill(0x20, 20 + jsonBuf.length, 20 + jsonBuf.length + jsonPad);
  const binAt = 20 + jsonBuf.length + jsonPad;
  out.writeUInt32LE(bin.length + binPad, binAt);
  out.writeUInt32LE(0x004e4942, binAt + 4);
  bin.copy(out, binAt + 8);
  return out;
}

export function primitive(json) {
  if (json.meshes?.length !== 1 || json.meshes[0].primitives?.length !== 1) {
    throw new Error('expected one mesh primitive');
  }
  return json.meshes[0].primitives[0];
}

function scalePositions(json, bin, scale) {
  const accessor = json.accessors[primitive(json).attributes.POSITION];
  if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') {
    throw new Error('positions are not float3');
  }
  const view = json.bufferViews[accessor.bufferView];
  if (view.byteStride && view.byteStride !== 12) throw new Error('unexpected position stride');
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  for (let i = 0; i < accessor.count * 3; i++) {
    const at = start + i * 4;
    bin.writeFloatLE(bin.readFloatLE(at) * scale, at);
  }
  accessor.min = accessor.min.map((value) => value * scale);
  accessor.max = accessor.max.map((value) => value * scale);
  return accessor.count;
}

function rotateX(json, bin, radians) {
  if (!radians) return;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const attributes = primitive(json).attributes;
  for (const semantic of ['POSITION', 'NORMAL']) {
    const index = attributes[semantic];
    if (index === undefined) continue;
    const accessor = json.accessors[index];
    if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') {
      throw new Error(`${semantic} is not float3`);
    }
    const view = json.bufferViews[accessor.bufferView];
    if (view.byteStride && view.byteStride !== 12) throw new Error(`unexpected ${semantic} stride`);
    const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < accessor.count; i++) {
      const at = start + i * 12;
      const x = bin.readFloatLE(at);
      const y = bin.readFloatLE(at + 4);
      const z = bin.readFloatLE(at + 8);
      const turnedY = y * c - z * s;
      const turnedZ = y * s + z * c;
      bin.writeFloatLE(x, at);
      bin.writeFloatLE(turnedY, at + 4);
      bin.writeFloatLE(turnedZ, at + 8);
      if (semantic !== 'POSITION') continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, turnedY);
      minZ = Math.min(minZ, turnedZ);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, turnedY);
      maxZ = Math.max(maxZ, turnedZ);
    }
    if (semantic === 'POSITION') {
      accessor.min = [minX, minY, minZ];
      accessor.max = [maxX, maxY, maxZ];
    }
  }
}

function readFloat3(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  if (view.byteStride && view.byteStride !== 12) throw new Error('unexpected float3 stride');
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = new Float32Array(accessor.count * 3);
  for (let i = 0; i < values.length; i++) values[i] = bin.readFloatLE(start + i * 4);
  return { start, values };
}

function smoothNormals(json, bin, radians) {
  if (!radians) return;
  const attributes = primitive(json).attributes;
  if (attributes.NORMAL === undefined) return;
  const position = readFloat3(json, bin, attributes.POSITION);
  const normal = readFloat3(json, bin, attributes.NORMAL);
  const smoothed = smoothSplitNormals(position.values, normal.values, radians);
  for (let i = 0; i < smoothed.length; i++) bin.writeFloatLE(smoothed[i], normal.start + i * 4);
}

function sliceView(json, bin, index) {
  const view = json.bufferViews[index];
  const start = view.byteOffset || 0;
  return Buffer.from(bin.subarray(start, start + view.byteLength));
}

function pushAligned(chunks, cursor, bytes) {
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
  const start = cursor + pad;
  chunks.push(Buffer.from(bytes));
  return { start, cursor: start + bytes.length };
}

async function resizeJpeg(bytes, size) {
  return sharp(bytes, { failOn: 'none' })
    .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

function applyEmissive(json, prop) {
  const material = json.materials[0];
  if (prop.emissive.mode === 'none') {
    material.emissiveFactor = [0, 0, 0];
    delete material.emissiveTexture;
    if (material.extensions) delete material.extensions.KHR_materials_emissive_strength;
    return;
  }
  material.emissiveFactor =
    prop.emissive.mode === 'factor'
      ? prop.emissive.color.map((channel) => srgbChannelToLinear(channel))
      : [1, 1, 1];
  material.extensions = {
    ...(material.extensions ?? {}),
    KHR_materials_emissive_strength: { emissiveStrength: prop.emissive.strength },
  };
  json.extensionsUsed = Array.from(
    new Set([...(json.extensionsUsed ?? []), 'KHR_materials_emissive_strength'])
  );
}

/**
 * Returns a scaled GLB whose maps are `size` pixels on a side.
 * @param {Buffer} file
 * @param {import('./setProps.mjs').SetProp} prop
 * @param {number} size
 * @returns {Promise<Buffer>}
 */
export async function cleanGlb(file, prop, size) {
  const { json, bin } = parseGlb(file);
  const position = json.accessors[primitive(json).attributes.POSITION];
  const scale = scaleOf(position.min, position.max, prop.axis, prop.metres);
  const vertices = scalePositions(json, bin, scale);
  rotateX(json, bin, prop.pitch);
  smoothNormals(json, bin, prop.smooth ?? MESHY_NORMAL_CREASE);
  if (needsDraco(vertices)) throw new Error(`${prop.file} needs Draco and this pass does not compress`);

  const imageBytes = json.images.map((image) => sliceView(json, bin, image.bufferView));
  const encoded = [];
  for (const bytes of imageBytes) encoded.push(await resizeJpeg(bytes, size));

  let emissiveBytes = null;
  if (prop.emissive.mode === 'mask' || prop.emissive.mode === 'glass') {
    const pbr = json.materials[0].pbrMetallicRoughness;
    const colorTexture = pbr.baseColorTexture.index;
    const source = imageBytes[json.textures[colorTexture].source];
    const { data, info } = await sharp(source, { failOn: 'none' })
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let masked = emissiveFromAlbedo(data, EMISSIVE_LUMA_THRESHOLD);
    if (prop.emissive.mode === 'glass') {
      const mrSource = imageBytes[json.textures[pbr.metallicRoughnessTexture.index].source];
      const mr = await sharp(mrSource, { failOn: 'none' })
        .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
        .removeAlpha()
        .raw()
        .toBuffer();
      const metal = new Uint8Array(info.width * info.height);
      for (let texel = 0; texel < metal.length; texel++) metal[texel] = mr[texel * 3 + 2];
      masked = emissiveFromGlass(data, metal);
    }
    emissiveBytes = await sharp(Buffer.from(masked), {
      raw: { width: info.width, height: info.height, channels: 3 },
    })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  }

  applyEmissive(json, prop);

  const imageViews = new Set(json.images.map((image) => image.bufferView));
  const original = json.bufferViews.map((view) => ({
    byteOffset: view.byteOffset || 0,
    byteLength: view.byteLength,
  }));
  const chunks = [];
  let cursor = 0;
  for (let index = 0; index < json.bufferViews.length; index++) {
    if (imageViews.has(index)) continue;
    const placed = pushAligned(chunks, cursor, sliceViewFrom(bin, original[index]));
    json.bufferViews[index].byteOffset = placed.start;
    cursor = placed.cursor;
  }
  for (let index = 0; index < json.images.length; index++) {
    const placed = pushAligned(chunks, cursor, encoded[index]);
    const view = json.bufferViews[json.images[index].bufferView];
    view.byteOffset = placed.start;
    view.byteLength = encoded[index].length;
    json.images[index].mimeType = 'image/jpeg';
    delete json.images[index].uri;
    cursor = placed.cursor;
  }
  if (emissiveBytes) {
    const placed = pushAligned(chunks, cursor, emissiveBytes);
    json.bufferViews.push({
      buffer: 0,
      byteOffset: placed.start,
      byteLength: emissiveBytes.length,
    });
    json.images.push({
      mimeType: 'image/jpeg',
      bufferView: json.bufferViews.length - 1,
    });
    json.textures.push({ source: json.images.length - 1 });
    json.materials[0].emissiveTexture = { index: json.textures.length - 1 };
    cursor = placed.cursor;
  }

  json.buffers[0].byteLength = cursor;
  return packGlb(json, Buffer.concat(chunks));
}

function sliceViewFrom(bin, view) {
  return bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
}

async function main() {
  for (const size of SET_TEXTURE_SIZES) {
    for (const scene of ['atelier', 'salon', 'club', 'jardin', 'terrasse']) {
      mkdirSync(join(root, 'docs/raw_assets', scene, 'baked', String(size)), { recursive: true });
    }
  }
  for (const prop of SET_PROPS) {
    const source = readFileSync(join(root, 'docs/raw_assets', prop.scene, `${prop.file}.glb`));
    for (const size of SET_TEXTURE_SIZES) {
      const cleaned = await cleanGlb(source, prop, size);
      const dest = join(root, 'docs/raw_assets', prop.scene, 'baked', String(size), `${prop.file}.glb`);
      writeFileSync(dest, cleaned);
      const { json } = parseGlb(cleaned);
      const box = json.accessors[primitive(json).attributes.POSITION];
      const span = box.max.map((value, axis) => value - box.min[axis]);
      console.log(
        `${prop.scene}/${size}/${prop.file}  ${span.map((value) => value.toFixed(3)).join(' x ')} m  ${(cleaned.length / 1024).toFixed(0)} Ko`
      );
    }
  }
}

if (process.argv[1]?.includes('clean-set-props')) {
  await main();
}
