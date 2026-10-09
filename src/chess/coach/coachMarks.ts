/**
 * @file coachMarks.ts
 * @project w3dts
 * @description Colors and source squares for coach ghosts and the mistake cutout.
 */

/** Green, blue, yellow, then orange and violet. Red stays the mistake color. */
const GHOST_COLORS: readonly (readonly [number, number, number])[] = [
  [0.15, 0.95, 0.28],
  [0.22, 0.45, 1],
  [1, 0.86, 0.12],
  [1, 0.5, 0.08],
  [0.68, 0.32, 1],
];

const ERROR_COLOR: readonly [number, number, number] = [1, 0.08, 0.06];

/** Mask meshes match the piece. The ring is drawn outside this silhouette. */
export const COACH_MASK_SCALE = 1;

/** Piece standing on a square when a cutout line is checked. */
export interface CoachSquarePiece {
  role: string;
  color: string;
}

/** One ply of a line that can own a source cutout. */
export interface CoachCutoutStep {
  from: string;
  role: string;
  color: string;
}

/**
 * Color of the ghost at `index`. The first is the move to play now.
 * @param index - Zero-based ply in the search line, at most 4.
 */
export function coachGhostColor(index: number): readonly [number, number, number] {
  const clamped = Number.isFinite(index) ? Math.min(GHOST_COLORS.length - 1, Math.max(0, Math.floor(index))) : 0;
  return GHOST_COLORS[clamped] ?? GHOST_COLORS[0]!;
}

/** Red used only around the piece that just played a weak move. */
export function coachErrorColor(): readonly [number, number, number] {
  return ERROR_COLOR;
}

/** Metres. Far enough that an orbit still leaves the shell in front of its own piece. */
export const COACH_MASK_BIAS = 0.02;

/**
 * Moves the mask toward the camera so its front faces pass the depth test.
 * The offset follows the camera that is looking, not a fixed game pose.
 * A piece that is actually behind another stays hidden, so its contour is not drawn in the gap.
 * @param piece - World position of the piece, in metres.
 * @param camera - World position of the camera, in metres.
 * @param bias - Offset in metres. Defaults to {@link COACH_MASK_BIAS}.
 */
export function coachMaskPosition(
  piece: readonly [number, number, number],
  camera: readonly [number, number, number],
  bias = COACH_MASK_BIAS
): [number, number, number] {
  const dx = camera[0] - piece[0];
  const dy = camera[1] - piece[1];
  const dz = camera[2] - piece[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return [piece[0], piece[1], piece[2]];
  const scale = bias / len;
  return [piece[0] + dx * scale, piece[1] + dy * scale, piece[2] + dz * scale];
}

/**
 * One cutout per source square. The earliest ply wins. The mistake square stays red.
 * @param steps - Search line, destination ghosts already chosen.
 * @param mistakeSquare - Square of the weak move, or null.
 */
export function coachSourceMarks(
  steps: readonly { from: string }[],
  mistakeSquare: string | null
): { square: string; index: number }[] {
  const seen = new Set<string>();
  const marks: { square: string; index: number }[] = [];
  const limit = Math.min(5, steps.length);
  for (let index = 0; index < limit; index++) {
    const square = steps[index]?.from;
    if (!square || square === mistakeSquare || seen.has(square)) continue;
    seen.add(square);
    marks.push({ square, index });
  }
  return marks;
}

/**
 * Source squares that still hold a piece. An empty square keeps no contour.
 * @param steps - Search line, destination ghosts already chosen.
 * @param mistakeSquare - Square of the weak move, or null.
 * @param occupied - Squares that currently have a piece.
 */
export function coachPieceMarks(
  steps: readonly { from: string }[],
  mistakeSquare: string | null,
  occupied: ReadonlySet<string>
): { square: string; index: number }[] {
  return coachSourceMarks(steps, mistakeSquare).filter((mark) => occupied.has(mark.square));
}

/**
 * Source squares pinned when the line is drawn.
 * A square a piece only reaches later is not pinned, so the ring does not follow it.
 * @param steps - Search line for the student.
 * @param mistakeSquare - Square of the weak move, or null.
 * @param pieceAt - Piece on a square in the position the line was drawn for.
 */
export function coachPinnedSquares(
  steps: readonly CoachCutoutStep[],
  mistakeSquare: string | null,
  pieceAt: (square: string) => CoachSquarePiece | null
): string[] {
  const every = new Set(steps.map((step) => step.from));
  return coachStableMarks(steps, mistakeSquare, every, pieceAt).map((mark) => mark.square);
}

/**
 * Cutouts that still belong to the pinned squares and the same piece.
 * @param steps - Search line for the student.
 * @param mistakeSquare - Square of the weak move, or null.
 * @param pinned - Squares accepted when the line was drawn.
 * @param pieceAt - Piece on a square now.
 */
export function coachStableMarks(
  steps: readonly CoachCutoutStep[],
  mistakeSquare: string | null,
  pinned: ReadonlySet<string>,
  pieceAt: (square: string) => CoachSquarePiece | null
): { square: string; index: number }[] {
  const seen = new Set<string>();
  const marks: { square: string; index: number }[] = [];
  const limit = Math.min(5, steps.length);
  for (let index = 0; index < limit; index++) {
    const step = steps[index];
    if (!step || step.from === mistakeSquare || seen.has(step.from) || !pinned.has(step.from)) continue;
    const piece = pieceAt(step.from);
    if (!piece || piece.role !== step.role || piece.color !== step.color) continue;
    seen.add(step.from);
    marks.push({ square: step.from, index });
  }
  return marks;
}
