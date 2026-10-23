/**
 * @file grabPointer.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Modality-agnostic grab pointer sample for mouse, touch, and later VR rays.
 */

import type { mat4 } from 'gl-matrix';
import { clientPointToNdc } from './grabMath';
import { pickRayFromViewProjection, type ChessPickRay } from './pickRay';

/** One frame of grab input. The spring never reads a screen pointer. */
export interface ChessGrabPointerSample {
  /** World ray through the play surface, or null when the pointer is off-canvas. */
  ray: ChessPickRay | null;
  /** Primary button, touch, or trigger held. */
  primaryDown: boolean;
  /** True when the client point lies inside the game canvas. */
  overPlaySurface: boolean;
}

/** Canvas box in client coordinates. Matches `DOMRect` fields used for hit-testing. */
export interface ChessGrabCanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface SampleChessGrabPointerInput {
  clientX: number;
  clientY: number;
  canvasRect: ChessGrabCanvasRect | null;
  viewProjection: mat4 | null;
  primaryDown: boolean;
}

/**
 * Builds a grab sample from a 2D client point and the game camera VP.
 * @param input - Screen point, canvas box, VP, and primary button.
 * @returns Ray and flags. No `InputManager` dependency.
 */
export function sampleChessGrabPointer(input: SampleChessGrabPointerInput): ChessGrabPointerSample {
  const { canvasRect, viewProjection, primaryDown } = input;
  if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) {
    return { ray: null, primaryDown, overPlaySurface: false };
  }
  const overPlaySurface =
    input.clientX >= canvasRect.left &&
    input.clientX <= canvasRect.right &&
    input.clientY >= canvasRect.top &&
    input.clientY <= canvasRect.bottom;
  // Ray stays valid off-canvas so a held piece can follow the pointer past the edge.
  if (!viewProjection) {
    return { ray: null, primaryDown, overPlaySurface };
  }
  const ndc = clientPointToNdc(input.clientX, input.clientY, canvasRect);
  if (!ndc) return { ray: null, primaryDown, overPlaySurface };
  const ray = pickRayFromViewProjection(viewProjection, ndc.ndcX, ndc.ndcY);
  return { ray, primaryDown, overPlaySurface };
}

/** Host select phase derived from a sample and prior primary state. */
export type ChessGrabSelectIntent = 'down' | 'hold' | 'up' | 'hover' | 'idle';

/**
 * Maps a pointer sample to acquire / drag / release / hover.
 * @param sample - Current frame sample.
 * @param wasPrimaryDown - Previous frame's `primaryDown`.
 * @param grabbing - True while a piece is held.
 * @returns Intent for the host select loop.
 */
export function chessGrabSelectIntent(
  sample: ChessGrabPointerSample,
  wasPrimaryDown: boolean,
  grabbing: boolean
): ChessGrabSelectIntent {
  const just = sample.primaryDown && !wasPrimaryDown;
  const released = !sample.primaryDown && wasPrimaryDown;
  if (just) return 'down';
  if (sample.primaryDown && grabbing) return 'hold';
  if (released && grabbing) return 'up';
  if (!grabbing && sample.overPlaySurface) return 'hover';
  return 'idle';
}
