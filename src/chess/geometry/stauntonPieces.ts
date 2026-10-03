/**
 * @file stauntonPieces.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Staunton-style meshes baked from GPROC graphs (lathe + knight extrusion).
 */

import type { Mesh } from '@naanouff/w3dts-core';
import type { ChessPieceRole } from '../rules/chessTypes';
import { createChessKnightGraph, createChessPieceGraph } from '../gproc/chessPieceGraphs';
import { executeChessGProcToMesh } from '../gproc/executeChessGProc';
import { MeshBuilder } from './meshBuilder';
import { chaikinOpen, STAUNTON_LATHE_SEGMENTS, STAUNTON_PAWN_PROFILE } from './stauntonProfiles';

/**
 * Pawn lathe with cylindrical UVs (0–1 wrap) for sampled PBR maps.
 * GPROC lathe pieces have no UVs — they stay on triplanar graph materials.
 */
export function buildStauntonPawnUvMesh(): Mesh {
  const b = new MeshBuilder();
  b.addLathe(chaikinOpen(STAUNTON_PAWN_PROFILE, 2), STAUNTON_LATHE_SEGMENTS);
  return b.toMesh('chess-pawn-uv');
}

/** Builds a local-space Staunton mesh. Origin at the base centre (y=0 on the board). */
export function buildStauntonPieceMesh(role: ChessPieceRole): Mesh {
  if (role === 'knight') {
    return executeChessGProcToMesh(createChessKnightGraph(), { Scale: 1 }, 'chess-knight');
  }
  return executeChessGProcToMesh(createChessPieceGraph(role), { Scale: 1 }, `chess-${role}`);
}

export function stauntonPieceHeight(role: ChessPieceRole): number {
  switch (role) {
    case 'pawn':
      return 0.054;
    case 'rook':
      return 0.06;
    case 'knight':
      return 0.062;
    case 'bishop':
      return 0.062;
    case 'queen':
      return 0.078;
    case 'king':
      return 0.092;
    default:
      return 0.054;
  }
}
