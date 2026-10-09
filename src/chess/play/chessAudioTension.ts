/**
 * @file chessAudioTension.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Local material score → ambience bed gains (CHESS-B25e).
 */

import type { ChessColor } from '../rules/chessTypes';

/** Discrete tension band used for bed layering. */
export type ChessAudioTensionBand = 'calm' | 'edge' | 'pressure';

/** Linear gains for looped beds before the ambience master. */
export interface ChessAudioBedGains {
  calm: number;
  edge: number;
  pressure: number;
  /** Room melody for the calm (neutral) band. */
  music: number;
  /** Room melody for the edge (advantage) band. */
  musicEdge: number;
  /** Room melody for the pressure band. */
  musicPressure: number;
}

/** Enter edge / pressure when |score| reaches this (centipawns). */
export const CHESS_AUDIO_TENSION_ENTER = 80;

/** Leave edge / pressure when |score| falls below this. */
export const CHESS_AUDIO_TENSION_EXIT = 40;

const BAND_GAINS: Record<ChessAudioTensionBand, ChessAudioBedGains> = {
  calm: { calm: 0.5, edge: 0, pressure: 0, music: 1.1, musicEdge: 0, musicPressure: 0 },
  edge: {
    calm: 0.325,
    edge: 0.275,
    pressure: 0,
    music: 0,
    musicEdge: 0.9,
    musicPressure: 0,
  },
  pressure: {
    calm: 0.325,
    edge: 0,
    pressure: 0.3,
    music: 0,
    musicEdge: 0,
    musicPressure: 0.56,
  },
};

/**
 * Turns a white-centric material score into one centered on the local player.
 * @param whiteScore - Positive when White is ahead in material.
 * @param localColor - Side the listener plays.
 */
export function chessScoreForLocal(whiteScore: number, localColor: ChessColor): number {
  return localColor === 'white' ? whiteScore : -whiteScore;
}

/**
 * Steps the tension band with hysteresis and returns bed gains.
 * @param scoreForLocal - Material score from the local player's side.
 * @param previous - Band from the last step.
 */
export function chessAudioTensionStep(
  scoreForLocal: number,
  previous: ChessAudioTensionBand
): { band: ChessAudioTensionBand; gains: ChessAudioBedGains } {
  const band = nextBand(scoreForLocal, previous);
  return { band, gains: BAND_GAINS[band] };
}

function nextBand(score: number, previous: ChessAudioTensionBand): ChessAudioTensionBand {
  if (previous === 'edge') {
    if (score < CHESS_AUDIO_TENSION_EXIT) {
      return score <= -CHESS_AUDIO_TENSION_ENTER ? 'pressure' : 'calm';
    }
    return 'edge';
  }
  if (previous === 'pressure') {
    if (score > -CHESS_AUDIO_TENSION_EXIT) {
      return score >= CHESS_AUDIO_TENSION_ENTER ? 'edge' : 'calm';
    }
    return 'pressure';
  }
  if (score >= CHESS_AUDIO_TENSION_ENTER) return 'edge';
  if (score <= -CHESS_AUDIO_TENSION_ENTER) return 'pressure';
  return 'calm';
}
