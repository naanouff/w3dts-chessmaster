/**
 * @file hdPieceAssets.test.ts
 * @description The installer must contain the HD piece meshes the client fetches.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BOARD_BAKE_SIZES,
  PIECE_STEMS,
  ROYAL_PIECE_STEMS,
  pieceBakeSizes,
} from '../scripts/pieceBakeSizes.mjs';

const PIECES = PIECE_STEMS;

const NON_ROYAL = PIECE_STEMS.filter((stem) => !ROYAL_PIECE_STEMS.includes(stem));

function ignoredPaths(paths: string[]): Set<string> {
  const result = spawnSync('git', ['check-ignore', '--', ...paths], { encoding: 'utf8' });
  return new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  );
}

/** Co-located vertices whose normals meet under the crease but were left split. */
function creaseLeaks(name: string, cosLimit: number): number {
  const file = readFileSync(`public/models/chess/${name}.wmesh`);
  const count = file.readUInt32LE(8);
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const position = file.readFloatLE(16 + (i * 20 + axis) * 4);
      pos[i * 3 + axis] = position;
      nrm[i * 3 + axis] = file.readFloatLE(16 + (i * 20 + 7 + axis) * 4);
      min[axis] = Math.min(min[axis]!, position);
      max[axis] = Math.max(max[axis]!, position);
    }
  }
  const span = Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!, 1e-8);
  const quantize = 1e5 / span;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const key = [0, 1, 2].map((axis) => Math.round(pos[i * 3 + axis]! * quantize)).join(',');
    const group = groups.get(key);
    if (group) group.push(i);
    else groups.set(key, [i]);
  }
  let leaks = 0;
  for (const group of groups.values()) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const i = group[a]!;
        const j = group[b]!;
        const dot = nrm[i * 3]! * nrm[j * 3]! + nrm[i * 3 + 1]! * nrm[j * 3 + 1]! + nrm[i * 3 + 2]! * nrm[j * 3 + 2]!;
        const same =
          (nrm[i * 3]! - nrm[j * 3]!) ** 2 +
            (nrm[i * 3 + 1]! - nrm[j * 3 + 1]!) ** 2 +
            (nrm[i * 3 + 2]! - nrm[j * 3 + 2]!) ** 2 <
          1e-8;
        if (dot + 1e-4 >= cosLimit && !same) leaks += 1;
      }
    }
  }
  return leaks;
}

/** Axis-aligned size of a baked piece, in metres. */
function meshSpan(name: string): { height: number; width: number } {
  const file = readFileSync(`public/models/chess/${name}.wmesh`);
  const count = file.readUInt32LE(8);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = file.readFloatLE(16 + (i * 20 + axis) * 4);
      min[axis] = Math.min(min[axis]!, value);
      max[axis] = Math.max(max[axis]!, value);
    }
  }
  return {
    height: max[1]! - min[1]!,
    width: Math.max(max[0]! - min[0]!, max[2]! - min[2]!),
  };
}

describe('HD piece assets', () => {
  it('keeps each piece mesh and its shipped baked maps in the repository', () => {
    const paths: string[] = [];
    for (const piece of PIECES) {
      paths.push(`public/models/chess/${piece}.wmesh`);
      for (const size of pieceBakeSizes(piece)) {
        for (const kind of ['color', 'normal', 'orm'] as const) {
          paths.push(`public/models/chess/tex/${size}/${piece}-${kind}.webp`);
        }
      }
    }
    for (const size of BOARD_BAKE_SIZES) {
      for (const kind of ['color', 'normal', 'orm'] as const) {
        paths.push(`public/models/chess/tex/${size}/chess_board_B-${kind}.webp`);
      }
    }
    for (const path of paths) expect(existsSync(path), path).toBe(true);
    const ignored = ignoredPaths(paths);
    expect([...ignored]).toEqual([]);
  });

  it('omits 2048 maps for non-royal pieces so the installer stays lean', () => {
    expect(pieceBakeSizes('b_pion')).toEqual([256, 512, 1024]);
    expect(pieceBakeSizes('b_reine')).toEqual([512, 1024, 2048]);
    for (const piece of NON_ROYAL) {
      for (const kind of ['color', 'normal', 'orm'] as const) {
        const path = `public/models/chess/tex/2048/${piece}-${kind}.webp`;
        expect(existsSync(path), path).toBe(false);
      }
    }
    for (const piece of ROYAL_PIECE_STEMS) {
      for (const kind of ['color', 'normal', 'orm'] as const) {
        const path = `public/models/chess/tex/256/${piece}-${kind}.webp`;
        expect(existsSync(path), path).toBe(false);
      }
    }
  });


  it('uses the Print master mesh for the white pawn, with its base on the board', () => {
    const file = readFileSync('public/models/chess/b_pion.wmesh');
    const count = file.readUInt32LE(8);
    expect(file.readUInt32LE(12) / 3).toBe(30476);
    let minY = Infinity;
    for (let i = 0; i < count; i++) {
      minY = Math.min(minY, file.readFloatLE(16 + (i * 20 + 1) * 4));
    }
    expect(minY).toBe(0);
    expect(meshSpan('b_pion').height).toBeCloseTo(0.054, 3);
  });

  it('keeps each white piece at its Staunton height, base on the board', () => {
    const heights: Record<string, number> = {
      b_tour: 0.06,
      b_cavalier: 0.062,
      b_fou: 0.062,
      b_reine: 0.078,
      b_roi: 0.092,
    };
    const triangles: Record<string, number> = {
      b_tour: 30222,
      b_cavalier: 30698,
      b_fou: 30678,
      b_reine: 30978,
      b_roi: 30522,
    };
    for (const [name, count] of Object.entries(triangles)) {
      const file = readFileSync(`public/models/chess/${name}.wmesh`);
      const verts = file.readUInt32LE(8);
      expect(file.readUInt32LE(12) / 3).toBe(count);
      let minY = Infinity;
      for (let i = 0; i < verts; i++) {
        minY = Math.min(minY, file.readFloatLE(16 + (i * 20 + 1) * 4));
      }
      expect(minY).toBe(0);
      expect(meshSpan(name).height).toBeCloseTo(heights[name]!, 3);
    }
  });

  it('keeps each black piece at its Staunton height from its Print master, base on the board', () => {
    const heights: Record<string, number> = {
      n_pion: 0.054,
      n_tour: 0.06,
      n_cavalier: 0.062,
      n_fou: 0.062,
      n_reine: 0.078,
      n_roi: 0.092,
    };
    const triangles: Record<string, number> = {
      n_pion: 30786,
      n_tour: 30348,
      n_cavalier: 31146,
      n_fou: 30750,
      n_reine: 30758,
      n_roi: 30010,
    };
    for (const [name, count] of Object.entries(triangles)) {
      const file = readFileSync(`public/models/chess/${name}.wmesh`);
      const verts = file.readUInt32LE(8);
      expect(file.readUInt32LE(12) / 3).toBe(count);
      let minY = Infinity;
      for (let i = 0; i < verts; i++) {
        minY = Math.min(minY, file.readFloatLE(16 + (i * 20 + 1) * 4));
      }
      expect(minY).toBe(0);
      expect(meshSpan(name).height).toBeCloseTo(heights[name]!, 3);
    }
  });

  it('smooths split normals under 60 degrees on every piece', () => {
    const cosLimit = Math.cos(Math.PI / 3);
    for (const name of PIECES) {
      expect(creaseLeaks(name, cosLimit)).toBe(0);
    }
  });

  it('keeps the Staunton height ladder from pawn to king', () => {
    const pawn = meshSpan('b_pion');
    const rook = meshSpan('b_tour');
    const knight = meshSpan('b_cavalier');
    const bishop = meshSpan('b_fou');
    const queen = meshSpan('b_reine');
    const king = meshSpan('b_roi');
    expect(pawn.height).toBeCloseTo(0.054, 3);
    expect(rook.height).toBeCloseTo(0.06, 3);
    expect(knight.height).toBeCloseTo(0.062, 3);
    expect(bishop.height).toBeCloseTo(0.062, 3);
    expect(queen.height).toBeCloseTo(0.078, 3);
    expect(king.height).toBeCloseTo(0.092, 3);
    expect(pawn.height).toBeLessThan(rook.height);
    expect(rook.height).toBeLessThan(queen.height);
    expect(queen.height).toBeLessThan(king.height);
    expect(pawn.width).toBeLessThan(king.width);
    expect(meshSpan('n_pion').height).toBeCloseTo(pawn.height, 3);
    expect(meshSpan('n_roi').height).toBeCloseTo(king.height, 3);
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
