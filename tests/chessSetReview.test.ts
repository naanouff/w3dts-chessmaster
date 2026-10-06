/**
 * @file chessSetReview.test.ts
 * @description The ambiance review is a flag on the game client, with the game camera and a wider frame.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLUID_GRAPHICS,
  gamePassNames,
  pieceTextureSize,
} from '../src/renderer/graphics/chessGraphicsSettings';
import {
  CHESS_REVIEW_GRAPHICS,
  CHESS_REVIEW_POSES,
  chessReviewFrame,
  isChessSetReview,
  requestChessCameraArrival,
  setChessReviewFrame,
  subscribeChessCameraArrival,
  subscribeChessReviewFrame,
} from '../src/renderer/host/chessSetReview';
import { reviewSearchFromArgv } from '../src/main/reviewArgv';

describe('chess set review', () => {
  it('opens only when the client is asked for the review', () => {
    expect(isChessSetReview('')).toBe(false);
    expect(isChessSetReview('?chess=cpu')).toBe(false);
    expect(isChessSetReview('?review=1')).toBe(true);
    expect(isChessSetReview('review=ambiance')).toBe(true);
  });

  it('starts on the wide frame and keeps the game camera numbers', () => {
    expect(chessReviewFrame()).toBe('wide');
    expect(CHESS_REVIEW_POSES.game.eye).toEqual([0, 0.55, -0.72]);
    expect(CHESS_REVIEW_POSES.game.target).toEqual([0, 0.02, 0]);
    expect(CHESS_REVIEW_POSES.wide.eye).toEqual([0, 0.95, -2.35]);
    expect(CHESS_REVIEW_POSES.wide.target).toEqual([0, 0.28, 0.7]);
  });

  it('tells the host when the frame changes', () => {
    const seen: string[] = [];
    const stop = subscribeChessReviewFrame((frame) => seen.push(frame));
    setChessReviewFrame('game');
    setChessReviewFrame('wide');
    stop();
    setChessReviewFrame('game');
    expect(seen).toEqual(['game', 'wide']);
    setChessReviewFrame('wide');
  });

  it('asks the host to replay the camera arrival', () => {
    const seen: number[] = [];
    const stop = subscribeChessCameraArrival(() => seen.push(seen.length));
    requestChessCameraArrival();
    requestChessCameraArrival();
    stop();
    requestChessCameraArrival();
    expect(seen).toEqual([0, 1]);
  });

  it('judges the rooms with the finish on, without touching the stored game profile', () => {
    expect(CHESS_REVIEW_GRAPHICS.ambientOcclusion).toBe(true);
    expect(CHESS_REVIEW_GRAPHICS.reflections).toBe(true);
    expect(CHESS_REVIEW_GRAPHICS.bloom).toBe(true);
    expect(pieceTextureSize(CHESS_REVIEW_GRAPHICS.textureQuality)).toBe(1024);
    const names = gamePassNames(CHESS_REVIEW_GRAPHICS);
    expect(names).toContain('04b_HBAO');
    expect(names).toContain('05_SSR_Floor');
    expect(names).toContain('06_Bright');
    expect(FLUID_GRAPHICS.bloom).toBe(false);
  });

  it('offers the garden on the review bar', () => {
    const source = readFileSync(new URL('../src/renderer/review/SetReviewBar.tsx', import.meta.url), 'utf8');
    expect(source).toContain("{ id: 'jardin', label: 'Jardin' }");
  });

  it('forwards a review launch argument into the window query', () => {
    expect(reviewSearchFromArgv(['electron', '.'])).toBe('');
    expect(reviewSearchFromArgv(['electron', '.', '--review'])).toBe('review=1');
    expect(reviewSearchFromArgv(['electron', '.', '--review=1'])).toBe('review=1');
  });
});
