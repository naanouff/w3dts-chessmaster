/**
 * @file cylindricalPieceUv.ts
 * @project w3dts
 * @description Cylindrical UV unwrap for photo PBR on GPROC lathe pieces (no native UVs).
 */

import { Mesh, STANDARD_MESH_VERTEX_FLOATS } from '@naanouff/w3dts-core';

const STRIDE = STANDARD_MESH_VERTEX_FLOATS;
const N_OFF = 7;
const T_OFF = 10;
const B_OFF = 13;

/**
 * Writes cylindrical UVs (θ around Y, V along height) and matching tangents.
 * Duplicates seam-crossing corners so the 0/1 wrap does not smear the texture.
 */
export function applyCylindricalPieceUvs(mesh: Mesh): Mesh {
  const src = mesh.vertices;
  const idx = mesh.indices;
  const y0 = mesh.aabb.min[1] ?? 0;
  const y1 = mesh.aabb.max[1] ?? 1;
  const ySpan = Math.max(1e-6, y1 - y0);
  const out = new Float32Array(idx.length * STRIDE);
  const outIdx = idx.length > 65535 ? new Uint32Array(idx.length) : new Uint16Array(idx.length);

  for (let t = 0; t < idx.length; t += 3) {
    const corners = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
    const uvs: Array<[number, number]> = [];
    for (const vi of corners) {
      const o = vi * STRIDE;
      const x = src[o]!;
      const y = src[o + 1]!;
      const z = src[o + 2]!;
      let u = Math.atan2(z, x) / (Math.PI * 2);
      if (u < 0) u += 1;
      if (x * x + z * z < 1e-10) u = 0.5;
      uvs.push([u, (y - y0) / ySpan]);
    }
    const minU = Math.min(uvs[0]![0], uvs[1]![0], uvs[2]![0]);
    const maxU = Math.max(uvs[0]![0], uvs[1]![0], uvs[2]![0]);
    if (maxU - minU > 0.5) {
      for (const uv of uvs) {
        if (uv[0] < 0.5) uv[0] += 1;
      }
    }
    for (let k = 0; k < 3; k++) {
      const so = corners[k]! * STRIDE;
      const destI = t + k;
      const dest = destI * STRIDE;
      out.set(src.subarray(so, so + STRIDE), dest);
      const u = uvs[k]![0];
      const v = uvs[k]![1];
      out[dest + 3] = u;
      out[dest + 4] = v;
      out[dest + 5] = u;
      out[dest + 6] = v;
      const x = src[so]!;
      const z = src[so + 2]!;
      const tLen = Math.hypot(-z, x);
      if (tLen > 1e-6) {
        const tx = -z / tLen;
        const tz = x / tLen;
        out[dest + T_OFF] = tx;
        out[dest + T_OFF + 1] = 0;
        out[dest + T_OFF + 2] = tz;
        const nx = out[dest + N_OFF]!;
        const ny = out[dest + N_OFF + 1]!;
        const nz = out[dest + N_OFF + 2]!;
        let bx = ny * tz;
        let by = nz * tx - nx * tz;
        let bz = -ny * tx;
        const bLen = Math.hypot(bx, by, bz) || 1;
        out[dest + B_OFF] = bx / bLen;
        out[dest + B_OFF + 1] = by / bLen;
        out[dest + B_OFF + 2] = bz / bLen;
      }
      outIdx[destI] = destI;
    }
  }
  return new Mesh(out, outIdx, mesh.name);
}
