/**
 * @file chessPieceReview.test.ts
 * @description The room review can frame one white piece and hide the rest.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chessSetBoardY } from '../src/renderer/host/chessAmbiance';
import {
  chessReviewPiece,
  reviewPieceCamera,
  reviewPieceVisible,
  setChessReviewPiece,
  subscribeChessReviewPiece,
} from '../src/renderer/host/chessPieceReview';

describe('piece review', () => {
  it('shows the set until one white piece is chosen', () => {
    setChessReviewPiece(null);
    expect(chessReviewPiece()).toBeNull();
    expect(reviewPieceVisible(null, { color: 'black', role: 'pawn', square: 'e7' })).toBe(true);
    const seen: string[] = [];
    const stop = subscribeChessReviewPiece((role) => seen.push(role ?? 'set'));
    setChessReviewPiece('queen');
    stop();
    setChessReviewPiece('king');
    expect(seen).toEqual(['queen']);
    expect(chessReviewPiece()).toBe('king');
    expect(reviewPieceVisible('king', { color: 'white', role: 'king', square: 'e1' })).toBe(true);
    expect(reviewPieceVisible('king', { color: 'white', role: 'queen', square: 'd1' })).toBe(false);
    expect(reviewPieceVisible('king', { color: 'black', role: 'king', square: 'e8' })).toBe(false);
    expect(reviewPieceVisible('king', { color: 'black', role: 'king', square: 'e8' }, 'black')).toBe(true);
    expect(reviewPieceVisible('king', { color: 'white', role: 'king', square: 'e1' }, 'black')).toBe(false);
    expect(reviewPieceVisible('pawn', { color: 'white', role: 'pawn', square: 'd2' })).toBe(false);
    expect(reviewPieceVisible('pawn', { color: 'white', role: 'pawn', square: 'e2' })).toBe(true);
    setChessReviewPiece(null);
  });

  it('frames the chosen piece from the white side, above the room floor', () => {
    const boardY = chessSetBoardY('salon');
    const pose = reviewPieceCamera(boardY, 'pawn');
    expect(pose.eye[2]).toBeLessThan(pose.target[2]);
    expect(pose.target[1]).toBeGreaterThan(boardY);
    const distance = Math.hypot(
      pose.eye[0] - pose.target[0],
      pose.eye[1] - pose.target[1],
      pose.eye[2] - pose.target[2]
    );
    expect(distance).toBeLessThan(0.4);
    expect(distance).toBeGreaterThan(0.2);
    const black = reviewPieceCamera(boardY, 'king', 'black');
    expect(black.eye[2]).toBeGreaterThan(black.target[2]);
  });

  it('offers the six white pieces on the review bar', () => {
    const bar = readFileSync(new URL('../src/renderer/review/SetReviewBar.tsx', import.meta.url), 'utf8');
    expect(bar).toContain("{ id: 'pawn', label: 'Pion' }");
    expect(bar).toContain("{ id: 'rook', label: 'Tour' }");
    expect(bar).toContain("{ id: 'knight', label: 'Cavalier' }");
    expect(bar).toContain("{ id: 'bishop', label: 'Fou' }");
    expect(bar).toContain("{ id: 'queen', label: 'Reine' }");
    expect(bar).toContain("{ id: 'king', label: 'Roi' }");
    expect(bar).toContain('setChessReviewPiece');
    expect(bar).toContain('Noir');
    expect(bar).toContain('setChessReviewColor');
    const host = readFileSync(new URL('../src/renderer/host/ChessDemoProject.ts', import.meta.url), 'utf8');
    expect(host).toContain('reviewPieceVisible');
    expect(host).toContain('reviewPieceCamera');
  });
});
