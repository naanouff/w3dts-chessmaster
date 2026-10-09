/**
 * Re-encodes public/audio/chess/*.wav to Ogg Opus and removes the WAVs.
 * Requires ffmpeg-static (devDependency).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public/audio/chess');

if (!ffmpeg || !existsSync(ffmpeg)) {
  throw new Error('ffmpeg-static binary missing — run pnpm install');
}
if (!existsSync(dir)) {
  console.log('no public/audio/chess — skip');
  process.exit(0);
}

const wavs = readdirSync(dir).filter((name) => name.endsWith('.wav'));
let before = 0;
let after = 0;
for (const name of wavs) {
  const src = join(dir, name);
  const dest = join(dir, name.replace(/\.wav$/i, '.ogg'));
  before += statSync(src).size;
  const result = spawnSync(
    ffmpeg,
    ['-y', '-i', src, '-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', dest],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`ffmpeg failed on ${name}`);
  }
  after += statSync(dest).size;
  unlinkSync(src);
  console.log(`${name} → ${name.replace(/\.wav$/i, '.ogg')}`);
}
console.log(
  `compress-chess-audio: ${wavs.length} file(s), ${(before / (1024 * 1024)).toFixed(1)} Mo → ${(after / (1024 * 1024)).toFixed(1)} Mo`
);
