/**
 * @file chessOrbitLimits.test.ts
 * @description Player orbit stays within yaw/pitch and zoom bounds, without pan.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHESS_ORBIT_ANGLE_LIMIT,
  CHESS_ORBIT_MAX_M,
  CHESS_ORBIT_MIN_M,
  clampChessOrbitAngle,
  chessOrbitLimitsActive,
  chessOrbitRestFromEyeLook,
} from '../src/renderer/host/chessOrbitLimits';

describe('chess orbit limits', () => {
  it('keeps zoom between 30 cm and 1 m from the board focus', () => {
    expect(CHESS_ORBIT_MIN_M).toBe(0.3);
    expect(CHESS_ORBIT_MAX_M).toBe(1);
    expect(CHESS_ORBIT_MIN_M).toBeLessThan(CHESS_ORBIT_MAX_M);
  });

  it('limits yaw and pitch to 30 degrees around the rest pose', () => {
    expect(CHESS_ORBIT_ANGLE_LIMIT).toBeCloseTo(Math.PI / 6);
    expect(clampChessOrbitAngle(1.6, 1, CHESS_ORBIT_ANGLE_LIMIT)).toBeCloseTo(1 + Math.PI / 6);
    expect(clampChessOrbitAngle(0.4, 1, CHESS_ORBIT_ANGLE_LIMIT)).toBeCloseTo(1 - Math.PI / 6);
    expect(clampChessOrbitAngle(1.05, 1, CHESS_ORBIT_ANGLE_LIMIT)).toBeCloseTo(1.05);
  });

  it('wraps yaw around the white-side rest at pi so a small nudge does not snap lateral', () => {
    const rest = Math.PI;
    // atan2 often returns −π for the same forward; that must stay near rest, not jump through 0.
    expect(clampChessOrbitAngle(-Math.PI + 0.05, rest, CHESS_ORBIT_ANGLE_LIMIT)).toBeCloseTo(rest + 0.05);
    expect(clampChessOrbitAngle(Math.PI - 0.6, rest, CHESS_ORBIT_ANGLE_LIMIT)).toBeCloseTo(
      rest - CHESS_ORBIT_ANGLE_LIMIT
    );
    const fromEye = chessOrbitRestFromEyeLook([0, 0.55, -0.72], [0, 0.02, 0]);
    expect(Math.abs(fromEye.azimuth)).toBeCloseTo(Math.PI);
    expect(fromEye.polar).toBeGreaterThan(0.5);
    expect(fromEye.polar).toBeLessThan(1.5);
  });

  it('applies only to the game framing, not wide review or piece close-ups', () => {
    expect(chessOrbitLimitsActive({ arriving: false, piece: null, frame: 'game' })).toBe(true);
    expect(chessOrbitLimitsActive({ arriving: true, piece: null, frame: 'game' })).toBe(false);
    expect(chessOrbitLimitsActive({ arriving: false, piece: 'king', frame: 'game' })).toBe(false);
    expect(chessOrbitLimitsActive({ arriving: false, piece: null, frame: 'wide' })).toBe(false);
  });

  it('wires the orbit limits into the chess host after framing', () => {
    const host = readFileSync(new URL('../src/renderer/host/ChessDemoProject.ts', import.meta.url), 'utf8');
    expect(host).toContain('enforceChessOrbitLimits');
    expect(host).toContain('configureChessOrbitDistances');
    expect(host).toContain('chessOrbitLimitsActive');
  });
});
