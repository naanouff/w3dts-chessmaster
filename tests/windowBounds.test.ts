/**
 * @file windowBounds.test.ts
 * @description A restored window stays on the visible desktop.
 */

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clampWindowBounds, loadWindowBounds, saveWindowBounds } from '../src/main/windowBounds';

const desk = { x: 0, y: 0, width: 1920, height: 1080 };

describe('window bounds', () => {
  it('replaces an off-screen or tiny window with 1280×800 on the desktop', () => {
    expect(clampWindowBounds({ x: -4000, y: 10, width: 1280, height: 800 }, desk)).toEqual({
      x: 320,
      y: 140,
      width: 1280,
      height: 800,
      maximized: false,
    });
    expect(clampWindowBounds({ x: 10, y: 10, width: 200, height: 100 }, desk)).toMatchObject({
      width: 1280,
      height: 800,
      maximized: false,
    });
  });

  it('keeps a window that is fully visible and large enough, including when maximized', () => {
    const visible = { x: 40, y: 30, width: 1400, height: 900, maximized: true };
    expect(clampWindowBounds(visible, desk)).toEqual(visible);
  });

  it('reads and writes the bounds file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'chess-window-'));
    const file = path.join(dir, 'window-bounds.json');
    const bounds = { x: 40, y: 30, width: 1400, height: 900, maximized: false };
    saveWindowBounds(file, bounds);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(bounds);
    expect(loadWindowBounds(file, desk)).toEqual(bounds);
    expect(loadWindowBounds(path.join(dir, 'missing.json'), desk)).toMatchObject({
      width: 1280,
      height: 800,
    });
  });
});
