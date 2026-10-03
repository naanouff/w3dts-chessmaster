/**
 * @file chessTableSfx.test.ts
 * @description CHESS-B6e: ply → clip ids.
 */

import { describe, expect, it } from 'vitest';
import { chessTableSfxForPly } from '../src/chess/index';

describe('chessTableSfxForPly', () => {
  it('plays drop on a quiet move', () => {
    expect(chessTableSfxForPly({ captured: false, check: false, mate: false, localWon: false })).toEqual([
      'drop',
    ]);
  });

  it('plays capture instead of drop, then check', () => {
    expect(chessTableSfxForPly({ captured: true, check: true, mate: false, localWon: false })).toEqual([
      'capture',
      'check',
    ]);
  });

  it('plays win or lose after mate, not check', () => {
    expect(chessTableSfxForPly({ captured: false, check: true, mate: true, localWon: true })).toEqual([
      'drop',
      'win',
    ]);
    expect(chessTableSfxForPly({ captured: true, check: true, mate: true, localWon: false })).toEqual([
      'capture',
      'lose',
    ]);
  });
});
