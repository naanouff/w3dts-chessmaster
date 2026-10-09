/**
 * @file chessBoardGproc.test.ts
 * @description CHESS-B4a: board slab comes from a GPROC ChamferedBox graph.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STANDARD_MESH_VERTEX_FLOATS } from '@naanouff/w3dts-core';
import type { GProcGraph } from '@naanouff/w3dts-gproc';
import {
  buildChessBoardBodyMesh,
  CHESS_BOARD_BEVEL_M,
  CHESS_BOARD_BODY_HEIGHT,
  CHESS_BOARD_MESH_EXTENT,
  createChessBoardGraph,
  splitChessBoardPlayingSurface,
} from '../src/chess/index';

const publicGraphPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../public/gproc/chess-board.json'
);

describe('chess board GPROC graph', () => {
  it('exposes ExtentXz / Height / Bevel and ChamferedBox', () => {
    const graph = createChessBoardGraph();
    expect(graph.id).toBe('chess_board');
    expect(graph.nodes.some((n) => n.type === 'PrimitiveChamferedBox')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'BakeMeshMaps')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'GroupInput')).toBe(true);
    expect(graph.parameters?.ExtentXz?.value).toBe(CHESS_BOARD_MESH_EXTENT);
    expect(graph.parameters?.Height?.value).toBe(CHESS_BOARD_BODY_HEIGHT);
    expect(graph.parameters?.Bevel?.value).toBe(CHESS_BOARD_BEVEL_M);
  });

  it('keeps the editor public JSON in sync', () => {
    const graph = createChessBoardGraph();
    writeFileSync(publicGraphPath, `${JSON.stringify(graph, null, 2)}\n`);
    const published = JSON.parse(readFileSync(publicGraphPath, 'utf8')) as GProcGraph;
    expect(published.id).toBe(graph.id);
    expect(published.nodes.map((n) => n.type)).toEqual(graph.nodes.map((n) => n.type));
    expect(published.links.map((l) => l.id)).toEqual(graph.links.map((l) => l.id));
    expect(Number(published.parameters?.ExtentXz?.value)).toBeCloseTo(CHESS_BOARD_MESH_EXTENT, 10);
    expect(Number(published.parameters?.Bevel?.value)).toBe(CHESS_BOARD_BEVEL_M);
  });

  it('bakes a stride-20 mesh matching the V1 chamfer AABB', () => {
    const mesh = buildChessBoardBodyMesh(CHESS_BOARD_MESH_EXTENT, CHESS_BOARD_BODY_HEIGHT);
    expect(mesh.vertices.length % STANDARD_MESH_VERTEX_FLOATS).toBe(0);
    expect(mesh.indices.length / 3).toBe(44);
    expect(mesh.aabb.max[0]).toBeCloseTo(CHESS_BOARD_MESH_EXTENT / 2 + CHESS_BOARD_BEVEL_M, 6);
    expect(mesh.aabb.max[1]).toBeCloseTo(CHESS_BOARD_BODY_HEIGHT / 2, 6);
    expect(mesh.aabb.min[1]).toBeCloseTo(-CHESS_BOARD_BODY_HEIGHT / 2, 6);
  });

  it('puts checker UVs on the flat top and leaves the gold rim without that face', () => {
    const mesh = buildChessBoardBodyMesh(CHESS_BOARD_MESH_EXTENT, CHESS_BOARD_BODY_HEIGHT);
    const { rim, top } = splitChessBoardPlayingSurface(mesh, CHESS_BOARD_MESH_EXTENT);
    const stride = STANDARD_MESH_VERTEX_FLOATS;
    expect(top.indices.length).toBeGreaterThan(0);
    expect(rim.indices.length + top.indices.length).toBe(mesh.indices.length);

    let minU = 1;
    let maxU = 0;
    let minV = 1;
    let maxV = 0;
    for (let i = 0; i < top.vertices.length; i += stride) {
      const ny = top.vertices[i + 8]!;
      const u = top.vertices[i + 3]!;
      const v = top.vertices[i + 4]!;
      expect(ny).toBeGreaterThan(0.85);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
      const x = top.vertices[i]!;
      const z = top.vertices[i + 2]!;
      if (x < 0 && z < 0) {
        expect(u).toBeLessThan(0.5);
        expect(v).toBeGreaterThan(0.5);
      }
    }
    expect(minU).toBeLessThan(0.05);
    expect(maxU).toBeGreaterThan(0.95);
    expect(minV).toBeLessThan(0.05);
    expect(maxV).toBeGreaterThan(0.95);

    for (let t = 0; t < rim.indices.length; t += 3) {
      let facingUp = true;
      for (let k = 0; k < 3; k++) {
        const ny = rim.vertices[rim.indices[t + k]! * stride + 8]!;
        if (ny < 0.85) facingUp = false;
      }
      expect(facingUp).toBe(false);
    }
  });
});
