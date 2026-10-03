/**
 * @file hdPieceAssets.test.ts
 * @description The installer must contain the HD piece meshes the client fetches.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PIECES = [
  'b_pion',
  'b_tour',
  'b_cavalier',
  'b_fou',
  'b_reine',
  'b_roi',
  'n_pion',
  'n_tour',
  'n_cavalier',
  'n_fou',
  'n_reine',
  'n_roi',
] as const;

const SIZES = [256, 512, 1024] as const;

function ignoredPaths(paths: string[]): Set<string> {
  const result = spawnSync('git', ['check-ignore', '--', ...paths], { encoding: 'utf8' });
  return new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  );
}

describe('HD piece assets', () => {
  it('keeps each piece mesh and its baked maps in the repository', () => {
    const paths: string[] = [];
    for (const piece of PIECES) {
      paths.push(`public/models/chess/${piece}.wmesh`);
      for (const size of SIZES) {
        for (const kind of ['color', 'normal', 'orm'] as const) {
          paths.push(`public/models/chess/tex/${size}/${piece}-${kind}.webp`);
        }
      }
    }
    for (const path of paths) expect(existsSync(path), path).toBe(true);
    const ignored = ignoredPaths(paths);
    expect([...ignored]).toEqual([]);
  });

  it('leaves the source GLBs out of the repository', () => {
    const ignored = ignoredPaths([
      'public/models/chess/b_pion.glb',
      'docs/raw_assets/pieces/glb/b_pion.glb',
    ]);
    expect(ignored.has('public/models/chess/b_pion.glb')).toBe(true);
    expect(ignored.has('docs/raw_assets/pieces/glb/b_pion.glb')).toBe(true);
  });
});
