/**
 * @file chessClock.test.ts
 * @description Clock steps stay still off the table, and a restore keeps the saved times.
 */

import { describe, expect, it } from 'vitest';
import { clocksFromWire, stepChessClock } from '../src/chess/index';

const running = { whiteSeconds: 100, blackSeconds: 90, flag: null };

describe('chess clocks', () => {
  it('does not move while the table is covered', () => {
    expect(stepChessClock(running, 'white', 3, { covered: true, awaitingPeer: false })).toEqual(running);
  });

  it('does not move while a peer game is still waiting', () => {
    expect(stepChessClock(running, 'black', 3, { covered: false, awaitingPeer: true })).toEqual(running);
  });

  it('leaves both clocks alone when training time is off', () => {
    expect(stepChessClock(running, 'white', 5, { covered: false, awaitingPeer: false, clockOff: true })).toEqual(
      running
    );
  });

  it('spends the side to move when the table is open', () => {
    expect(stepChessClock(running, 'white', 2.5, { covered: false, awaitingPeer: false })).toEqual({
      whiteSeconds: 97.5,
      blackSeconds: 90,
      flag: null,
    });
  });

  it('resets both clocks to 10:00 and applies the times received on restore', () => {
    expect(clocksFromWire('reset')).toEqual({ whiteSeconds: 600, blackSeconds: 600, flag: null });
    expect(clocksFromWire('restore', { whiteSeconds: 180, blackSeconds: 240 })).toEqual({
      whiteSeconds: 180,
      blackSeconds: 240,
      flag: null,
    });
  });
});
