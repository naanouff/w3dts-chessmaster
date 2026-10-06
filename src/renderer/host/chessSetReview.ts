/**
 * @file chessSetReview.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Authoring review of the staged rooms, rendered by the game engine.
 */

import {
  GRAPHICS_PRESETS,
  FLUID_GRAPHICS,
  type ChessGraphicsSettings,
} from '../graphics/chessGraphicsSettings';

/** Game camera, or a wider frame that shows the room. */
export type ChessReviewFrame = 'game' | 'wide';

/**
 * Profile the review judges a room on: the Quality preset, so occlusion, reflections
 * and bloom are in the image. Applied in memory only; the match keeps its stored profile.
 */
export const CHESS_REVIEW_GRAPHICS: ChessGraphicsSettings =
  GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite')?.settings ?? FLUID_GRAPHICS;

/**
 * Prop maps the review reads, the master size. A match stays on its graphics tier:
 * 2048 is an authoring cost, not a playable one.
 */
export const CHESS_SET_REVIEW_TEXTURE_SIZE = 2048;

/** Eye and look-at for each review frame, in metres. */
export const CHESS_REVIEW_POSES: Record<
  ChessReviewFrame,
  { eye: readonly [number, number, number]; target: readonly [number, number, number] }
> = {
  game: { eye: [0, 0.55, -0.72], target: [0, 0.02, 0] },
  wide: { eye: [0, 0.95, -2.35], target: [0, 0.28, 0.7] },
};

let frame: ChessReviewFrame = 'wide';
const listeners = new Set<(frame: ChessReviewFrame) => void>();
const arrivalListeners = new Set<() => void>();

/**
 * True when this window is the room review, not a match.
 * @param search - `location.search`, with or without the leading `?`.
 */
export function isChessSetReview(search: string): boolean {
  const raw = new URLSearchParams(search.replace(/^\?/, '')).get('review');
  return raw === '1' || raw === 'ambiance';
}

/**
 * Frame the review opens on. The match does not read this.
 * @returns `wide` until the review bar picks another frame.
 */
export function chessReviewFrame(): ChessReviewFrame {
  return frame;
}

/**
 * Moves the review camera and tells the host.
 * @param next - Game camera or the wider frame.
 */
export function setChessReviewFrame(next: ChessReviewFrame): void {
  frame = next;
  for (const listener of listeners) listener(frame);
}

/**
 * Subscribes to frame changes. Does not emit the current value.
 * @param listener - Called with the new frame.
 * @returns Unsubscribe.
 */
export function subscribeChessReviewFrame(
  listener: (frame: ChessReviewFrame) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Asks the host to replay the room's camera arrival. The review bar is the caller.
 */
export function requestChessCameraArrival(): void {
  for (const listener of arrivalListeners) listener();
}

/**
 * Subscribes to arrival requests. Does not replay the current one.
 * @param listener - Called when the review asks for the fly-in.
 * @returns Unsubscribe.
 */
export function subscribeChessCameraArrival(listener: () => void): () => void {
  arrivalListeners.add(listener);
  return () => {
    arrivalListeners.delete(listener);
  };
}
