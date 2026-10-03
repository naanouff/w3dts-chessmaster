/**
 * @file fileRankLabels.ts
 * @project w3dts
 * @description World poses for a–h / 1–8 on the board frame (CHESS-B6a). GPU-less.
 */

import { quat, vec3 } from 'gl-matrix';
import type { ChessColor, ChessFile, ChessRank, ChessSquareName } from '../rules/chessTypes';
import {
  CHESS_BOARD_EXTENT,
  CHESS_BOARD_MESH_EXTENT,
  CHESS_BOARD_SURFACE_Y,
  squareToWorld,
} from './chessBoard';

export type ChessBoardLabelKind = 'file' | 'rank';

export interface ChessBoardLabelPose {
  glyph: string;
  kind: ChessBoardLabelKind;
  x: number;
  y: number;
  z: number;
  /**
   * In-plane twist (degrees) after Rx(−90). Viewer must use {@link chessBoardLabelQuat}
   * (Ry, not Rz) so the decal still projects along world −Y.
   */
  yawDeg: number;
}

const FILES = 'abcdefgh';
const RANKS = '12345678';

/** Mid-frame (between play edge and mesh edge). */
export function chessBoardRimRadius(): number {
  return (CHESS_BOARD_EXTENT + CHESS_BOARD_MESH_EXTENT) / 4;
}

/** Glyph footprint on the rim (⅔ of the border so the cut sits inside the gold). */
export function chessBoardLabelSize(): number {
  const border = (CHESS_BOARD_MESH_EXTENT - CHESS_BOARD_EXTENT) / 2;
  return border * (2 / 3);
}

const LABEL_Y = CHESS_BOARD_SURFACE_Y + 0.0016;

/**
 * 32 labels: a–h on both file rims, 1–8 on both flanks (SAN `Nf3` / `Nc6`).
 * World axes stay algebraic (a −X, 1 −Z). Each edge faces the player sitting there:
 * −Z → white, +Z → black, ±X flanks face outward. {@link localColor} does not
 * spin every glyph the same way (that made them all read for black).
 */
export function chessBoardLabelPoses(localColor: ChessColor): ChessBoardLabelPose[] {
  const rim = chessBoardRimRadius();
  const whiteZ = -rim;
  const blackZ = rim;
  const fileZ = localColor === 'white' ? [whiteZ, blackZ] : [blackZ, whiteZ];
  const queenX = -rim;
  const kingX = rim;
  const rankX = localColor === 'white' ? [queenX, kingX] : [kingX, queenX];
  const poses: ChessBoardLabelPose[] = [];
  for (const z of fileZ) {
    /** Glyph up away from the seated player on this rim (reads upright). */
    const yawDeg = z < 0 ? 180 : 0;
    for (let i = 0; i < 8; i++) {
      const file = FILES[i] as ChessFile;
      const p = squareToWorld(`${file}1` as ChessSquareName);
      poses.push({
        glyph: file,
        kind: 'file',
        x: p[0]!,
        y: LABEL_Y,
        z,
        yawDeg,
      });
    }
  }
  for (const x of rankX) {
    /** Glyph up toward the squares so the flank reads from outside. */
    const yawDeg = x < 0 ? -90 : 90;
    for (let i = 0; i < 8; i++) {
      const rank = RANKS[i] as ChessRank;
      const p = squareToWorld(`a${rank}` as ChessSquareName);
      poses.push({
        glyph: rank,
        kind: 'rank',
        x,
        y: LABEL_Y,
        z: p[2]!,
        yawDeg,
      });
    }
  }
  return poses;
}

export function chessBoardLabelPoseVec(pose: ChessBoardLabelPose, out = vec3.create()): vec3 {
  return vec3.set(out, pose.x, pose.y, pose.z);
}

/**
 * Decal projector: Rx(−90) then Ry(yaw). Local −Z stays world −Y while the glyph
 * spins on the frame (Rz after Rx would aim the projector into the XZ plane).
 */
export function chessBoardLabelQuat(pose: ChessBoardLabelPose, out = quat.create()): quat {
  return quat.fromEuler(out, -90, pose.yawDeg, 0);
}
