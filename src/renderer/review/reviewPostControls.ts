/**
 * @file reviewPostControls.ts
 * @project w3dts
 * @description Sliders the engine review writes onto live post-process uniforms.
 */

/** One render-graph pass. Struct uniforms are arrays; a lone f32 is a number. */
export interface ReviewPostPass {
  name: string;
  uniforms?: Record<string, { value: number | number[] }>;
}

/** One slider. `index` addresses a struct slot. */
export interface ReviewPostControl {
  id: string;
  group: string;
  label: string;
  pass: string;
  uniform: string;
  index?: number;
  min: number;
  max: number;
  step: number;
  initial: number;
  /** Extra passes that must stay equal, such as the two bloom blurs. */
  copies?: readonly { pass: string; uniform: string; index?: number }[];
}

/**
 * Parameters the review can drag. FXAA has none.
 * Defaults match the live review. Tone mapping starts at the shared scene grade.
 */
export const REVIEW_POST_CONTROLS: readonly ReviewPostControl[] = [
  { id: 'grade-brightness', group: 'Image', label: 'Luminosité', pass: 'Tone Mapping & Output', uniform: 'exposure', min: 0.5, max: 2, step: 0.05, initial: 1.25 },
  { id: 'grade-contrast', group: 'Image', label: 'Contraste', pass: 'Tone Mapping & Output', uniform: 'contrast', min: 0.5, max: 2, step: 0.05, initial: 1.4 },
  { id: 'grade-saturation', group: 'Image', label: 'Saturation', pass: 'Tone Mapping & Output', uniform: 'saturation', min: 0.5, max: 2, step: 0.05, initial: 0.6 },
  { id: 'hbao-radius', group: 'HBAO', label: 'Rayon', pass: '04b_HBAO', uniform: 'hbaoParams', index: 0, min: 0.01, max: 0.4, step: 0.005, initial: 0.085 },
  { id: 'hbao-intensity', group: 'HBAO', label: 'Intensité', pass: '04b_HBAO', uniform: 'hbaoParams', index: 1, min: 0, max: 4, step: 0.05, initial: 1.7 },
  { id: 'hbao-bias', group: 'HBAO', label: 'Biais', pass: '04b_HBAO', uniform: 'hbaoParams', index: 2, min: 0, max: 0.2, step: 0.005, initial: 0.05 },
  { id: 'hbao-steps', group: 'HBAO', label: 'Pas', pass: '04b_HBAO', uniform: 'hbaoParams', index: 3, min: 1, max: 16, step: 1, initial: 4 },
  { id: 'hbao-edges', group: 'HBAO', label: 'Bords', pass: '04c_HBAO_Blur', uniform: 'blurParams', index: 0, min: 0, max: 24, step: 0.5, initial: 6 },
  { id: 'ssr-step', group: 'SSR', label: 'Pas', pass: '05_SSR_Floor', uniform: 'params', index: 0, min: 0.25, max: 4, step: 0.25, initial: 1 },
  { id: 'ssr-steps', group: 'SSR', label: 'Marche', pass: '05_SSR_Floor', uniform: 'params', index: 1, min: 16, max: 256, step: 8, initial: 16 },
  { id: 'ssr-thickness', group: 'SSR', label: 'Épaisseur', pass: '05_SSR_Floor', uniform: 'params', index: 2, min: 0.002, max: 0.08, step: 0.002, initial: 0.018 },
  { id: 'ssr-intensity', group: 'SSR', label: 'Intensité', pass: '05_SSR_Floor', uniform: 'params', index: 3, min: 0, max: 2, step: 0.05, initial: 0.72 },
  { id: 'fog-density', group: 'Volume', label: 'Densité', pass: '09_Fog', uniform: 'fogParams', index: 0, min: 0, max: 0.3, step: 0.005, initial: 0.06 },
  { id: 'fog-falloff', group: 'Volume', label: 'Chute', pass: '09_Fog', uniform: 'fogParams', index: 1, min: 0, max: 2, step: 0.05, initial: 0.45 },
  { id: 'fog-height', group: 'Volume', label: 'Hauteur', pass: '09_Fog', uniform: 'fogParams', index: 2, min: -1, max: 2, step: 0.05, initial: 0 },
  { id: 'fog-scatter', group: 'Volume', label: 'Diffusion', pass: '09_Fog', uniform: 'fogParams', index: 3, min: 0, max: 2, step: 0.05, initial: 0.6 },
  { id: 'fog-steps', group: 'Volume', label: 'Pas', pass: '09_Fog', uniform: 'fogParams', index: 4, min: 4, max: 32, step: 1, initial: 14 },
  { id: 'bloom-threshold', group: 'Bloom', label: 'Seuil', pass: '06_Bright', uniform: 'threshold', min: 0.2, max: 4, step: 0.05, initial: 1 },
  {
    id: 'bloom-radius',
    group: 'Bloom',
    label: 'Rayon',
    pass: '06b_BlurH',
    uniform: 'radius',
    min: 0.5,
    max: 12,
    step: 0.25,
    initial: 3,
    copies: [{ pass: '06c_BlurV', uniform: 'radius' }],
  },
  { id: 'bloom-intensity', group: 'Bloom', label: 'Intensité', pass: '06d_BloomAdd', uniform: 'intensity', min: 0, max: 3, step: 0.05, initial: 1 },
  { id: 'dof-range', group: 'DOF', label: 'Plage', pass: '10_DoF', uniform: 'dofParams', index: 3, min: 0.05, max: 2, step: 0.05, initial: 0.55 },
  { id: 'dof-radius', group: 'DOF', label: 'Rayon', pass: '10_DoF', uniform: 'dofParams', index: 4, min: 0, max: 32, step: 1, initial: 4 },
  { id: 'upscale-sharpness', group: 'Upscale', label: 'Affûtage', pass: '08_Upscale', uniform: 'sharpness', min: 0, max: 1, step: 0.05, initial: 0.7 },
];

function clamp(control: ReviewPostControl, value: number): number {
  if (!Number.isFinite(value)) return control.initial;
  return Math.min(control.max, Math.max(control.min, value));
}

function writeSlot(
  passes: readonly ReviewPostPass[],
  pass: string,
  uniform: string,
  index: number | undefined,
  value: number
): void {
  const slot = passes.find((entry) => entry.name === pass)?.uniforms?.[uniform];
  if (!slot) return;
  if (index === undefined) {
    slot.value = value;
    return;
  }
  if (Array.isArray(slot.value)) slot.value[index] = value;
}

/**
 * Reads one live uniform. A missing pass returns null.
 * @param passes - Render-graph passes.
 * @param control - Slider to read.
 * @returns The current value, or null when the pass is absent.
 */
export function readReviewPost(
  passes: readonly ReviewPostPass[] | undefined,
  control: ReviewPostControl
): number | null {
  const slot = passes?.find((entry) => entry.name === control.pass)?.uniforms?.[control.uniform];
  if (!slot) return null;
  const value = control.index === undefined ? slot.value : Array.isArray(slot.value) ? slot.value[control.index] : undefined;
  return typeof value === 'number' ? value : null;
}

/**
 * Writes one slider onto every matching pass. Copies stay equal.
 * @param passes - Render-graph passes. A missing pass is skipped.
 * @param control - Slider that moved.
 * @param value - Unclamped slider value.
 */
export function writeReviewPost(
  passes: readonly ReviewPostPass[] | undefined,
  control: ReviewPostControl,
  value: number
): void {
  if (!passes) return;
  const next = clamp(control, value);
  writeSlot(passes, control.pass, control.uniform, control.index, next);
  for (const copy of control.copies ?? []) {
    writeSlot(passes, copy.pass, copy.uniform, copy.index, next);
  }
}
