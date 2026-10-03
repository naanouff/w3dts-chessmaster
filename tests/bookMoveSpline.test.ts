/**
 * @file bookMoveSpline.test.ts
 * @description CHESS-B6b: book-move polyline (knight L, lifted arc).
 */

import { describe, expect, it } from 'vitest';
import {
  CHESS_BOARD_SURFACE_Y,
  bookMoveSplineLength,
  knightElbowIndices,
  sampleBookMoveSpline,
  squareToWorld,
} from '../src/chess/index';

describe('sampleBookMoveSpline', () => {
  it('lifts a pawn push above the varnish', () => {
    const pts = sampleBookMoveSpline('e2', 'e4');
    expect(pts.length).toBeGreaterThan(4);
    const mid = pts[Math.floor(pts.length / 2)]!;
    expect(mid[1]!).toBeGreaterThan(CHESS_BOARD_SURFACE_Y + 0.01);
    expect(bookMoveSplineLength(pts)).toBeGreaterThan(0.1);
  });

  it('routes a knight on an L, not the diagonal', () => {
    const elbow = knightElbowIndices('b1', 'c3');
    expect(elbow).toEqual({ file: 1, rank: 2 });
    const pts = sampleBookMoveSpline('b1', 'c3', { knight: true });
    const mid = pts[Math.floor(pts.length / 2)]!;
    const b1 = squareToWorld('b1');
    const c3 = squareToWorld('c3');
    const diagX = (b1[0]! + c3[0]!) / 2;
    const diagZ = (b1[2]! + c3[2]!) / 2;
    const distToDiag = Math.hypot(mid[0]! - diagX, mid[2]! - diagZ);
    expect(distToDiag).toBeGreaterThan(0.02);
  });
});
