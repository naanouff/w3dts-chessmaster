/**
 * Softens tabletop hit masters into public/audio/chess WAV, ready for compress:audio.
 * Fade-in 4 ms, low-pass 7 kHz, trim to 150 ms with 40 ms fade-out, peak −12 dBFS.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const masters = join(root, 'docs/raw_assets/audio-review/hits');
const outDir = join(root, 'public/audio/chess');
const ROOMS = ['atelier', 'salon', 'club', 'jardin', 'terrasse'];
const KINDS = ['drop', 'capture'];
const PEAK_DBFS = -12;

if (!ffmpeg || !existsSync(ffmpeg)) {
  throw new Error('ffmpeg-static binary missing — run pnpm install');
}
if (!existsSync(masters)) {
  throw new Error(`missing masters at ${masters}`);
}
mkdirSync(outDir, { recursive: true });

function pickMaster(room, kind) {
  const dir = join(masters, room);
  if (!existsSync(dir)) return null;
  const exact = join(dir, `${kind}.wav`);
  if (existsSync(exact)) return exact;
  const alt = readdirSync(dir).find(
    (name) => name.startsWith(`${kind}-`) && name.endsWith('.wav')
  );
  return alt ? join(dir, alt) : null;
}

function runFfmpeg(args) {
  const result = spawnSync(ffmpeg, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`ffmpeg failed: ${args.join(' ')}`);
  }
  return `${result.stderr || ''}\n${result.stdout || ''}`;
}

function maxVolumeDb(src, af) {
  const log = runFfmpeg([
    '-hide_banner',
    '-i',
    src,
    '-af',
    `${af},volumedetect`,
    '-f',
    'null',
    process.platform === 'win32' ? 'NUL' : '/dev/null',
  ]);
  const match = log.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
  if (!match) throw new Error(`no max_volume for ${src}`);
  return Number(match[1]);
}

const shape = [
  'afade=t=in:st=0:d=0.004',
  'lowpass=f=7000',
  'atrim=0:0.15',
  'afade=t=out:st=0.11:d=0.04',
].join(',');

let count = 0;
for (const room of ROOMS) {
  for (const kind of KINDS) {
    const src = pickMaster(room, kind);
    if (!src) {
      console.warn(`skip ${kind}-${room}: no master`);
      continue;
    }
    const peak = maxVolumeDb(src, shape);
    const gainDb = PEAK_DBFS - peak;
    const dest = join(outDir, `${kind}-${room}.wav`);
    runFfmpeg([
      '-y',
      '-i',
      src,
      '-af',
      `${shape},volume=${gainDb.toFixed(3)}dB`,
      '-ac',
      '1',
      '-ar',
      '44100',
      dest,
    ]);
    count += 1;
    console.log(`${room}/${kind} → ${kind}-${room}.wav (peak ${peak.toFixed(1)} → ${PEAK_DBFS} dBFS)`);
  }
}
console.log(`soften-chess-sfx: ${count} file(s). Run pnpm compress:audio next.`);
