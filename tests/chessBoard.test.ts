/**
 * @file chessBoard.test.ts
 * @project w3dts
 * @description Square ↔ world bijection for the centred board.
 */

import { describe, expect, it } from 'vitest';
import {
  CHESS_BOARD_BORDER_FRAC,
  CHESS_BOARD_MESH_EXTENT,
  CHESS_SQUARE_SIZE,
  squareToWorld,
  worldToSquare,
} from '../src/chess/index';

const SQUARES = ['a1', 'h1', 'a8', 'h8', 'e4', 'd5'] as const;

describe('chessBoard', () => {
  it('round-trips algebraic squares through world XZ', () => {
    for (const sq of SQUARES) {
      const p = squareToWorld(sq);
      expect(worldToSquare(p[0]!, p[2]!)).toBe(sq);
    }
  });

  it('places a1 at −X −Z and h8 at +X +Z', () => {
    const a1 = squareToWorld('a1');
    const h8 = squareToWorld('h8');
    expect(a1[0]!).toBeCloseTo(-3.5 * CHESS_SQUARE_SIZE);
    expect(a1[2]!).toBeCloseTo(-3.5 * CHESS_SQUARE_SIZE);
    expect(h8[0]!).toBeCloseTo(3.5 * CHESS_SQUARE_SIZE);
    expect(h8[2]!).toBeCloseTo(3.5 * CHESS_SQUARE_SIZE);
  });

  it('returns null outside the board', () => {
    expect(worldToSquare(2, 0)).toBeNull();
    expect(worldToSquare(0, -2)).toBeNull();
  });

  it('places square centres inside the inner albedo, not the wooden frame', () => {
    const half = CHESS_BOARD_MESH_EXTENT / 2;
    for (const sq of SQUARES) {
      const p = squareToWorld(sq);
      const u = (p[0]! + half) / CHESS_BOARD_MESH_EXTENT;
      const v = (half - p[2]!) / CHESS_BOARD_MESH_EXTENT;
      expect(u).toBeGreaterThan(CHESS_BOARD_BORDER_FRAC);
      expect(u).toBeLessThan(1 - CHESS_BOARD_BORDER_FRAC);
      expect(v).toBeGreaterThan(CHESS_BOARD_BORDER_FRAC);
      expect(v).toBeLessThan(1 - CHESS_BOARD_BORDER_FRAC);
    }
  });
});
