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
import { chessSetBoardY, type ChessAmbianceId } from './chessAmbiance';

/** Game camera, or a wider frame that shows the room. */
export type ChessReviewFrame = 'game' | 'wide';

const quality =
  GRAPHICS_PRESETS.find((preset) => preset.id === 'qualite')?.settings ?? FLUID_GRAPHICS;

/**
 * Profile the review judges a room on: the Quality preset, so occlusion and reflections
 * are in the image, plus the volume and depth-of-field passes under test. Bloom stays off.
 * Applied in memory only; the match keeps its stored profile.
 */
export const CHESS_REVIEW_GRAPHICS: ChessGraphicsSettings = {
  ...quality,
  volume: true,
  dof: true,
  bloom: false,
};

/**
 * Largest bake tier the review may read. Props resolve under that via scene density.
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

/** One depth-of-field pass. The engine reads the uniform every frame. */
export interface ReviewDofPass {
  name: string;
  uniforms?: { dofParams?: { value: number[] } };
}

/**
 * Points the focal plane at the centre of the board. The height follows the room.
 * @param passes - Render-graph passes. A missing pass is a no-op.
 * @param id - Room on screen.
 */
export function applyReviewDof(passes: readonly ReviewDofPass[] | undefined, id: ChessAmbianceId): void {
  const dof = passes?.find((pass) => pass.name === '10_DoF');
  const value = dof?.uniforms?.dofParams?.value;
  if (!value || value.length < 3) return;
  value[0] = 0;
  value[1] = chessSetBoardY(id);
  value[2] = 0;
}

/** Brightness is exposure. Contrast scales around mid grey. Saturation pulls toward grey. */
export interface ReviewGrade {
  brightness: number;
  contrast: number;
  saturation: number;
}

/** Indoor rooms: exposure, contrast around mid grey, then saturation. */
const INDOOR_GRADE: ReviewGrade = { brightness: 1.25, contrast: 1.4, saturation: 0.6 };

/**
 * Winter terrace: brighter, flatter grade so dark pieces stay readable under the moon.
 * Tuned in review (brightness 1.7, contrast 1.2, saturation 0.65).
 */
const TERRACE_GRADE: ReviewGrade = { brightness: 1.7, contrast: 1.2, saturation: 0.65 };

const DEFAULT_GRADE: Record<ChessAmbianceId, ReviewGrade> = {
  atelier: INDOOR_GRADE,
  salon: INDOOR_GRADE,
  club: INDOOR_GRADE,
  jardin: INDOOR_GRADE,
  terrasse: TERRACE_GRADE,
};

const grades = new Map<ChessAmbianceId, ReviewGrade>();
const gradeListeners = new Set<() => void>();

function clampGrade(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0.5, value));
}

/**
 * Grade stored for one room. An untouched room uses that room's default.
 * @param id - Room on screen.
 * @returns Brightness, contrast and saturation.
 */
export function reviewGrade(id: ChessAmbianceId): ReviewGrade {
  return grades.get(id) ?? DEFAULT_GRADE[id];
}

/**
 * Remembers the grade for one room and tells the host to write it.
 * @param id - Room the sliders belong to.
 * @param grade - Brightness, contrast and saturation, clamped to the slider range.
 */
export function setReviewGrade(id: ChessAmbianceId, grade: ReviewGrade): void {
  grades.set(id, {
    brightness: clampGrade(grade.brightness),
    contrast: clampGrade(grade.contrast),
    saturation: clampGrade(grade.saturation),
  });
  for (const listener of gradeListeners) listener();
}

/**
 * Subscribes to grade edits.
 * @param listener - Called after a room's grade changes.
 * @returns Unsubscribe.
 */
export function subscribeReviewGrade(listener: () => void): () => void {
  gradeListeners.add(listener);
  return () => gradeListeners.delete(listener);
}

/** One tone-map pass. The engine reads the uniforms every frame. */
export interface ReviewGradePass {
  name: string;
  uniforms?: {
    exposure?: { value: number };
    contrast?: { value: number };
    saturation?: { value: number };
  };
}

/**
 * Writes the room grade onto the tone mapper.
 * @param passes - Render-graph passes. A missing tone map is a no-op.
 * @param id - Room on screen.
 */
export function applyReviewGrade(passes: readonly ReviewGradePass[] | undefined, id: ChessAmbianceId): void {
  const tone = passes?.find((pass) => pass.name === 'Tone Mapping & Output');
  const grade = reviewGrade(id);
  if (tone?.uniforms?.exposure) tone.uniforms.exposure.value = grade.brightness;
  if (tone?.uniforms?.contrast) tone.uniforms.contrast.value = grade.contrast;
  if (tone?.uniforms?.saturation) tone.uniforms.saturation.value = grade.saturation;
}
