/**
 * @file fileRankLabels.test.ts
 * @description CHESS-B6a: file/rank poses sit on the frame, not the 8×8.
 */

import { describe, expect, it } from 'vitest';
import { vec3 } from 'gl-matrix';
import {
  CHESS_BOARD_EXTENT,
  CHESS_BOARD_MESH_EXTENT,
  chessBoardLabelPoses,
  chessBoardLabelQuat,
  chessBoardLabelSize,
  fillChessGlyphAlbedo,
  squareToWorld,
  worldToSquare,
} from '../src/chess/index';

describe('chessBoardLabelPoses', () => {
  it('returns 32 poses (a–h both rims, 1–8 both flanks)', () => {
    const poses = chessBoardLabelPoses('white');
    expect(poses).toHaveLength(32);
    const files = poses.filter((p) => p.kind === 'file');
    const ranks = poses.filter((p) => p.kind === 'rank');
    expect(files).toHaveLength(16);
    expect(ranks).toHaveLength(16);
    expect(files.map((p) => p.glyph).join('')).toBe('abcdefghabcdefgh');
    expect(ranks.map((p) => p.glyph).join('')).toBe('1234567812345678');
  });

  it('sits on the wooden rim, not on a play square', () => {
    const playHalf = CHESS_BOARD_EXTENT / 2;
    const meshHalf = CHESS_BOARD_MESH_EXTENT / 2;
    for (const color of ['white', 'black'] as const) {
      for (const pose of chessBoardLabelPoses(color)) {
        expect(worldToSquare(pose.x, pose.z)).toBeNull();
        const radial = Math.max(Math.abs(pose.x), Math.abs(pose.z));
        expect(radial).toBeGreaterThan(playHalf);
        expect(radial).toBeLessThan(meshHalf + 1e-6);
      }
    }
  });

  it('projects files and ranks downward onto the frame top (not into the flank)', () => {
    const dir = vec3.create();
    for (const pose of chessBoardLabelPoses('white')) {
      vec3.transformQuat(dir, vec3.fromValues(0, 0, -1), chessBoardLabelQuat(pose));
      expect(dir[1]!).toBeLessThan(-0.9);
    }
  });

  it('faces the player of each edge (white −Z, black +Z, flanks outward)', () => {
    const up = vec3.create();
    for (const color of ['white', 'black'] as const) {
      for (const pose of chessBoardLabelPoses(color)) {
        vec3.transformQuat(up, vec3.fromValues(0, 1, 0), chessBoardLabelQuat(pose));
        if (pose.kind === 'file') {
          if (pose.z < 0) expect(up[2]!).toBeGreaterThan(0.9);
          else expect(up[2]!).toBeLessThan(-0.9);
        } else if (pose.x < 0) expect(up[0]!).toBeGreaterThan(0.9);
        else expect(up[0]!).toBeLessThan(-0.9);
      }
    }
  });

  it('puts files on both rims and ranks on both flanks (SAN Nf3 / Nc6)', () => {
    const white = chessBoardLabelPoses('white');
    const black = chessBoardLabelPoses('black');
    const fileA = white.filter((p) => p.glyph === 'a' && p.kind === 'file');
    expect(fileA).toHaveLength(2);
    expect(fileA.some((p) => p.z < 0)).toBe(true);
    expect(fileA.some((p) => p.z > 0)).toBe(true);
    const rank3 = white.filter((p) => p.glyph === '3' && p.kind === 'rank');
    const rank6 = white.filter((p) => p.glyph === '6' && p.kind === 'rank');
    expect(rank3).toHaveLength(2);
    expect(rank6).toHaveLength(2);
    expect(rank3.some((p) => p.x < 0) && rank3.some((p) => p.x > 0)).toBe(true);
    expect(rank3[0]!.z).toBeCloseTo(squareToWorld('f3')[2]!);
    expect(rank6[0]!.z).toBeCloseTo(squareToWorld('c6')[2]!);
    const aNearBlack = black.filter((p) => p.glyph === 'a' && p.kind === 'file' && p.z > 0);
    expect(aNearBlack).toHaveLength(1);
  });

  it('sizes glyphs to two-thirds of the border width', () => {
    const border = (CHESS_BOARD_MESH_EXTENT - CHESS_BOARD_EXTENT) / 2;
    expect(chessBoardLabelSize()).toBeCloseTo(border * (2 / 3));
  });
});

describe('fillChessGlyphAlbedo', () => {
  it('draws opaque ink for known glyphs and stays transparent in the margin', () => {
    const a = fillChessGlyphAlbedo('a', 64);
    let ink = 0;
    for (let i = 3; i < a.length; i += 4) if ((a[i] ?? 0) > 0) ink++;
    expect(ink).toBeGreaterThan(80);
    expect(a[3]).toBe(0);
  });

  it('paints a champagne inlay (not yellow plinth gold) with a darker groove', () => {
    const a = fillChessGlyphAlbedo('a', 64);
    let minLuma = 255;
    let maxLuma = 0;
    let sumB = 0;
    let sumR = 0;
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if ((a[i + 3] ?? 0) < 40) continue;
      const r = a[i] ?? 0;
      const b = a[i + 2] ?? 0;
      if (r < minLuma) minLuma = r;
      if (r > maxLuma) maxLuma = r;
      if (r > 140) {
        sumR += r;
        sumB += b;
        n++;
      }
    }
    expect(maxLuma).toBeGreaterThan(150);
    expect(minLuma).toBeLessThan(90);
    expect(maxLuma - minLuma).toBeGreaterThan(60);
    expect(n).toBeGreaterThan(0);
    expect(sumB / n).toBeGreaterThan((sumR / n) * 0.7);
  });
});
