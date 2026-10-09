/**
 * @file setAssets.test.ts
 * @description Runtime set props under public/sets must ship with the installer.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGlb, primitive } from '../scripts/clean-set-props.mjs';
import {
  MESHY_NORMAL_CREASE,
  SET_RUNTIME_PROPS,
  countFacetedSplits,
} from '../scripts/setProps.mjs';
import { shippedSetTextureSizes } from '../src/renderer/graphics/texelDensity';
import { chessSetProps, type ChessAmbianceId } from '../src/renderer/host/chessAmbiance';

function readFloat3(
  json: { accessors: { bufferView: number; byteOffset?: number; count: number }[] },
  bin: Buffer,
  accessorIndex: number
): Float32Array {
  const accessor = json.accessors[accessorIndex]!;
  const view = (
    json as { bufferViews: { byteOffset?: number }[] }
  ).bufferViews[accessor.bufferView]!;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = new Float32Array(accessor.count * 3);
  for (let i = 0; i < values.length; i++) values[i] = bin.readFloatLE(start + i * 4);
  return values;
}

const SCENES: ChessAmbianceId[] = ['atelier', 'salon', 'club', 'jardin', 'terrasse'];

function ignoredPaths(paths: string[]): Set<string> {
  const result = spawnSync('git', ['check-ignore', '--', ...paths], { encoding: 'utf8' });
  return new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  );
}

describe('set ambiance assets', () => {
  it('ships the same prop stems the client loads', () => {
    for (const scene of SCENES) {
      expect([...SET_RUNTIME_PROPS[scene]!]).toEqual([...chessSetProps(scene)]);
    }
  });

  it('keeps every loaded room prop at its shipped bake sizes in the repository', () => {
    const paths: string[] = [];
    for (const scene of SCENES) {
      for (const file of chessSetProps(scene)) {
        for (const size of shippedSetTextureSizes(scene, file)) {
          paths.push(`public/sets/${scene}/${size}/${file}.glb`);
        }
      }
    }
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(existsSync(path), path).toBe(true);
    const ignored = ignoredPaths(paths);
    expect([...ignored]).toEqual([]);
  });

  it('ships Meshy set props with normals smoothed under 60 degrees', () => {
    const leftovers: string[] = [];
    for (const scene of SCENES) {
      for (const file of chessSetProps(scene)) {
        const size = shippedSetTextureSizes(scene, file)[0];
        if (size === undefined) continue;
        const path = `public/sets/${scene}/${size}/${file}.glb`;
        const { json, bin } = parseGlb(readFileSync(path));
        const attrs = primitive(json).attributes as { POSITION: number; NORMAL?: number };
        if (attrs.NORMAL === undefined) continue;
        const positions = readFloat3(json, bin, attrs.POSITION);
        const normals = readFloat3(json, bin, attrs.NORMAL);
        const faceted = countFacetedSplits(positions, normals, MESHY_NORMAL_CREASE);
        if (faceted > 0) leftovers.push(`${scene}/${file}: ${faceted}`);
      }
    }
    expect(leftovers).toEqual([]);
  });
});
