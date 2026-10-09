/**
 * @file cpuDrawOffer.test.ts
 * @description CHESS-B24e: heuristic CPU accepts or refuses a draw offer.
 */

import { describe, expect, it } from 'vitest';
import { cpuAcceptsDrawOffer } from '../src/chess/rules/cpuDrawOffer';

describe('cpuAcceptsDrawOffer', () => {
  it('accepts a quiet equal opening position', () => {
    expect(
      cpuAcceptsDrawOffer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 2)
    ).toBe(true);
  });

  it('refuses when a side is a queen up', () => {
    expect(cpuAcceptsDrawOffer('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 2)).toBe(false);
  });

  it('refuses when the side to move is in check', () => {
    expect(cpuAcceptsDrawOffer('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1', 2)).toBe(false);
  });

  it('refuses when mate in one is available', () => {
    expect(cpuAcceptsDrawOffer('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', 2)).toBe(false);
  });
});
