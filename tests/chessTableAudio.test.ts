/**
 * @file chessTableAudio.test.ts
 * @description Tabletop SFX gains stay soft under default shell sliders (CHESS-B28c).
 */

import { describe, expect, it } from 'vitest';
import {
  CHESS_SFX_VOLUME,
  chessMixVolume,
  chessSfxGain,
  setChessAudioLevels,
} from '../src/renderer/host/chessTableAudio';

describe('chess table SFX gains', () => {
  it('keeps drop and capture under 0.3 at the default shell sliders', () => {
    setChessAudioLevels(80, 40);
    expect(chessSfxGain('drop')).toBeLessThan(0.3);
    expect(chessSfxGain('capture')).toBeLessThan(0.3);
    expect(CHESS_SFX_VOLUME.drop).toBeLessThanOrEqual(0.3);
    expect(CHESS_SFX_VOLUME.capture).toBeLessThanOrEqual(0.36);
    expect(chessMixVolume(CHESS_SFX_VOLUME.drop, 80)).toBeCloseTo(chessSfxGain('drop'));
  });
});
