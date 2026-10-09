/**
 * @file reviewHud.ts
 * @project w3dts
 * @description Scene stepping, section toggles, and the review frame readout.
 */

import type { ChessGraphicsSettings } from '../graphics/chessGraphicsSettings';
import type { ChessAmbianceId } from '../host/chessAmbiance';
import { REVIEW_POST_CONTROLS } from './reviewPostControls';

const REVIEW_SCENES = ['atelier', 'salon', 'club', 'jardin', 'terrasse'] as const satisfies readonly ChessAmbianceId[];

const SECTION_FLAG = {
  HBAO: 'ambientOcclusion',
  SSR: 'reflections',
  Bloom: 'bloom',
  FXAA: 'antialiasing',
  Volume: 'volume',
  DOF: 'dof',
  Upscale: 'upscale',
} as const;

type ReviewSectionFlag = (typeof SECTION_FLAG)[keyof typeof SECTION_FLAG];

/** One traced render pass and its latest GPU sample, in milliseconds. */
export interface ReviewPassSample {
  name: string;
  ms: number;
}

/** Frames, visible triangles, and the passes the monitor traced. */
export interface ReviewFrameStats {
  fps: number;
  triangles: number;
  passes: ReviewPassSample[];
}

/** Monitor readings the review counter displays. */
export interface ReviewMonitor {
  getFPS(): number;
  getVisibleTriangles(): number;
  getPassTimeHistory(): Iterable<readonly [string, readonly { value: number }[]]>;
}

/**
 * Next or previous room. The list wraps.
 * @param current - Room on screen.
 * @param delta - `-1` for the previous room, `1` for the next.
 * @returns The room that delta lands on.
 */
export function stepReviewScene(current: ChessAmbianceId, delta: number): ChessAmbianceId {
  const index = REVIEW_SCENES.indexOf(current);
  if (index < 0 || !Number.isFinite(delta)) return current;
  const count = REVIEW_SCENES.length;
  return REVIEW_SCENES[(index + delta + count) % count];
}

/**
 * Graphics flag owned by a review section. Image has none: tone mapping stays on.
 * @param group - Section title.
 * @returns The settings field, or null when the section cannot be switched off.
 */
export function reviewSectionFlag(group: string): ReviewSectionFlag | null {
  if (!(group in SECTION_FLAG)) return null;
  return SECTION_FLAG[group as keyof typeof SECTION_FLAG];
}

/**
 * Whether that section is currently drawing.
 * @param settings - Live review profile.
 * @param group - Section title.
 * @returns False when the flag is off. A section without a flag stays on.
 */
export function reviewSectionEnabled(settings: ChessGraphicsSettings, group: string): boolean {
  const flag = reviewSectionFlag(group);
  if (flag === null) return true;
  if (flag === 'upscale') return settings.upscale !== 'off';
  return settings[flag];
}

/**
 * Flips one section. Upscale returns to quality when it was off.
 * @param settings - Live review profile.
 * @param group - Section title. Image is left unchanged.
 * @returns The next profile. The same object when the section has no flag.
 */
export function toggleReviewSection(settings: ChessGraphicsSettings, group: string): ChessGraphicsSettings {
  const flag = reviewSectionFlag(group);
  if (flag === null) return settings;
  if (flag === 'upscale') return { ...settings, upscale: settings.upscale === 'off' ? 'quality' : 'off' };
  return { ...settings, [flag]: !settings[flag] };
}

/**
 * Latest sample of each traced pass, slowest first. An empty history is skipped.
 * @param history - Pass name to its samples.
 * @returns Rows the mini profiler can list.
 */
export function reviewPassCosts(
  history: Iterable<readonly [string, readonly { value: number }[]]>
): ReviewPassSample[] {
  const rows: ReviewPassSample[] = [];
  for (const [name, points] of history) {
    const last = points[points.length - 1];
    if (!last || !Number.isFinite(last.value)) continue;
    rows.push({ name, ms: last.value });
  }
  rows.sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name));
  return rows;
}

/**
 * Frames, triangles, and pass costs from the engine monitor.
 * @param monitor - Live monitor, or null before the host boots.
 * @returns Zeroes when the monitor is absent.
 */
function roundPost(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0;
  if (step >= 1) return Math.round(value);
  if (step >= 0.05) return Number(value.toFixed(2));
  return Number(value.toFixed(3));
}

/**
 * Serializes the review post stack: which sections are on, and each slider.
 * @param settings - Live review profile. Supplies the On/Off flags and the upscale mode.
 * @param values - Slider values by control id. A missing id uses the control default.
 * @returns Pretty JSON, one section per key.
 */
export function reviewPostConfigJson(
  settings: ChessGraphicsSettings,
  values: Readonly<Record<string, number>>
): string {
  const groups = [...new Set(REVIEW_POST_CONTROLS.map((control) => control.group)), 'FXAA'];
  const config: Record<string, Record<string, number | boolean | string>> = {};
  for (const group of groups) {
    const section: Record<string, number | boolean | string> = {};
    if (reviewSectionFlag(group)) section.enabled = reviewSectionEnabled(settings, group);
    if (group === 'Upscale') section.mode = settings.upscale;
    for (const control of REVIEW_POST_CONTROLS) {
      if (control.group !== group) continue;
      section[control.id] = roundPost(values[control.id] ?? control.initial, control.step);
    }
    config[group] = section;
  }
  return JSON.stringify(config, null, 2);
}

export function readReviewFrameStats(monitor: ReviewMonitor | null): ReviewFrameStats {
  if (!monitor) return { fps: 0, triangles: 0, passes: [] };
  return {
    fps: Math.round(monitor.getFPS()),
    triangles: Math.round(monitor.getVisibleTriangles()),
    passes: reviewPassCosts(monitor.getPassTimeHistory()),
  };
}
