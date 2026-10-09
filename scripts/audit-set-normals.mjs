/**
 * Report Meshy set props whose split normals still facet under the default crease.
 * Default: baked masters (post-clean). Pass `--masters` for the raw Meshy dumps.
 * Usage: node scripts/audit-set-normals.mjs [--masters]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MESHY_NORMAL_CREASE,
  SET_PROPS,
  SET_TEXTURE_SIZES,
  countFacetedSplits,
} from './setProps.mjs';
import { parseGlb, primitive } from './clean-set-props.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mastersOnly = process.argv.includes('--masters');

function readFloat3(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = new Float32Array(accessor.count * 3);
  for (let i = 0; i < values.length; i++) values[i] = bin.readFloatLE(start + i * 4);
  return values;
}

function bakedPath(prop) {
  for (const size of [...SET_TEXTURE_SIZES].reverse()) {
    const path = join(
      root,
      'docs/raw_assets',
      prop.scene,
      'baked',
      String(size),
      `${prop.file}.glb`
    );
    if (existsSync(path)) return path;
  }
  return null;
}

function masterPath(prop) {
  return join(root, 'docs/raw_assets', prop.scene, `${prop.file}.glb`);
}

const rows = [];
for (const prop of SET_PROPS) {
  const path = mastersOnly ? masterPath(prop) : bakedPath(prop);
  const id = `${prop.scene}/${prop.file}`;
  if (!path || !existsSync(path)) {
    rows.push({ id, ok: false, note: mastersOnly ? 'missing master' : 'missing bake' });
    continue;
  }
  const { json, bin } = parseGlb(readFileSync(path));
  const attrs = primitive(json).attributes;
  if (attrs.NORMAL === undefined) {
    rows.push({ id, ok: false, note: 'no NORMAL' });
    continue;
  }
  const positions = readFloat3(json, bin, attrs.POSITION);
  const normals = readFloat3(json, bin, attrs.NORMAL);
  const faceted = countFacetedSplits(positions, normals, MESHY_NORMAL_CREASE);
  const verts = positions.length / 3;
  rows.push({
    id,
    ok: true,
    verts,
    faceted,
    pct: ((100 * faceted) / verts).toFixed(1),
  });
}

rows.sort((a, b) => (b.faceted ?? 0) - (a.faceted ?? 0));
const label = mastersOnly ? 'Meshy masters (raw)' : 'Meshy baked (post-clean)';
console.log(`${label} — vertices that change under 60° normal smooth:\n`);
for (const row of rows) {
  if (!row.ok) {
    console.log(`  ${row.id.padEnd(28)}  ${row.note}`);
    continue;
  }
  const mark = row.faceted > 0 ? 'FACET' : 'ok   ';
  console.log(
    `  ${mark}  ${row.id.padEnd(28)}  ${String(row.faceted).padStart(5)} / ${row.verts}  (${row.pct}%)`
  );
}
const dirty = rows.filter((row) => row.ok && row.faceted > 0);
const present = rows.filter((r) => r.ok).length;
console.log(`\n${dirty.length} / ${present} ${mastersOnly ? 'masters' : 'bakes'} need smoothing.`);
if (!mastersOnly && dirty.length > 0) process.exitCode = 1;
