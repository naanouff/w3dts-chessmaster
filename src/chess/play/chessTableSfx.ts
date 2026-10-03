/**
 * @file chessTableSfx.ts
 * @project w3dts
 * @description Clip ids for tabletop SFX (CHESS-B6e). No Web Audio in this package.
 */

export type ChessTableSfxId = 'drop' | 'capture' | 'check' | 'win' | 'lose';

export interface ChessTableSfxCue {
  captured: boolean;
  check: boolean;
  mate: boolean;
  /** Local player won (mate or flag). */
  localWon: boolean;
}

/**
 * Ordered one-shots for a resolved ply. Capture replaces drop (one wooden hit).
 * Mate / flag play after the landing sound.
 */
export function chessTableSfxForPly(cue: ChessTableSfxCue): ChessTableSfxId[] {
  const ids: ChessTableSfxId[] = [];
  ids.push(cue.captured ? 'capture' : 'drop');
  if (cue.mate) {
    ids.push(cue.localWon ? 'win' : 'lose');
    return ids;
  }
  if (cue.check) ids.push('check');
  return ids;
}
