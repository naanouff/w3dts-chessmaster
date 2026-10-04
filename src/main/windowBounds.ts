/**
 * @file windowBounds.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Restore the game window onto the visible desktop.
 */

import { readFileSync, writeFileSync } from 'node:fs';

export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

export interface DesktopRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowBounds extends DesktopRect {
  maximized: boolean;
}

/**
 * Keeps a fully visible window. An off-screen or tiny one becomes 1280×800, centered.
 * @param saved - Bounds read from disk, if any.
 * @param workArea - Visible desktop, in screen pixels.
 * @returns Bounds safe to open.
 */
export function clampWindowBounds(
  saved: Partial<WindowBounds> | null | undefined,
  workArea: DesktopRect
): WindowBounds {
  const fallback = centeredDefault(workArea);
  const width = saved?.width;
  const height = saved?.height;
  const x = saved?.x;
  const y = saved?.y;
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || !isFiniteNumber(x) || !isFiniteNumber(y)) {
    return fallback;
  }
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return fallback;
  const fullyInside =
    x >= workArea.x &&
    y >= workArea.y &&
    x + width <= workArea.x + workArea.width &&
    y + height <= workArea.y + workArea.height;
  if (!fullyInside) return fallback;
  return { x, y, width, height, maximized: saved?.maximized === true };
}

/**
 * Reads `window-bounds.json`. A missing or broken file uses the centered default.
 * @param filePath - Absolute path in userData.
 * @param workArea - Visible desktop.
 */
export function loadWindowBounds(filePath: string, workArea: DesktopRect): WindowBounds {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<WindowBounds>;
    return clampWindowBounds(parsed, workArea);
  } catch {
    return clampWindowBounds(null, workArea);
  }
}

/**
 * Writes the bounds the next launch should open.
 * @param filePath - Absolute path in userData.
 * @param bounds - Window rectangle and maximized flag.
 */
export function saveWindowBounds(filePath: string, bounds: WindowBounds): void {
  writeFileSync(filePath, JSON.stringify(bounds));
}

function centeredDefault(workArea: DesktopRect): WindowBounds {
  const width = Math.min(DEFAULT_WINDOW_WIDTH, workArea.width);
  const height = Math.min(DEFAULT_WINDOW_HEIGHT, workArea.height);
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
    maximized: false,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
