/**
 * @file reviewArgv.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Launch the client on the room review.
 */

/**
 * Query string for the game window when the process was started as a review.
 * @param argv - `process.argv`, including the electron binary.
 * @returns `review=1`, or an empty string for a normal match.
 */
export function reviewSearchFromArgv(argv: readonly string[]): string {
  const asked = argv.some((arg) => arg === '--review' || arg === '--review=1' || arg === 'review=1');
  return asked ? 'review=1' : '';
}
