/**
 * Encodes the HD piece maps ahead of time.
 *
 * Color and ORM are lossy WebP. Normals are lossless WebP, resized in a
 * linear pipeline so the vectors are not gamma-corrected.
 * Output: public/models/chess/tex/{size}/{piece}-{color|normal|orm}.webp
 *
 * Non-royal pieces stop at 1024. Queen, king and the board also bake 2048.
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  BOARD_BAKE_SIZES,
  PIECE_STEMS,
  pieceBakeSizes,
} from './pieceBakeSizes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const glbDir = join(root, 'docs/raw_assets/pieces/glb');
const boardGlb = join(root, 'docs/raw_assets/board/chess_board_B.glb');
const outRoot = join(root, 'public/models/chess/tex');
const BOARD_SIZES = BOARD_BAKE_SIZES;
const PIECES = PIECE_STEMS;

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

for (const size of [256, 512, 1024, 2048]) mkdirSync(join(outRoot, String(size)), { recursive: true });

let total = 0;

async function bakeFile(filePath, file, sizes) {
  const { json, bin } = parseGlb(readFileSync(filePath));
  const material = json.materials?.[0];
  const maps = {
    color: material?.pbrMetallicRoughness?.baseColorTexture?.index ?? 1,
    normal: material?.normalTexture?.index ?? 0,
    orm: material?.pbrMetallicRoughness?.metallicRoughnessTexture?.index ?? 2,
  };
  for (const size of sizes) {
    for (const kind of ['color', 'normal', 'orm']) {
      const dest = join(outRoot, String(size), `${file}-${kind}.webp`);
      const bytes = await encode(imageBytes(json, bin, maps[kind]), kind, size, dest);
      total += bytes;
      console.log(`${size}/${file}-${kind}.webp  ${(bytes / 1024).toFixed(0)} Ko`);
    }
  }
}

const only = process.argv.slice(2);
const pieces = only.length === 0 ? PIECES : PIECES.filter((name) => only.includes(name));
for (const file of pieces) {
  await bakeFile(join(glbDir, `${file}.glb`), file, pieceBakeSizes(file));
}
if (only.length === 0) await bakeFile(boardGlb, 'chess_board_B', BOARD_SIZES);
console.log(`baked ${(total / (1024 * 1024)).toFixed(1)} Mo`);
