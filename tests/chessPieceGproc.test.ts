/**
 * @file chessPieceGproc.test.ts
 * @description CHESS-B4b/B4c: Staunton pieces bake from GPROC graphs.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STANDARD_MESH_VERTEX_FLOATS } from '@naanouff/w3dts-core';
import type { GProcGraph } from '@naanouff/w3dts-gproc';
import {
  buildStauntonPieceMesh,
  CHESS_KNIGHT_HEAD_THICKNESS,
  createChessKnightGraph,
  createChessPieceGraph,
  executeChessGProcToMesh,
  isChessLatheRole,
  stauntonPieceHeight,
  type ChessPieceRole,
} from '../src/chess/index';
import {
  STAUNTON_BISHOP_PROFILE,
  STAUNTON_KING_PROFILE,
  STAUNTON_PAWN_PROFILE,
  STAUNTON_QUEEN_PROFILE,
  STAUNTON_ROOK_PROFILE,
  STAUNTON_LATHE_SEGMENTS,
} from '../src/chess/geometry/stauntonProfiles';

const LATHE_ROLES = ['pawn', 'bishop', 'rook', 'queen', 'king'] as const;
const STRIDE = STANDARD_MESH_VERTEX_FLOATS;

const publicDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../public/gproc'
);

const PROFILE: Record<(typeof LATHE_ROLES)[number], Array<[number, number]>> = {
  pawn: STAUNTON_PAWN_PROFILE,
  bishop: STAUNTON_BISHOP_PROFILE,
  rook: STAUNTON_ROOK_PROFILE,
  queen: STAUNTON_QUEEN_PROFILE,
  king: STAUNTON_KING_PROFILE,
};

describe('chess piece GPROC lathe graphs', () => {
  it('builds a Lathe + Polyline graph per role', () => {
    for (const role of LATHE_ROLES) {
      expect(isChessLatheRole(role)).toBe(true);
      const graph = createChessPieceGraph(role);
      expect(graph.id).toBe(`chess_${role}`);
      expect(graph.nodes.some((n) => n.type === 'PrimitivePolyline')).toBe(true);
      expect(graph.nodes.some((n) => n.type === 'Lathe')).toBe(true);
      expect(graph.nodes.find((n) => n.type === 'Lathe')?.properties?.fillCaps).toBe(true);
      expect(graph.nodes.find((n) => n.type === 'Lathe')?.properties?.segments).toBe(
        STAUNTON_LATHE_SEGMENTS
      );
      expect(graph.nodes.some((n) => n.type === 'SetShadeSmooth')).toBe(true);
      expect(graph.nodes.some((n) => n.type === 'BakeMeshMaps')).toBe(true);
      expect(graph.nodes.some((n) => n.type === 'SetShadeFlat')).toBe(false);
      expect(graph.parameters?.Scale?.value).toBe(1);
    }
  });

  it('adds Staunton details on rook, bishop, queen, king', () => {
    expect(createChessPieceGraph('pawn').nodes.some((n) => n.type === 'PrimitiveCube')).toBe(
      false
    );
    expect(createChessPieceGraph('rook').nodes.filter((n) => n.type === 'PrimitiveCube')).toHaveLength(
      4
    );
    expect(createChessPieceGraph('bishop').nodes.filter((n) => n.type === 'PrimitiveCube')).toHaveLength(
      1
    );
    expect(createChessPieceGraph('queen').nodes.filter((n) => n.type === 'PrimitiveCube')).toHaveLength(
      8
    );
    expect(createChessPieceGraph('king').nodes.filter((n) => n.type === 'PrimitiveCube')).toHaveLength(
      2
    );
  });

  it('publishes editor JSON matching the factory', () => {
    for (const role of LATHE_ROLES) {
      const graph = createChessPieceGraph(role);
      const path = join(publicDir, `chess-${role}.json`);
      writeFileSync(path, `${JSON.stringify(graph, null, 2)}\n`);
      const published = JSON.parse(readFileSync(path, 'utf8')) as GProcGraph;
      expect(published.id).toBe(graph.id);
      expect(published.nodes.map((n) => n.type)).toEqual(graph.nodes.map((n) => n.type));
      expect(published.links.map((l) => l.id)).toEqual(graph.links.map((l) => l.id));
    }
  });

  it('bakes stride-20 meshes with V1 heights', () => {
    for (const role of LATHE_ROLES) {
      const mesh = buildStauntonPieceMesh(role);
      expect(mesh.vertices.length % STANDARD_MESH_VERTEX_FLOATS).toBe(0);
      expect(mesh.aabb.max[1]!).toBeGreaterThan(stauntonPieceHeight(role) - 0.004);
      expect(mesh.aabb.max[1]!).toBeLessThan(stauntonPieceHeight(role) + 0.004);
      expect(mesh.aabb.min[1]!).toBeCloseTo(0, 2);
    }
  });

  it('caps the lathe opening at the last profile ring', () => {
    for (const role of LATHE_ROLES) {
      const last = PROFILE[role][PROFILE[role].length - 1]!;
      const mesh = buildStauntonPieceMesh(role);
      const v = mesh.vertices;
      let found = false;
      for (let i = 0; i < v.length; i += STRIDE) {
        const y = v[i + 1]!;
        const radial = Math.hypot(v[i]!, v[i + 2]!);
        if (Math.abs(y - last[0]) < 1e-4 && radial < last[1] * 0.25) {
          found = true;
          break;
        }
      }
      expect(found, role).toBe(true);
    }
  });

  it('shares vertices so lathe bodies stay smooth (not SetShadeFlat)', () => {
    for (const role of LATHE_ROLES) {
      const mesh = buildStauntonPieceMesh(role);
      const vertCount = mesh.vertices.length / STRIDE;
      expect(vertCount, role).toBeLessThan(mesh.indices.length);
    }
  });

  it('keeps king taller than queen taller than pawn', () => {
    const pawn = buildStauntonPieceMesh('pawn');
    const queen = buildStauntonPieceMesh('queen');
    const king = buildStauntonPieceMesh('king');
    expect(queen.aabb.max[1]!).toBeGreaterThan(pawn.aabb.max[1]!);
    expect(king.aabb.max[1]!).toBeGreaterThan(queen.aabb.max[1]!);
  });

  it('bakes the knight from a GPROC extrusion graph, not a lathe', () => {
    const role: ChessPieceRole = 'knight';
    expect(isChessLatheRole(role)).toBe(false);
    const graph = createChessKnightGraph();
    expect(graph.id).toBe('chess_knight');
    expect(graph.nodes.some((n) => n.type === 'ExtrudeMesh')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'Lathe')).toBe(true);
    expect(graph.nodes.find((n) => n.id === 'silhouette')?.properties?.fill).toBe(true);
    expect(graph.nodes.filter((n) => n.type === 'PrimitiveCube')).toHaveLength(2);
    const path = join(publicDir, 'chess-knight.json');
    writeFileSync(path, `${JSON.stringify(graph, null, 2)}\n`);
    const published = JSON.parse(readFileSync(path, 'utf8')) as GProcGraph;
    expect(published.nodes.map((n) => n.type)).toEqual(graph.nodes.map((n) => n.type));
    const mesh = buildStauntonPieceMesh('knight');
    const pawn = buildStauntonPieceMesh('pawn');
    expect(mesh.indexCount).toBeGreaterThan(800);
    expect(mesh.aabb.max[1]!).toBeGreaterThan(stauntonPieceHeight('knight') - 0.004);
    expect(mesh.aabb.max[1]!).toBeLessThan(stauntonPieceHeight('knight') + 0.004);
    const knightZ = mesh.aabb.max[2]! - mesh.aabb.min[2]!;
    const pawnX = pawn.aabb.max[0]! - pawn.aabb.min[0]!;
    expect(knightZ).toBeGreaterThan(pawnX * 0.9);
    expect(Math.abs(mesh.aabb.min[0]! + mesh.aabb.max[0]!)).toBeLessThan(0.008);
    expect(mesh.aabb.max[0]! - mesh.aabb.min[0]!).toBeGreaterThan(
      CHESS_KNIGHT_HEAD_THICKNESS - 0.002
    );
  });

  it('executes published editor JSON for all six Staunton roles', () => {
    const roles: ChessPieceRole[] = ['pawn', 'bishop', 'rook', 'queen', 'king', 'knight'];
    for (const role of roles) {
      const graph = JSON.parse(readFileSync(join(publicDir, `chess-${role}.json`), 'utf8')) as GProcGraph;
      const mesh = executeChessGProcToMesh(graph, { Scale: 1 }, `pub-${role}`);
      expect(mesh.indexCount, role).toBeGreaterThan(100);
      expect(mesh.vertices.length % STANDARD_MESH_VERTEX_FLOATS, role).toBe(0);
    }
  });
});
