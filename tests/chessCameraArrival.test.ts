/**
 * @file chessCameraArrival.test.ts
 * @description The fly-in that opens a new game in each room.
 */

import { describe, expect, it } from 'vitest';
import { CHESS_AMBIANCES } from '../src/renderer/host/chessAmbiance';
import {
  chessCameraArrival,
  chessCameraArrivalPose,
} from '../src/renderer/host/chessCameraArrival';
import { CHESS_REVIEW_POSES } from '../src/renderer/host/chessSetReview';

describe('chess camera arrival', () => {
  it('flies each room onto the game camera', () => {
    const game = CHESS_REVIEW_POSES.game;
    expect(chessCameraArrival('atelier').duration).toBe(4.5);
    expect(chessCameraArrival('salon').duration).toBe(6);
    expect(chessCameraArrival('club').duration).toBe(2.8);
    for (const id of CHESS_AMBIANCES) {
      const start = chessCameraArrivalPose(id, 0);
      const end = chessCameraArrivalPose(id, 1);
      expect(end.eye).toEqual([game.eye[0], game.eye[1], game.eye[2]]);
      expect(end.look).toEqual([game.target[0], game.target[1], game.target[2]]);
      expect(start.eye).not.toEqual(end.eye);
    }
    expect(chessCameraArrivalPose('atelier', 0).eye).toEqual([1.35, 0.72, -1.15]);
    expect(chessCameraArrivalPose('salon', 0).eye).toEqual([0.2, 0.7, 1.55]);
    expect(chessCameraArrivalPose('salon', 0.5).eye).toEqual([0.9, 0.6, 0.4]);
    expect(chessCameraArrivalPose('club', 0).eye).toEqual([-1.6, 0.35, -1.4]);
  });
});
