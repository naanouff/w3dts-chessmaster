/**
 * Encodes the HD piece maps ahead of time at 256, 512 and 1024.
 *
 * Color and ORM are lossy WebP. Normals are lossless WebP, resized in a
 * linear pipeline so the vectors are not gamma-corrected.
 * Output: public/models/chess/tex/{256|512|1024}/{piece}-{color|normal|orm}.webp
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const glbDir = join(root, 'public/models/chess');
const outRoot = join(glbDir, 'tex');
const SIZES = [256, 512, 1024];
const PIECES = [
  'b_pion',
  'b_tour',
  'b_cavalier',
  'b_fou',
  'b_reine',
  'b_roi',
  'n_pion',
  'n_tour',
  'n_cavalier',
  'n_fou',
  'n_reine',
  'n_roi',
];

function parseGlb(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)));
  const binStart = 20 + jsonLength + 8;
  return { json, bin: buffer.subarray(binStart) };
}

function imageBytes(json, bin, textureIndex) {
  const source = json.textures?.[textureIndex]?.source;
  const image = source === undefined ? undefined : json.images?.[source];
  const bufferView = image?.bufferView;
  const view = bufferView === undefined ? undefined : json.bufferViews?.[bufferView];
  if (!view) throw new Error(`texture ${textureIndex} is missing`);
  const start = view.byteOffset ?? 0;
  return bin.subarray(start, start + view.byteLength);
}

async function encode(bytes, kind, size, dest) {
  let pipeline = sharp(bytes, { unlimited: true, failOn: 'none' }).resize(size, size, {
    fit: 'fill',
    kernel: 'lanczos3',
  });
  if (kind === 'normal') {
    pipeline = sharp(bytes, { unlimited: true, failOn: 'none' })
      .pipelineColourspace('rgb16')
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      .toColourspace('rgb16')
      .webp({ lossless: true, effort: 4 });
  } else {
    pipeline = pipeline.webp({ quality: kind === 'color' ? 82 : 80, effort: 4 });
  }
  await pipeline.toFile(dest);
  return statSync(dest).size;
}

for (const size of SIZES) mkdirSync(join(outRoot, String(size)), { recursive: true });

let total = 0;
for (const file of PIECES) {
  const { json, bin } = parseGlb(readFileSync(join(glbDir, `${file}.glb`)));
  const material = json.materials?.[0];
  const maps = {
    color: material?.pbrMetallicRoughness?.baseColorTexture?.index ?? 1,
    normal: material?.normalTexture?.index ?? 0,
    orm: material?.pbrMetallicRoughness?.metallicRoughnessTexture?.index ?? 2,
  };
  for (const size of SIZES) {
    for (const kind of ['color', 'normal', 'orm']) {
      const dest = join(outRoot, String(size), `${file}-${kind}.webp`);
      const bytes = await encode(imageBytes(json, bin, maps[kind]), kind, size, dest);
      total += bytes;
      console.log(`${size}/${file}-${kind}.webp  ${(bytes / 1024).toFixed(0)} Ko`);
    }
  }
}
console.log(`baked ${(total / (1024 * 1024)).toFixed(1)} Mo`);
