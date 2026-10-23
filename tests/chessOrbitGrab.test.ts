/**
 * @file chessOrbitGrab.test.ts
 * @description Orbit yields while a piece is held (touch and mouse).
 */

import { describe, expect, it } from 'vitest';
import { chessOrbitInputActive } from '../src/chess/index';

describe('chess orbit while grabbing', () => {
  it('freezes orbit input for the duration of a grab', () => {
    expect(chessOrbitInputActive(false)).toBe(true);
    expect(chessOrbitInputActive(true)).toBe(false);
  });
});
