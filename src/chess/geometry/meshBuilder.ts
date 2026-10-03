/**
 * @file meshBuilder.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Accumulates interleaved stride-20 meshes (boxes, lathe, extrusion).
 */

import { vec3 } from 'gl-matrix';
import { Mesh, STANDARD_MESH_VERTEX_FLOATS } from '@naanouff/w3dts-core';

const STRIDE = STANDARD_MESH_VERTEX_FLOATS;
const UP = vec3.fromValues(0, 1, 0);
const RIGHT = vec3.fromValues(1, 0, 0);

function signedAreaYz(profile: ReadonlyArray<readonly [number, number]>): number {
  let area = 0;
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    area += profile[i]![0]! * profile[j]![1]! - profile[j]![0]! * profile[i]![1]!;
  }
  return area * 0.5;
}

function crossYz(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function pointInTriangleYz(
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number]
): boolean {
  const c0 = crossYz(a[0]!, a[1]!, b[0]!, b[1]!, p[0]!, p[1]!);
  const c1 = crossYz(b[0]!, b[1]!, c[0]!, c[1]!, p[0]!, p[1]!);
  const c2 = crossYz(c[0]!, c[1]!, a[0]!, a[1]!, p[0]!, p[1]!);
  const hasNeg = c0 < 0 || c1 < 0 || c2 < 0;
  const hasPos = c0 > 0 || c1 > 0 || c2 > 0;
  return !(hasNeg && hasPos);
}

/** Ear-clip a closed YZ polygon. Each triple is CCW in (y, z) when the polygon area is positive. */
function earClipYz(
  profile: ReadonlyArray<readonly [number, number]>
): Array<[number, number, number]> {
  const n = profile.length;
  if (n < 3) return [];
  const verts = Array.from({ length: n }, (_, i) => i);
  const ccw = signedAreaYz(profile) >= 0;
  const ears: Array<[number, number, number]> = [];
  let guard = 0;
  while (verts.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < verts.length; i++) {
      const i0 = verts[(i + verts.length - 1) % verts.length]!;
      const i1 = verts[i]!;
      const i2 = verts[(i + 1) % verts.length]!;
      const a = profile[i0]!;
      const b = profile[i1]!;
      const c = profile[i2]!;
      const orient = crossYz(a[0]!, a[1]!, b[0]!, b[1]!, c[0]!, c[1]!);
      if (ccw ? orient <= 0 : orient >= 0) continue;
      let inside = false;
      for (const idx of verts) {
        if (idx === i0 || idx === i1 || idx === i2) continue;
        if (pointInTriangleYz(profile[idx]!, a, b, c)) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      ears.push(ccw ? [i0, i1, i2] : [i0, i2, i1]);
      verts.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (verts.length === 3) {
    const [i0, i1, i2] = verts;
    if (i0 !== undefined && i1 !== undefined && i2 !== undefined) {
      const a = profile[i0]!;
      const b = profile[i1]!;
      const c = profile[i2]!;
      const orient = crossYz(a[0]!, a[1]!, b[0]!, b[1]!, c[0]!, c[1]!);
      ears.push(orient >= 0 ? [i0, i1, i2] : [i0, i2, i1]);
    }
  }
  return ears;
}

export class MeshBuilder {
  private readonly verts: number[] = [];
  private readonly indices: number[] = [];

  public get vertexCount(): number {
    return this.verts.length / STRIDE;
  }

  public addVertex(
    x: number,
    y: number,
    z: number,
    u: number,
    v: number,
    nx: number,
    ny: number,
    nz: number,
    tangent?: readonly [number, number, number]
  ): number {
    const n = vec3.fromValues(nx, ny, nz);
    const nLen = vec3.length(n) || 1;
    vec3.scale(n, n, 1 / nLen);
    const tan = vec3.create();
    if (tangent) {
      vec3.set(tan, tangent[0], tangent[1], tangent[2]);
    } else {
      vec3.cross(tan, Math.abs(n[1]!) > 0.95 ? RIGHT : UP, n);
    }
    vec3.normalize(tan, tan);
    const bit = vec3.create();
    vec3.cross(bit, n, tan);
    const i = this.vertexCount;
    this.verts.push(
      x,
      y,
      z,
      u,
      v,
      u,
      v,
      n[0]!,
      n[1]!,
      n[2]!,
      tan[0]!,
      tan[1]!,
      tan[2]!,
      bit[0]!,
      bit[1]!,
      bit[2]!,
      1,
      1,
      1,
      1
    );
    return i;
  }

  public addTri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  /**
   * Fan from `pts[0]`. Winding is flipped when the first triangle's normal
   * points against `outward` so callers can list vertices in either order.
   */
  public addConvexPolygon(
    pts: ReadonlyArray<readonly [number, number, number]>,
    outward: readonly [number, number, number]
  ): void {
    if (pts.length < 3) return;
    const p0 = pts[0]!;
    const p1 = pts[1]!;
    const p2 = pts[2]!;
    const e1x = p1[0]! - p0[0]!;
    const e1y = p1[1]! - p0[1]!;
    const e1z = p1[2]! - p0[2]!;
    const e2x = p2[0]! - p0[0]!;
    const e2y = p2[1]! - p0[1]!;
    const e2z = p2[2]! - p0[2]!;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const flip = nx * outward[0]! + ny * outward[1]! + nz * outward[2]! < 0;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    const nn: [number, number, number] = flip
      ? [-nx / nLen, -ny / nLen, -nz / nLen]
      : [nx / nLen, ny / nLen, nz / nLen];
    const ids = pts.map((p, i) => {
      const u = pts.length === 4 ? (i === 1 || i === 2 ? 1 : 0) : i / pts.length;
      const v = pts.length === 4 ? (i >= 2 ? 1 : 0) : 0;
      return this.addVertex(p[0]!, p[1]!, p[2]!, u, v, nn[0], nn[1], nn[2]);
    });
    for (let i = 1; i < ids.length - 1; i++) {
      if (flip) this.addTri(ids[0]!, ids[i + 1]!, ids[i]!);
      else this.addTri(ids[0]!, ids[i]!, ids[i + 1]!);
    }
  }

  /**
   * AABB with a uniform edge chamfer. Original faces stay on the AABB planes
   * and shrink by `bevel`; 12 edge quads + 8 corner triangles fill the cuts.
   */
  public addChamferedBox(
    cx: number,
    cy: number,
    cz: number,
    hx: number,
    hy: number,
    hz: number,
    bevel: number
  ): void {
    const b = Math.min(bevel, hx * 0.45, hy * 0.45, hz * 0.45);
    const ix = hx - b;
    const iy = hy - b;
    const iz = hz - b;
    const p = (x: number, y: number, z: number): [number, number, number] => [
      cx + x,
      cy + y,
      cz + z,
    ];

    this.addConvexPolygon(
      [p(-ix, hy, iz), p(ix, hy, iz), p(ix, hy, -iz), p(-ix, hy, -iz)],
      [0, 1, 0]
    );
    this.addConvexPolygon(
      [p(-ix, -hy, -iz), p(ix, -hy, -iz), p(ix, -hy, iz), p(-ix, -hy, iz)],
      [0, -1, 0]
    );
    this.addConvexPolygon(
      [p(hx, -iy, iz), p(hx, -iy, -iz), p(hx, iy, -iz), p(hx, iy, iz)],
      [1, 0, 0]
    );
    this.addConvexPolygon(
      [p(-hx, -iy, -iz), p(-hx, -iy, iz), p(-hx, iy, iz), p(-hx, iy, -iz)],
      [-1, 0, 0]
    );
    this.addConvexPolygon(
      [p(-ix, -iy, hz), p(ix, -iy, hz), p(ix, iy, hz), p(-ix, iy, hz)],
      [0, 0, 1]
    );
    this.addConvexPolygon(
      [p(ix, -iy, -hz), p(-ix, -iy, -hz), p(-ix, iy, -hz), p(ix, iy, -hz)],
      [0, 0, -1]
    );

    this.addConvexPolygon(
      [p(-ix, hy, iz), p(ix, hy, iz), p(ix, iy, hz), p(-ix, iy, hz)],
      [0, 1, 1]
    );
    this.addConvexPolygon(
      [p(ix, hy, -iz), p(-ix, hy, -iz), p(-ix, iy, -hz), p(ix, iy, -hz)],
      [0, 1, -1]
    );
    this.addConvexPolygon(
      [p(-ix, -iy, hz), p(ix, -iy, hz), p(ix, -hy, iz), p(-ix, -hy, iz)],
      [0, -1, 1]
    );
    this.addConvexPolygon(
      [p(ix, -iy, -hz), p(-ix, -iy, -hz), p(-ix, -hy, -iz), p(ix, -hy, -iz)],
      [0, -1, -1]
    );
    this.addConvexPolygon(
      [p(ix, hy, iz), p(ix, hy, -iz), p(hx, iy, -iz), p(hx, iy, iz)],
      [1, 1, 0]
    );
    this.addConvexPolygon(
      [p(-ix, hy, -iz), p(-ix, hy, iz), p(-hx, iy, iz), p(-hx, iy, -iz)],
      [-1, 1, 0]
    );
    this.addConvexPolygon(
      [p(ix, -hy, -iz), p(ix, -hy, iz), p(hx, -iy, iz), p(hx, -iy, -iz)],
      [1, -1, 0]
    );
    this.addConvexPolygon(
      [p(-ix, -hy, iz), p(-ix, -hy, -iz), p(-hx, -iy, -iz), p(-hx, -iy, iz)],
      [-1, -1, 0]
    );
    this.addConvexPolygon(
      [p(hx, iy, iz), p(hx, -iy, iz), p(ix, -iy, hz), p(ix, iy, hz)],
      [1, 0, 1]
    );
    this.addConvexPolygon(
      [p(hx, -iy, -iz), p(hx, iy, -iz), p(ix, iy, -hz), p(ix, -iy, -hz)],
      [1, 0, -1]
    );
    this.addConvexPolygon(
      [p(-hx, -iy, iz), p(-hx, iy, iz), p(-ix, iy, hz), p(-ix, -iy, hz)],
      [-1, 0, 1]
    );
    this.addConvexPolygon(
      [p(-hx, iy, -iz), p(-hx, -iy, -iz), p(-ix, -iy, -hz), p(-ix, iy, -hz)],
      [-1, 0, -1]
    );

    this.addConvexPolygon([p(ix, hy, iz), p(hx, iy, iz), p(ix, iy, hz)], [1, 1, 1]);
    this.addConvexPolygon([p(ix, hy, -iz), p(ix, iy, -hz), p(hx, iy, -iz)], [1, 1, -1]);
    this.addConvexPolygon([p(-ix, hy, iz), p(-ix, iy, hz), p(-hx, iy, iz)], [-1, 1, 1]);
    this.addConvexPolygon([p(-ix, hy, -iz), p(-hx, iy, -iz), p(-ix, iy, -hz)], [-1, 1, -1]);
    this.addConvexPolygon([p(ix, -hy, iz), p(ix, -iy, hz), p(hx, -iy, iz)], [1, -1, 1]);
    this.addConvexPolygon([p(ix, -hy, -iz), p(hx, -iy, -iz), p(ix, -iy, -hz)], [1, -1, -1]);
    this.addConvexPolygon([p(-ix, -hy, iz), p(-hx, -iy, iz), p(-ix, -iy, hz)], [-1, -1, 1]);
    this.addConvexPolygon([p(-ix, -hy, -iz), p(-ix, -iy, -hz), p(-hx, -iy, -iz)], [-1, -1, -1]);
  }

  /** Axis-aligned box. Half-extents hx,hy,hz. Origin at centre. */
  public addBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): void {
    const faces: Array<{
      n: [number, number, number];
      corners: Array<[number, number, number]>;
    }> = [
      {
        n: [0, 0, 1],
        corners: [
          [cx - hx, cy - hy, cz + hz],
          [cx + hx, cy - hy, cz + hz],
          [cx + hx, cy + hy, cz + hz],
          [cx - hx, cy + hy, cz + hz],
        ],
      },
      {
        n: [0, 0, -1],
        corners: [
          [cx + hx, cy - hy, cz - hz],
          [cx - hx, cy - hy, cz - hz],
          [cx - hx, cy + hy, cz - hz],
          [cx + hx, cy + hy, cz - hz],
        ],
      },
      {
        n: [1, 0, 0],
        corners: [
          [cx + hx, cy - hy, cz + hz],
          [cx + hx, cy - hy, cz - hz],
          [cx + hx, cy + hy, cz - hz],
          [cx + hx, cy + hy, cz + hz],
        ],
      },
      {
        n: [-1, 0, 0],
        corners: [
          [cx - hx, cy - hy, cz - hz],
          [cx - hx, cy - hy, cz + hz],
          [cx - hx, cy + hy, cz + hz],
          [cx - hx, cy + hy, cz - hz],
        ],
      },
      {
        n: [0, 1, 0],
        corners: [
          [cx - hx, cy + hy, cz + hz],
          [cx + hx, cy + hy, cz + hz],
          [cx + hx, cy + hy, cz - hz],
          [cx - hx, cy + hy, cz - hz],
        ],
      },
      {
        n: [0, -1, 0],
        corners: [
          [cx - hx, cy - hy, cz - hz],
          [cx + hx, cy - hy, cz - hz],
          [cx + hx, cy - hy, cz + hz],
          [cx - hx, cy - hy, cz + hz],
        ],
      },
    ];
    for (const face of faces) {
      const uv = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as const;
      const ids = face.corners.map((c, i) =>
        this.addVertex(c[0], c[1], c[2], uv[i]![0], uv[i]![1], face.n[0], face.n[1], face.n[2])
      );
      this.addTri(ids[0]!, ids[1]!, ids[2]!);
      this.addTri(ids[0]!, ids[2]!, ids[3]!);
    }
  }

  /**
   * Revolution of a (y, radius) profile around Y. First ring at profile[0].y.
   * Winding is CCW from outside (WebGPU back-face cull, same convention as engine cylinders).
   */
  public addLathe(profile: ReadonlyArray<readonly [number, number]>, segments = 20): void {
    if (profile.length < 2) return;
    const rings: number[][] = [];
    for (let p = 0; p < profile.length; p++) {
      const y = profile[p]![0];
      const r = profile[p]![1];
      const prev = profile[Math.max(0, p - 1)]!;
      const next = profile[Math.min(profile.length - 1, p + 1)]!;
      const dy = next[0]! - prev[0]!;
      const dr = next[1]! - prev[1]!;
      let ny = -dr;
      let nr = dy;
      const nLen = Math.hypot(ny, nr) || 1;
      ny /= nLen;
      nr /= nLen;
      const ring: number[] = [];
      const v = p / (profile.length - 1);
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const a = t * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const nx = r > 1e-6 ? Math.cos(a) * nr : 0;
        const nz = r > 1e-6 ? Math.sin(a) * nr : 0;
        // +U (increasing angle): dP/dθ = (-z, 0, x). Must match UV or the normal map pinches.
        const tLen = Math.hypot(-z, x) || 1;
        ring.push(this.addVertex(x, y, z, t, v, nx, ny, nz, [-z / tLen, 0, x / tLen]));
      }
      rings.push(ring);
    }
    for (let p = 0; p < rings.length - 1; p++) {
      const a = rings[p]!;
      const b = rings[p + 1]!;
      for (let s = 0; s < segments; s++) {
        this.addTri(a[s]!, b[s]!, b[s + 1]!);
        this.addTri(a[s]!, b[s + 1]!, a[s + 1]!);
      }
    }
    const cap = (ring: number[], y: number, r: number, up: boolean) => {
      if (r < 1e-5) return;
      const c = this.addVertex(0, y, 0, 0.5, 0.5, 0, up ? 1 : -1, 0);
      for (let s = 0; s < segments; s++) {
        if (up) this.addTri(c, ring[s + 1]!, ring[s]!);
        else this.addTri(c, ring[s]!, ring[s + 1]!);
      }
    };
    cap(rings[0]!, profile[0]![0], profile[0]![1], false);
    cap(
      rings[rings.length - 1]!,
      profile[profile.length - 1]![0],
      profile[profile.length - 1]![1],
      true
    );
  }

  /**
   * Extrudes a YZ polyline (y, z) along ±X by halfThickness.
   * Belt vertices use silhouette normals; cap vertices use ±X so the flat sides light correctly.
   */
  public addExtrudedYz(
    profile: ReadonlyArray<readonly [number, number]>,
    halfThickness: number
  ): void {
    if (profile.length < 3) return;
    const loop = signedAreaYz(profile) >= 0 ? [...profile] : [...profile].reverse();
    const n = loop.length;
    const leftBelt: number[] = [];
    const rightBelt: number[] = [];
    const leftCap: number[] = [];
    const rightCap: number[] = [];
    for (let i = 0; i < n; i++) {
      const y = loop[i]![0]!;
      const z = loop[i]![1]!;
      const prev = loop[(i + n - 1) % n]!;
      const next = loop[(i + 1) % n]!;
      const dy = next[0]! - prev[0]!;
      const dz = next[1]! - prev[1]!;
      const ny = dz;
      const nz = -dy;
      const v = i / n;
      leftBelt.push(this.addVertex(-halfThickness, y, z, 0, v, 0, ny, nz));
      rightBelt.push(this.addVertex(halfThickness, y, z, 1, v, 0, ny, nz));
      leftCap.push(this.addVertex(-halfThickness, y, z, 0.25, v, -1, 0, 0));
      rightCap.push(this.addVertex(halfThickness, y, z, 0.75, v, 1, 0, 0));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.addTri(leftBelt[i]!, leftBelt[j]!, rightBelt[j]!);
      this.addTri(leftBelt[i]!, rightBelt[j]!, rightBelt[i]!);
    }
    const ears = earClipYz(loop);
    for (const [a, b, c] of ears) {
      this.addTri(rightCap[a]!, rightCap[b]!, rightCap[c]!);
      this.addTri(leftCap[a]!, leftCap[c]!, leftCap[b]!);
    }
  }

  public toMesh(name: string): Mesh {
    const vertices = new Float32Array(this.verts);
    const indices =
      this.indices.length > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices);
    return new Mesh(vertices, indices, name);
  }
}
