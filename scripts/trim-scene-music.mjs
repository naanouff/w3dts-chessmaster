/**
 * Trim per-scene music loops (calm / edge / pressure) into public/audio/chess
 * and docs/raw_assets/audio-review.
 */
import fs from 'node:fs';
import path from 'node:path';

const lib = 'J:/_assetsLibrary/Music/Ultimate Game Music Collection';
const pub = 'public/audio/chess';
const review = 'docs/raw_assets/audio-review/beds';

/** @type {Array<{ id: string, calm: string, edge: string, pressure: string, seconds: number }>} */
const scenes = [
  {
    id: 'atelier',
    calm: 'Short Cues/Sound Effects/Dark Empty LOOP.wav',
    edge: 'Short Cues/Loading/Loading LOOP WITH MELODY.wav',
    pressure: 'Short Cues/Sound Effects/Draughty House Loop.wav',
    seconds: 16,
  },
  {
    id: 'salon',
    calm: 'Ambience/Music Box Edits/Music Box SIMPLE LOOP.wav',
    edge: 'Titles/Casual/Casual Menu PIANO LOOP.wav',
    pressure: 'Ambience/Lonely House LOOP.wav',
    seconds: 16,
  },
  {
    id: 'club',
    calm: 'Ambience/Metal Ambience LOOP.wav',
    edge: 'Titles/Casual/Funky Bass.wav',
    pressure: 'Ambience/Metal Ambience DEEP LOOP.wav',
    seconds: 16,
  },
  {
    id: 'jardin',
    calm: 'Platform/Forest LOOP PARTS/Forest SHORT AMBIENT LOOP.wav',
    edge: 'Puzzles/Lighthearted LOOP SHORT.wav',
    pressure: 'Locations/Moonlit Forest - Main Loop.wav',
    seconds: 16,
  },
  {
    id: 'terrasse',
    calm: 'Space/Lunar Ambience Edits/Lunar Ambience PADS SHORT LOOP.wav',
    edge: 'Space/Lunar Ambience Edits/Lunar Ambience SHORT LOOP.wav',
    pressure: 'Ambience/Frozen Landscape.wav',
    seconds: 16,
  },
];

function trimWav(srcPath, dstPath, seconds) {
  const buf = fs.readFileSync(srcPath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`not riff: ${srcPath}`);
  let off = 12;
  let fmt = null;
  let dataOff = -1;
  let dataSize = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        byteRate: buf.readUInt32LE(body + 8),
        blockAlign: buf.readUInt16LE(body + 12),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataOff = body;
      dataSize = size;
      break;
    }
    off = body + size + (size % 2);
  }
  if (!fmt || dataOff < 0) throw new Error(`bad wav ${srcPath}`);
  const maxBytes = Math.floor(fmt.sampleRate * seconds) * fmt.blockAlign;
  const take = Math.min(dataSize, maxBytes);
  const outData = buf.subarray(dataOff, dataOff + take);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + take, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(fmt.format, 20);
  header.writeUInt16LE(fmt.channels, 22);
  header.writeUInt32LE(fmt.sampleRate, 24);
  header.writeUInt32LE(fmt.byteRate, 28);
  header.writeUInt16LE(fmt.blockAlign, 32);
  header.writeUInt16LE(fmt.bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(take, 40);
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.writeFileSync(dstPath, Buffer.concat([header, outData]));
  return { mb: +(fs.statSync(dstPath).size / 1e6).toFixed(2) };
}

for (const s of scenes) {
  for (const [stem, rel] of [
    ['music', s.calm],
    ['music-edge', s.edge],
    ['music-pressure', s.pressure],
  ]) {
    const src = path.join(lib, rel);
    if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
    const pubName = stem === 'music' ? `bed-${s.id}-music.wav` : `bed-${s.id}-${stem}.wav`;
    const pubOut = path.join(pub, pubName);
    const revName = stem === 'music' ? 'music.wav' : `${stem}.wav`;
    const revOut = path.join(review, s.id, revName);
    const info = trimWav(src, pubOut, s.seconds);
    fs.mkdirSync(path.dirname(revOut), { recursive: true });
    fs.copyFileSync(pubOut, revOut);
    console.log(`${s.id}/${stem}: ${info.mb} MB ← ${rel}`);
  }
}
