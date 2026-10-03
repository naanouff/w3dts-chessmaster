/**
 * @file stauntonProfiles.ts
 * @project w3dts
 * @description Shared [y, radius] lathe profiles and knight silhouette (CHESS-B4).
 */

/** Azimuthal revolution count. 32-gons read as faceted at Game camera distance. */
export const STAUNTON_LATHE_SEGMENTS = 96;

/** Pawn collar / stem / head. First component is Y, second is radius. */
export const STAUNTON_PAWN_PROFILE: Array<[number, number]> = [
  [0, 0.018],
  [0.005, 0.018],
  [0.007, 0.012],
  [0.02, 0.0075],
  [0.026, 0.01],
  [0.03, 0.008],
  [0.034, 0.012],
  [0.042, 0.014],
  [0.05, 0.01],
  [0.054, 0.002],
];

export const STAUNTON_ROOK_PROFILE: Array<[number, number]> = [
  [0, 0.019],
  [0.006, 0.019],
  [0.01, 0.014],
  [0.038, 0.013],
  [0.042, 0.017],
  [0.05, 0.017],
];

export const STAUNTON_BISHOP_PROFILE: Array<[number, number]> = [
  [0, 0.018],
  [0.005, 0.018],
  [0.008, 0.011],
  [0.028, 0.008],
  [0.036, 0.013],
  [0.05, 0.011],
  [0.058, 0.006],
  [0.062, 0.001],
];

export const STAUNTON_QUEEN_PROFILE: Array<[number, number]> = [
  [0, 0.02],
  [0.006, 0.02],
  [0.01, 0.012],
  [0.034, 0.009],
  [0.042, 0.015],
  [0.058, 0.013],
  [0.066, 0.008],
  [0.07, 0.002],
];

export const STAUNTON_KING_PROFILE: Array<[number, number]> = [
  [0, 0.021],
  [0.006, 0.021],
  [0.01, 0.013],
  [0.036, 0.01],
  [0.044, 0.016],
  [0.062, 0.014],
  [0.07, 0.01],
  [0.074, 0.004],
];

/** Closed YZ silhouette (y, z): Staunton horse on the pedestal, facing +Z. */
export const STAUNTON_KNIGHT_PROFILE: Array<[number, number]> = [
  [0.014, -0.012],
  [0.014, 0.006],
  [0.022, 0.012],
  [0.03, 0.015],
  [0.034, 0.02],
  [0.038, 0.018],
  [0.036, 0.012],
  [0.032, 0.008],
  [0.04, 0.006],
  [0.05, 0.008],
  [0.056, 0.004],
  [0.06, 0.002],
  [0.054, -0.004],
  [0.048, -0.01],
  [0.036, -0.014],
  [0.024, -0.014],
];

export const STAUNTON_KNIGHT_PEDESTAL: Array<[number, number]> = [
  [0, 0.018],
  [0.006, 0.018],
  [0.01, 0.012],
  [0.014, 0.01],
];

function mixPt(
  a: readonly [number, number],
  b: readonly [number, number],
  t: number
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function dist2(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Open Chaikin: keeps endpoints, fillets collars without overshoot. */
export function chaikinOpen(
  profile: ReadonlyArray<readonly [number, number]>,
  iterations: number
): Array<[number, number]> {
  let pts = profile.map((p) => [p[0], p[1]] as [number, number]);
  const nIter = Math.max(0, Math.floor(iterations));
  for (let k = 0; k < nIter; k++) {
    if (pts.length < 2) break;
    const next: Array<[number, number]> = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      next.push(mixPt(a, b, 0.25));
      next.push(mixPt(a, b, 0.75));
    }
    next.push(pts[pts.length - 1]!);
    pts = next;
  }
  return pts;
}

/** Centripetal Catmull-Rom through p1→p2 (`t` in [0, 1]). */
function centripetalPoint(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  t: number
): [number, number] {
  const alpha = 0.5;
  const t0 = 0;
  const t1 = t0 + Math.pow(dist2(p0, p1), alpha);
  const t2 = t1 + Math.pow(dist2(p1, p2), alpha);
  const t3 = t2 + Math.pow(dist2(p2, p3), alpha);
  const span = t2 - t1;
  if (span < 1e-12) return [p1[0], p1[1]];
  const tVal = t1 + t * span;
  const a1 = mixPt(p0, p1, (tVal - t0) / Math.max(t1 - t0, 1e-12));
  const a2 = mixPt(p1, p2, (tVal - t1) / Math.max(t2 - t1, 1e-12));
  const a3 = mixPt(p2, p3, (tVal - t2) / Math.max(t3 - t2, 1e-12));
  const b1 = mixPt(a1, a2, (tVal - t0) / Math.max(t2 - t0, 1e-12));
  const b2 = mixPt(a2, a3, (tVal - t1) / Math.max(t3 - t1, 1e-12));
  return mixPt(b1, b2, (tVal - t1) / Math.max(t2 - t1, 1e-12));
}

/** Closed silhouette resample (knight extrusion). Interpolates the control loop. */
export function resampleClosedPolyline(
  loop: ReadonlyArray<readonly [number, number]>,
  samplesPerSpan: number
): Array<[number, number]> {
  const n = loop.length;
  if (n < 3) return loop.map((p) => [p[0], p[1]]);
  const steps = Math.max(1, Math.floor(samplesPerSpan));
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const p0 = loop[(i + n - 1) % n]!;
    const p1 = loop[i]!;
    const p2 = loop[(i + 1) % n]!;
    const p3 = loop[(i + 2) % n]!;
    for (let s = 0; s < steps; s++) {
      out.push(centripetalPoint(p0, p1, p2, p3, s / steps));
    }
  }
  return out;
}

/** GPROC Lathe profile: (radius, y, 0). No r=0 poles (those degenerate the revolve). */
export function latheCurvePoints(
  profile: ReadonlyArray<readonly [number, number]>
): Array<[number, number, number]> {
  return chaikinOpen(profile, 2).map(([y, r]) => [r, y, 0]);
}

function signedAreaYz(profile: ReadonlyArray<readonly [number, number]>): number {
  let area = 0;
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    area += profile[i]![0]! * profile[j]![1]! - profile[j]![0]! * profile[i]![1]!;
  }
  return area;
}

/** Closed knight silhouette in XYZ for a filled PrimitivePolyline (YZ plane, x=0). */
export function knightSilhouettePoints(samplesPerSpan = 6): Array<[number, number, number]> {
  const raw = resampleClosedPolyline(STAUNTON_KNIGHT_PROFILE, samplesPerSpan);
  const loop = signedAreaYz(raw) >= 0 ? raw : [...raw].reverse();
  return loop.map(([y, z]) => [0, y, z]);
}
