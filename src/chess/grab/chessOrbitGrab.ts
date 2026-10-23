/**
 * @file chessOrbitGrab.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Whether the orbital camera may read input while a piece is held.
 */

/**
 * Orbit must not steal a one-finger grab (or the mouse select drag).
 * @param grabbing - True while {@link MouseGrabController} holds a piece.
 * @returns True when the orbital controller may stay enabled.
 */
export function chessOrbitInputActive(grabbing: boolean): boolean {
  return !grabbing;
}
