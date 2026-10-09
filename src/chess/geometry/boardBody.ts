/**
 * @file boardBody.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Chamfered board slab from the GPROC chess-board graph (CHESS-B4a).
 */

import { Mesh, STANDARD_MESH_VERTEX_FLOATS } from '@naanouff/w3dts-core';
import {
  CHESS_BOARD_BEVEL_M,
  CHESS_BOARD_BODY_HEIGHT,
  CHESS_BOARD_MESH_EXTENT,
} from '../board/chessBoard';
import { createChessBoardGraph } from '../gproc/chessBoardGraph';
import { executeChessGProcToMesh } from '../gproc/executeChessGProc';

const STRIDE = STANDARD_MESH_VERTEX_FLOATS;

/**
 * Per-face 0–1 UVs squash the thin rim. Rewrite as metres so gold tiles at a
 * uniform world density on top, underside, and edges.
 */
export function applyChessBoardWorldUvs(mesh: Mesh): Mesh {
  const v = mesh.vertices;
  for (let i = 0; i < v.length; i += STRIDE) {
    const x = v[i]!;
    const y = v[i + 1]!;
    const z = v[i + 2]!;
    const nx = v[i + 7]!;
    const ny = v[i + 8]!;
    const nz = v[i + 9]!;
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    let u: number;
    let vv: number;
    let tx: number;
    let ty: number;
    let tz: number;
    if (ay >= ax && ay >= az) {
      u = x;
      vv = z;
      tx = 1;
      ty = 0;
      tz = 0;
    } else if (ax >= az) {
      u = z;
      vv = y;
      tx = 0;
      ty = 0;
      tz = 1;
    } else {
      u = x;
      vv = y;
      tx = 1;
      ty = 0;
      tz = 0;
    }
    v[i + 3] = u;
    v[i + 4] = vv;
    v[i + 5] = u;
    v[i + 6] = vv;
    const tDotN = tx * nx + ty * ny + tz * nz;
    let t0 = tx - tDotN * nx;
    let t1 = ty - tDotN * ny;
    let t2 = tz - tDotN * nz;
    const tLen = Math.hypot(t0, t1, t2) || 1;
    t0 /= tLen;
    t1 /= tLen;
    t2 /= tLen;
    v[i + 10] = t0;
    v[i + 11] = t1;
    v[i + 12] = t2;
    v[i + 13] = ny * t2 - nz * t1;
    v[i + 14] = nz * t0 - nx * t2;
    v[i + 15] = nx * t1 - ny * t0;
  }
  return mesh;
}

const TOP_NORMAL_Y = 0.85;

function extractTriangles(
  source: Float32Array,
  indices: Uint16Array | Uint32Array,
  triangleStarts: readonly number[],
  name: string,
  rewrite?: (vertices: Float32Array) => void
): Mesh {
  const remap = new Map<number, number>();
  const outIndex: number[] = [];
  for (const start of triangleStarts) {
    for (let k = 0; k < 3; k++) {
      const from = indices[start + k]!;
      let to = remap.get(from);
      if (to === undefined) {
        to = remap.size;
        remap.set(from, to);
      }
      outIndex.push(to);
    }
  }
  const vertices = new Float32Array(remap.size * STRIDE);
  for (const [from, to] of remap) {
    vertices.set(source.subarray(from * STRIDE, (from + 1) * STRIDE), to * STRIDE);
  }
  rewrite?.(vertices);
  const IndexArray = indices instanceof Uint32Array ? Uint32Array : Uint16Array;
  return new Mesh(vertices, new IndexArray(outIndex), name);
}

/**
 * Flat playing surface (checker UVs, 0–1 across `extentXz`) and the remaining
 * rim. The gold body used to own the top, so the separate varnish quad never
 * became the surface on screen.
 * @param mesh - Centred chamfered slab from {@link buildChessBoardBodyMesh}.
 * @param extentXz - Inset top width in metres. Corner (−X, −Z) maps to UV (0, 1).
 */
export function splitChessBoardPlayingSurface(
  mesh: Mesh,
  extentXz: number
): { rim: Mesh; top: Mesh } {
  const source = mesh.vertices;
  const indices = mesh.indices;
  const topStarts: number[] = [];
  const rimStarts: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    let facingUp = true;
    for (let k = 0; k < 3; k++) {
      const ny = source[indices[t + k]! * STRIDE + 8]!;
      if (ny < TOP_NORMAL_Y) facingUp = false;
    }
    (facingUp ? topStarts : rimStarts).push(t);
  }
  const half = extentXz || 1;
  return {
    rim: extractTriangles(source, indices, rimStarts, 'ChessBoardRim'),
    top: extractTriangles(source, indices, topStarts, 'ChessBoardTop', (vertices) => {
      for (let i = 0; i < vertices.length; i += STRIDE) {
        const u = vertices[i]! / half + 0.5;
        const v = 0.5 - vertices[i + 2]! / half;
        vertices[i + 3] = u;
        vertices[i + 4] = v;
        vertices[i + 5] = u;
        vertices[i + 6] = v;
      }
    }),
  };
}

/**
 * Body centred at the origin. Outer AABB is `extentXz + 2*bevel`; the inset
 * top face is `extentXz`. Split it with {@link splitChessBoardPlayingSurface}
 * before drawing so the checker owns that face and the rim stays gold.
 */
export function buildChessBoardBodyMesh(
  extentXz = CHESS_BOARD_MESH_EXTENT,
  height: number = CHESS_BOARD_BODY_HEIGHT,
  bevel = CHESS_BOARD_BEVEL_M
): Mesh {
  return applyChessBoardWorldUvs(
    executeChessGProcToMesh(
      createChessBoardGraph(),
      { ExtentXz: extentXz, Height: height, Bevel: bevel },
      'ChessBoardBody'
    )
  );
}
