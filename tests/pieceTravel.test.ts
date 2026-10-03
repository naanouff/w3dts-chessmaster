/**
 * @file pieceTravel.test.ts
 * @description CHESS-B6c: piece hop + cemetery slots.
 */

import { describe, expect, it } from 'vitest';
import {
  CHESS_BOARD_MESH_EXTENT,
  CHESS_BOARD_SURFACE_Y,
  assignCemeterySlot,
  cemeterySlotIsOffBoard,
  samplePieceTravel,
} from '../src/chess/index';

describe('samplePieceTravel', () => {
  it('starts on from, lands on to, and lifts at mid-arc', () => {
    const a = samplePieceTravel('e2', 'e4', 0);
    const b = samplePieceTravel('e2', 'e4', 1);
    const mid = samplePieceTravel('e2', 'e4', 0.5);
    expect(a[0]).toBeCloseTo(samplePieceTravel('e2', 'e2', 0)[0]!);
    expect(b[2]).toBeCloseTo(samplePieceTravel('e4', 'e4', 0)[2]!);
    expect(mid[1]!).toBeGreaterThan(CHESS_BOARD_SURFACE_Y + 0.02);
  });
});

describe('assignCemeterySlot', () => {
  it('places captured pieces off the 8×8 on opposite rails', () => {
    const w0 = assignCemeterySlot('white', 0);
    const b0 = assignCemeterySlot('black', 0);
    const w1 = assignCemeterySlot('white', 1);
    expect(cemeterySlotIsOffBoard(w0)).toBe(true);
    expect(cemeterySlotIsOffBoard(b0)).toBe(true);
    expect(w0.x).toBeLessThan(-CHESS_BOARD_MESH_EXTENT / 2);
    expect(b0.x).toBeGreaterThan(CHESS_BOARD_MESH_EXTENT / 2);
    expect(w1.z).toBeGreaterThan(w0.z);
  });
});
