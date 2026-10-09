/**
 * @file setAssets.test.ts
 * @description Runtime set props under public/sets must ship with the installer.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SET_RUNTIME_PROPS } from '../scripts/setProps.mjs';
import { shippedSetTextureSizes } from '../src/renderer/graphics/texelDensity';
import { chessSetProps, type ChessAmbianceId } from '../src/renderer/host/chessAmbiance';

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
});
