/**
 * @file pieceHover.test.ts
 * @description Square the pointer would grab before the click.
 */

import { describe, expect, it } from 'vitest';
import { pieceHoverSquare } from '../src/chess/grab/pieceHover';

describe('pieceHoverSquare', () => {
  it('returns the square of the side-to-move piece the local player can grab', () => {
    expect(
      pieceHoverSquare({
        square: 'e2',
        pieceColor: 'white',
        sideToMove: 'white',
        localColor: 'white',
        playMode: 'cpu',
        gameOver: false,
        cpuBusy: false,
        motionBusy: false,
      })
    ).toBe('e2');
  });

  it('allows either camp in hotseat when it is their turn', () => {
    expect(
      pieceHoverSquare({
        square: 'e7',
        pieceColor: 'black',
        sideToMove: 'black',
        localColor: 'white',
        playMode: 'hotseat',
        gameOver: false,
        cpuBusy: false,
        motionBusy: false,
      })
    ).toBe('e7');
  });

  it('returns null for an empty square, an opponent piece, or a blocked grab', () => {
    const base = {
      square: 'e2' as const,
      pieceColor: 'white' as const,
      sideToMove: 'white' as const,
      localColor: 'white' as const,
      playMode: 'cpu' as const,
      gameOver: false,
      cpuBusy: false,
      motionBusy: false,
    };
    expect(pieceHoverSquare({ ...base, pieceColor: null })).toBeNull();
    expect(pieceHoverSquare({ ...base, pieceColor: 'black' })).toBeNull();
    expect(pieceHoverSquare({ ...base, localColor: 'black' })).toBeNull();
    expect(pieceHoverSquare({ ...base, gameOver: true })).toBeNull();
    expect(pieceHoverSquare({ ...base, cpuBusy: true })).toBeNull();
    expect(pieceHoverSquare({ ...base, motionBusy: true })).toBeNull();
    expect(pieceHoverSquare({ ...base, square: null })).toBeNull();
  });
});
