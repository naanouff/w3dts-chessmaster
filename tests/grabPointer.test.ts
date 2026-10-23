/**
 * @file grabPointer.test.ts
 * @description Grab pointer sample and select intent, without InputManager.
 */

import { describe, expect, it } from 'vitest';
import { mat4 } from 'gl-matrix';
import {
  chessGrabSelectIntent,
  sampleChessGrabPointer,
  viewProjectionLookAt,
  type ChessGrabPointerSample,
} from '../src/chess/index';

const rect = { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 };

function sample(partial: Partial<{
  clientX: number;
  clientY: number;
  primaryDown: boolean;
  viewProjection: mat4 | null;
  canvasRect: typeof rect | null;
}>): ChessGrabPointerSample {
  const vp =
    partial.viewProjection === null
      ? null
      : (partial.viewProjection ??
        viewProjectionLookAt([0, 0.55, -0.72], [0, 0.02, 0], (38 * Math.PI) / 180, 2, 0.05, 20));
  return sampleChessGrabPointer({
    clientX: partial.clientX ?? 100,
    clientY: partial.clientY ?? 50,
    canvasRect: partial.canvasRect === undefined ? rect : partial.canvasRect,
    viewProjection: vp,
    primaryDown: partial.primaryDown ?? false,
  });
}

describe('grab pointer', () => {
  it('builds a ray sample over the play surface without reading InputManager', () => {
    const over = sample({ clientX: 100, clientY: 50, primaryDown: true });
    expect(over.overPlaySurface).toBe(true);
    expect(over.primaryDown).toBe(true);
    expect(over.ray).not.toBeNull();
    expect(over.ray!.origin.length).toBe(3);
    expect(over.ray!.direction.length).toBe(3);

    const outside = sample({ clientX: -10, clientY: 50 });
    expect(outside.overPlaySurface).toBe(false);
    // Off-canvas still yields a ray so a held piece can follow past the edge.
    expect(outside.ray).not.toBeNull();
  });

  it('maps primary edges to acquire, drag, and release intents', () => {
    const down = sample({ primaryDown: true });
    expect(chessGrabSelectIntent(down, false, false)).toBe('down');
    expect(chessGrabSelectIntent(down, true, true)).toBe('hold');
    const up = sample({ primaryDown: false });
    expect(chessGrabSelectIntent(up, true, true)).toBe('up');
    expect(chessGrabSelectIntent(up, false, false)).toBe('hover');
    const idle = sample({ clientX: -1, primaryDown: false });
    expect(chessGrabSelectIntent(idle, false, false)).toBe('idle');
  });
});
