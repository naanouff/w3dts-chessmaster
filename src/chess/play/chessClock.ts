/**
 * @file chessClock.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Chess clocks: when they run, and how a wire message sets them.
 */

import type { ChessColor } from '../rules/chessTypes';

/** Both sides start with ten minutes. */
export const CHESS_CLOCK_START_S = 600;

export interface ChessClocks {
  whiteSeconds: number;
  blackSeconds: number;
  flag: ChessColor | null;
}

export interface ClockGate {
  /** A full screen, the pause, or a lesson covers the table. */
  covered: boolean;
  /** A peer game has not connected yet. */
  awaitingPeer: boolean;
  /** Training study leaves the ten minutes alone. */
  clockOff?: boolean;
}

/**
 * Advances the side to move. A covered table or a peer still expected leaves the clocks alone.
 * @param clocks - Times before this step.
 * @param sideToMove - Side whose clock runs.
 * @param dt - Elapsed seconds.
 * @param gate - Reasons the clock must stay still.
 * @returns The clocks after the step.
 */
export function stepChessClock(
  clocks: ChessClocks,
  sideToMove: ChessColor,
  dt: number,
  gate: ClockGate
): ChessClocks {
  if (gate.covered || gate.awaitingPeer || gate.clockOff || clocks.flag !== null || !(dt > 0)) return clocks;
  const whiteSeconds = sideToMove === 'white' ? Math.max(0, clocks.whiteSeconds - dt) : clocks.whiteSeconds;
  const blackSeconds = sideToMove === 'black' ? Math.max(0, clocks.blackSeconds - dt) : clocks.blackSeconds;
  const flagged = sideToMove === 'white' ? whiteSeconds <= 0 : blackSeconds <= 0;
  return {
    whiteSeconds,
    blackSeconds,
    flag: flagged ? sideToMove : null,
  };
}

/**
 * Times applied when a wire message arrives.
 * A reset always returns to ten minutes. A restore uses the two received times.
 * @param kind - `reset` or `restore`.
 * @param received - Times carried by a restore message.
 * @returns Clocks to store on the table.
 */
export function clocksFromWire(
  kind: 'reset' | 'restore',
  received?: { whiteSeconds: number; blackSeconds: number }
): ChessClocks {
  if (kind === 'reset') {
    return { whiteSeconds: CHESS_CLOCK_START_S, blackSeconds: CHESS_CLOCK_START_S, flag: null };
  }
  return {
    whiteSeconds: clampSeconds(received?.whiteSeconds),
    blackSeconds: clampSeconds(received?.blackSeconds),
    flag: null,
  };
}

function clampSeconds(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}
