/**
 * @file stauntonGeometry.test.ts
 * @project w3dts
 * @description Staunton builders emit stride-20 meshes and compound colliders.
 */

import { describe, expect, it } from 'vitest';
import { STANDARD_MESH_VERTEX_FLOATS } from '@naanouff/w3dts-core';
import {
  boardColliderShape,
  buildChessBoardBodyMesh,
  buildStauntonPieceMesh,
  buildStauntonPawnUvMesh,
  CHESS_BOARD_BEVEL_M,
  CHESS_BOARD_BODY_HEIGHT,
  CHESS_BOARD_MESH_EXTENT,
  boardAlbedoCell,
  applyCylindricalPieceUvs,
  fillBoardAlbedo,
  fillEbonyAlbedo,
  fillIvoryAlbedo,
  stauntonPieceColliderShapes,
  stauntonPieceHeight,
  type ChessPieceRole,
} from '../src/chess/index';

const ROLES: ChessPieceRole[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const STRIDE = STANDARD_MESH_VERTEX_FLOATS;
const N_OFF = 7;

function windingOutwardScore(mesh: {
  vertices: Float32Array;
  indices: Uint16Array | Uint32Array;
  aabb: { min: number[]; max: number[] };
}): number {
  const v = mesh.vertices;
  const idx = mesh.indices;
  const cx = (mesh.aabb.min[0]! + mesh.aabb.max[0]!) * 0.5;
  const cy = (mesh.aabb.min[1]! + mesh.aabb.max[1]!) * 0.5;
  const cz = (mesh.aabb.min[2]! + mesh.aabb.max[2]!) * 0.5;
  let score = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i]! * STRIDE;
    const ib = idx[i + 1]! * STRIDE;
    const ic = idx[i + 2]! * STRIDE;
    const ax = v[ia]!;
    const ay = v[ia + 1]!;
    const az = v[ia + 2]!;
    const e1x = v[ib]! - ax;
    const e1y = v[ib + 1]! - ay;
    const e1z = v[ib + 2]! - az;
    const e2x = v[ic]! - ax;
    const e2y = v[ic + 1]! - ay;
    const e2z = v[ic + 2]! - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const mx = (ax + v[ib]! + v[ic]!) / 3 - cx;
    const my = (ay + v[ib + 1]! + v[ic + 1]!) / 3 - cy;
    const mz = (az + v[ib + 2]! + v[ic + 2]!) / 3 - cz;
    score += nx * mx + ny * my + nz * mz;
  }
  return score;
}

function vertexNormalOutwardScore(mesh: {
  vertices: Float32Array;
  aabb: { min: number[]; max: number[] };
}): number {
  const v = mesh.vertices;
  const cx = (mesh.aabb.min[0]! + mesh.aabb.max[0]!) * 0.5;
  const cy = (mesh.aabb.min[1]! + mesh.aabb.max[1]!) * 0.5;
  const cz = (mesh.aabb.min[2]! + mesh.aabb.max[2]!) * 0.5;
  let score = 0;
  for (let i = 0; i < v.length; i += STRIDE) {
    score +=
      v[i + N_OFF]! * (v[i]! - cx) +
      v[i + N_OFF + 1]! * (v[i + 1]! - cy) +
      v[i + N_OFF + 2]! * (v[i + 2]! - cz);
  }
  return score;
}

/** Fraction of triangles whose geometric normal matches the vertex normals (same hemisphere). */
function faceVertexNormalAgreement(mesh: {
  vertices: Float32Array;
  indices: Uint16Array | Uint32Array;
}): number {
  const v = mesh.vertices;
  const idx = mesh.indices;
  let ok = 0;
  let n = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i]! * STRIDE;
    const ib = idx[i + 1]! * STRIDE;
    const ic = idx[i + 2]! * STRIDE;
    const e1x = v[ib]! - v[ia]!;
    const e1y = v[ib + 1]! - v[ia + 1]!;
    const e1z = v[ib + 2]! - v[ia + 2]!;
    const e2x = v[ic]! - v[ia]!;
    const e2y = v[ic + 1]! - v[ia + 1]!;
    const e2z = v[ic + 2]! - v[ia + 2]!;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const vx =
      v[ia + N_OFF]! + v[ib + N_OFF]! + v[ic + N_OFF]!;
    const vy =
      v[ia + N_OFF + 1]! + v[ib + N_OFF + 1]! + v[ic + N_OFF + 1]!;
    const vz =
      v[ia + N_OFF + 2]! + v[ib + N_OFF + 2]! + v[ic + N_OFF + 2]!;
    n += 1;
    if (nx * vx + ny * vy + nz * vz > 0) ok += 1;
  }
  return n === 0 ? 0 : ok / n;
}

describe('Staunton geometry', () => {
  it('builds six non-empty stride-20 meshes', () => {
    for (const role of ROLES) {
      const mesh = buildStauntonPieceMesh(role);
      expect(mesh.vertices.length % STANDARD_MESH_VERTEX_FLOATS).toBe(0);
      expect(mesh.vertices.length / STANDARD_MESH_VERTEX_FLOATS).toBeGreaterThan(8);
      expect(mesh.indexCount).toBeGreaterThan(8);
      expect(mesh.aabb.max[1]!).toBeGreaterThan(0.02);
    }
  });

  it('gives the UV pawn a cylindrical wrap (0–1 in U)', () => {
    const mesh = buildStauntonPawnUvMesh();
    const v = mesh.vertices;
    let minU = Infinity;
    let maxU = -Infinity;
    for (let i = 0; i < v.length; i += STRIDE) {
      minU = Math.min(minU, v[i + 3]!);
      maxU = Math.max(maxU, v[i + 3]!);
    }
    expect(maxU - minU).toBeGreaterThan(0.9);
    expect(minU).toBeGreaterThanOrEqual(0);
    expect(maxU).toBeLessThanOrEqual(1);
  });

  it('makes the knight taller / larger than the pawn', () => {
    const pawn = buildStauntonPieceMesh('pawn');
    const knight = buildStauntonPieceMesh('knight');
    expect(knight.aabb.max[1]!).toBeGreaterThan(pawn.aabb.max[1]!);
    expect(stauntonPieceHeight('knight')).toBeGreaterThan(stauntonPieceHeight('pawn'));
  });

  it('returns at least two compound AABB shapes per piece', () => {
    for (const role of ROLES) {
      const shapes = stauntonPieceColliderShapes(role);
      expect(shapes.length).toBeGreaterThanOrEqual(2);
      expect(shapes.every((s) => s.type === 'AABB')).toBe(true);
    }
  });

  it('uses outward CCW winding (WebGPU back-face cull)', () => {
    for (const role of ROLES) {
      const mesh = buildStauntonPieceMesh(role);
      expect(windingOutwardScore(mesh), role).toBeGreaterThan(0);
      expect(vertexNormalOutwardScore(mesh), role).toBeGreaterThan(0);
      expect(faceVertexNormalAgreement(mesh), role).toBeGreaterThan(0.95);
    }
  });

  it('sizes the board collider to the visual cube including the frame', () => {
    const shape = boardColliderShape(0.012);
    expect(shape.type).toBe('AABB');
    expect(shape.size?.[0]).toBeCloseTo(CHESS_BOARD_MESH_EXTENT / 2, 6);
    expect(shape.size?.[2]).toBeCloseTo(CHESS_BOARD_MESH_EXTENT / 2, 6);
    expect(shape.offset?.[1]).toBe(0);
  });

  it('builds a chamfered board body with outward winding', () => {
    const height = 0.024;
    const mesh = buildChessBoardBodyMesh(CHESS_BOARD_MESH_EXTENT, height);
    expect(mesh.indices.length / 3).toBe(44);
    expect(mesh.aabb.max[0]).toBeCloseTo(CHESS_BOARD_MESH_EXTENT / 2 + CHESS_BOARD_BEVEL_M, 6);
    expect(mesh.aabb.max[1]).toBeCloseTo(height / 2, 6);
    expect(windingOutwardScore(mesh)).toBeGreaterThan(0);
    expect(faceVertexNormalAgreement(mesh)).toBeGreaterThan(0.95);
  });

  it('gives the board rim world-space UVs (not 0–1 squashed onto the height)', () => {
    const mesh = buildChessBoardBodyMesh(CHESS_BOARD_MESH_EXTENT, CHESS_BOARD_BODY_HEIGHT);
    const v = mesh.vertices;
    let side: { y: number; z: number; u: number; vv: number } | null = null;
    let side2: { y: number; z: number; u: number; vv: number } | null = null;
    for (let i = 0; i < v.length; i += STRIDE) {
      if (v[i + 7]! < 0.85) continue;
      const row = { y: v[i + 1]!, z: v[i + 2]!, u: v[i + 3]!, vv: v[i + 4]! };
      if (!side) side = row;
      else if (Math.abs(row.z - side.z) > 0.05 || Math.abs(row.y - side.y) > 0.005) {
        side2 = row;
        break;
      }
    }
    expect(side).not.toBeNull();
    expect(side2).not.toBeNull();
    if (!side || !side2) return;
    const du = Math.abs(side2.u - side.u);
    const dv = Math.abs(side2.vv - side.vv);
    const dz = Math.abs(side2.z - side.z);
    const dy = Math.abs(side2.y - side.y);
    if (dz > dy) expect(du).toBeCloseTo(dz, 5);
    else expect(dv).toBeCloseTo(dy, 5);
  });
});

describe('procedural albedo', () => {
  it('fills opaque RGB buffers', () => {
    const size = 32;
    const board = new Uint8ClampedArray(size * size * 4);
    const ivory = new Uint8ClampedArray(size * size * 4);
    const ebony = new Uint8ClampedArray(size * size * 4);
    fillBoardAlbedo(board, size);
    fillIvoryAlbedo(ivory, size);
    fillEbonyAlbedo(ebony, size);
    expect(board[3]).toBe(255);
    expect(ivory[0]).toBeGreaterThan(180);
    expect(ebony[0]!).toBeLessThan(80);
  });

  it('paints honey light squares brighter than walnut dark squares', () => {
    const size = 64;
    const board = new Uint8ClampedArray(size * size * 4);
    fillBoardAlbedo(board, size);
    const sample = (u: number, v: number): number => {
      const x = Math.floor(u * size);
      const y = Math.floor(v * size);
      return board[(y * size + x) * 4]!;
    };
    // Inner UV: border 0.06, square 0 is [0.06, 0.17); fy=0,fx=0 is dark; fy=1,fx=0 is light.
    const dark = sample(0.06 + 0.88 / 16, 0.06 + 0.88 / 16);
    const light = sample(0.06 + 0.88 / 16, 0.06 + 0.88 / 16 + 0.88 / 8);
    expect(light).toBeGreaterThan(140);
    expect(dark).toBeLessThan(110);
    expect(light).toBeGreaterThan(dark + 40);
  });

  it('maps UV to frame vs 8×8 squares (a1 dark)', () => {
    expect(boardAlbedoCell(0.02, 0.5).kind).toBe('frame');
    const a1 = boardAlbedoCell(0.06 + 0.88 / 16, 0.06 + 0.88 / 16);
    expect(a1.kind).toBe('square');
    if (a1.kind !== 'square') return;
    expect(a1.fx).toBe(0);
    expect(a1.fy).toBe(0);
    expect(a1.light).toBe(false);
  });
});

describe('cylindrical piece UVs', () => {
  it('unwraps GPROC lathe pieces without smearing across the 0/1 seam', () => {
    const mesh = applyCylindricalPieceUvs(buildStauntonPieceMesh('pawn'));
    const v = mesh.vertices;
    let minU = Infinity;
    let maxU = -Infinity;
    for (let i = 0; i < v.length; i += STRIDE) {
      minU = Math.min(minU, v[i + 3]!);
      maxU = Math.max(maxU, v[i + 3]!);
    }
    expect(maxU - minU).toBeGreaterThan(0.9);
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const u0 = v[mesh.indices[t]! * STRIDE + 3]!;
      const u1 = v[mesh.indices[t + 1]! * STRIDE + 3]!;
      const u2 = v[mesh.indices[t + 2]! * STRIDE + 3]!;
      expect(Math.max(u0, u1, u2) - Math.min(u0, u1, u2)).toBeLessThanOrEqual(1.01);
    }
  });
});
