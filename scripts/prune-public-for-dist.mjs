/**
 * Removes local leftovers and unused bake tiers that must not ship.
 * Safe on a clean CI checkout: only deletes known overweight paths when present.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_BAKE_SIZES, PIECE_STEMS, pieceBakeSizes } from './pieceBakeSizes.mjs';
import { SET_PROPS, SET_TEXTURE_SIZES } from './setProps.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chessDir = join(root, 'public/models/chess');
const setsDir = join(root, 'public/sets');
let removed = 0;

function drop(path) {
  if (!existsSync(path)) return;
  unlinkSync(path);
  removed += 1;
}

/** Same density rule as texelDensity.sceneTextureSize (kept in sync by tests). */
function sceneTextureSize(metres, quality) {
  const pawn = quality === 'low' ? 256 : quality === 'medium' ? 512 : 1024;
  if (!(metres > 0) || !Number.isFinite(metres)) return pawn;
  const ideal = (pawn / 0.054) * (1 / 8) * metres;
  let best = SET_TEXTURE_SIZES[0];
  let bestErr = Infinity;
  for (const size of SET_TEXTURE_SIZES) {
    const err = Math.abs(Math.log2(ideal / size));
    if (err < bestErr) {
      bestErr = err;
      best = size;
    }
  }
  return best;
}

function shippedSetSizes(metres) {
  const set = new Set(['low', 'medium', 'high'].map((q) => sceneTextureSize(metres, q)));
  return SET_TEXTURE_SIZES.filter((size) => set.has(size));
}

for (const stem of PIECE_STEMS) {
  drop(join(chessDir, `${stem}.glb`));
  const keep = new Set(pieceBakeSizes(stem));
  for (const size of SET_TEXTURE_SIZES) {
    if (keep.has(size)) continue;
    for (const kind of ['color', 'normal', 'orm']) {
      drop(join(chessDir, 'tex', String(size), `${stem}-${kind}.webp`));
    }
  }
}

const boardKeep = new Set(BOARD_BAKE_SIZES);
for (const size of SET_TEXTURE_SIZES) {
  if (boardKeep.has(size)) continue;
  for (const kind of ['color', 'normal', 'orm']) {
    drop(join(chessDir, 'tex', String(size), `chess_board_B-${kind}.webp`));
  }
}

if (existsSync(setsDir)) {
  for (const prop of SET_PROPS) {
    const keep = new Set(shippedSetSizes(prop.metres));
    for (const size of SET_TEXTURE_SIZES) {
      if (keep.has(size)) continue;
      drop(join(setsDir, prop.scene, String(size), `${prop.file}.glb`));
    }
  }
}

console.log(`prune-public-for-dist: removed ${removed} file(s)`);
