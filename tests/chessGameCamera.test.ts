/**
 * @file chessGameCamera.test.ts
 * @description Game camera pose mirrors on Z when the local player is black.
 */

import { describe, expect, it } from 'vitest';
import { chessGameCameraPose } from '../src/renderer/host/chessGameCamera';
import { CHESS_REVIEW_POSES } from '../src/renderer/host/chessSetReview';

describe('chessGameCameraPose', () => {
  it('keeps the white-side game pose for white', () => {
    const white = CHESS_REVIEW_POSES.game;
    expect(chessGameCameraPose('game', 'white')).toEqual({
      eye: [white.eye[0], white.eye[1], white.eye[2]],
      target: [white.target[0], white.target[1], white.target[2]],
    });
  });

  it('mirrors eye and target Z so black pieces sit in the foreground', () => {
    const white = CHESS_REVIEW_POSES.game;
    const black = chessGameCameraPose('game', 'black');
    expect(black.eye).toEqual([white.eye[0], white.eye[1], -white.eye[2]]);
    expect(black.target).toEqual([white.target[0], white.target[1], -white.target[2]]);
    expect(black.eye[2]).toBeCloseTo(0.72);
  });
});
