/**
 * @file chessSetCove.test.ts
 * @description Atelier cove faces both game cameras after the black-side mirror.
 */

import { describe, expect, it } from 'vitest';
import { chessSetCovePoses, chessSetShell } from '../src/renderer/host/chessAmbiance';

describe('chessSetCovePoses', () => {
  it('places a cove on +Z and a mirrored cove on −Z for the atelier', () => {
    const cove = chessSetShell('atelier').cove;
    expect(cove).not.toBeNull();
    const poses = chessSetCovePoses(cove!);
    expect(poses).toEqual([
      { z: cove!.zFront, yaw: 0 },
      { z: -cove!.zFront, yaw: Math.PI },
    ]);
  });

  it('returns nothing when the room has no cove', () => {
    expect(chessSetCovePoses(chessSetShell('salon').cove)).toEqual([]);
  });
});
