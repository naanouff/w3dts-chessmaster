/**
 * Knocks the white field out of the ChessMaster crest and writes the HUD
 * PNG plus a Windows icon.
 *
 * Source: resources/logo-source.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'resources/logo-source.png');

function knockOutWhite(data, width, height) {
  const out = Buffer.from(data);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    const dist = Math.max(255 - r, 255 - g, 255 - b);
    if (dist < 14) out[o + 3] = 0;
    else if (dist < 42) out[o + 3] = Math.round(((dist - 14) / 28) * out[o + 3]);
  }
  return out;
}

const decoded = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const keyed = knockOutWhite(decoded.data, decoded.info.width, decoded.info.height);
const trimmed = sharp(keyed, {
  raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
}).trim({ threshold: 1 });

mkdirSync(join(root, 'public/brand'), { recursive: true });
mkdirSync(join(root, 'resources'), { recursive: true });

await trimmed.clone().png().toFile(join(root, 'public/brand/w3dts-chessmaster-logo.png'));

const iconPng = await trimmed
  .clone()
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
writeFileSync(join(root, 'resources/icon.png'), iconPng);

const sizes = [16, 32, 48, 256];
const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(iconPng)
      .resize(size, size)
      .png()
      .toBuffer()
  )
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
const entries = Buffer.alloc(16 * pngs.length);
let offset = 6 + entries.length;
pngs.forEach((png, index) => {
  const size = sizes[index];
  const at = index * 16;
  entries[at] = size === 256 ? 0 : size;
  entries[at + 1] = size === 256 ? 0 : size;
  entries.writeUInt16LE(1, at + 4);
  entries.writeUInt16LE(32, at + 6);
  entries.writeUInt32LE(png.length, at + 8);
  entries.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
writeFileSync(join(root, 'resources/icon.ico'), Buffer.concat([header, entries, ...pngs]));
console.log('logo and icon written');
