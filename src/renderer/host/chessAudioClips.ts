/**
 * @file chessAudioClips.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Stable `/audio/chess/` URLs for tabletop clips (CHESS-B25d).
 */

import type { ChessAmbianceId } from './chessAmbiance';
import type { ChessTableSfxId } from '../../chess';

/** Clip roles that resolve to a file under `public/audio/chess/`. */
export type ChessAudioClipKind =
  | ChessTableSfxId
  | 'bed-calm'
  | 'bed-edge'
  | 'bed-pressure'
  | 'bed-music'
  | 'bed-music-edge'
  | 'bed-music-pressure'
  | 'menu-music';

const ROOT = '/audio/chess';

/**
 * Maps a clip role and room to a packaged Ogg Opus URL.
 * @param kind - One-shot or bed layer.
 * @param ambiance - Active room (ignored for shared clips).
 */
export function chessTableClipUrl(kind: ChessAudioClipKind, ambiance: ChessAmbianceId): string {
  switch (kind) {
    case 'drop':
      return `${ROOT}/drop-${ambiance}.ogg`;
    case 'capture':
      return `${ROOT}/capture-${ambiance}.ogg`;
    case 'check':
      return `${ROOT}/check.ogg`;
    case 'win':
      return `${ROOT}/win.ogg`;
    case 'lose':
      return `${ROOT}/lose.ogg`;
    case 'bed-calm':
      return `${ROOT}/bed-${ambiance}-calm.ogg`;
    case 'bed-edge':
      return `${ROOT}/bed-edge.ogg`;
    case 'bed-pressure':
      return `${ROOT}/bed-pressure.ogg`;
    case 'bed-music':
      return `${ROOT}/bed-${ambiance}-music.ogg`;
    case 'bed-music-edge':
      return `${ROOT}/bed-${ambiance}-music-edge.ogg`;
    case 'bed-music-pressure':
      return `${ROOT}/bed-${ambiance}-music-pressure.ogg`;
    case 'menu-music':
      return `${ROOT}/menu-music.ogg`;
  }
}
