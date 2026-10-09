/**
 * Copies baked room props into public/sets at the density tiers the client loads.
 * Source: docs/raw_assets/<scene>/baked/<size>/. Run after `pnpm clean:set-props`.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SET_PROPS, SET_RUNTIME_PROPS, SET_TEXTURE_SIZES } from './setProps.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

let copied = 0;
for (const prop of SET_PROPS) {
  if (!SET_RUNTIME_PROPS[prop.scene]?.includes(prop.file)) continue;
  for (const size of shippedSetSizes(prop.metres)) {
    const src = join(root, 'docs/raw_assets', prop.scene, 'baked', String(size), `${prop.file}.glb`);
    const dest = join(root, 'public/sets', prop.scene, String(size), `${prop.file}.glb`);
    if (!existsSync(src)) {
      throw new Error(`missing bake ${prop.scene}/${size}/${prop.file}.glb — run pnpm clean:set-props`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    copied += 1;
  }
}

console.log(`ship-set-props: copied ${copied} file(s) into public/sets`);
