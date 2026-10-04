/**
 * @file savedGames.test.ts
 * @description One interruption slot and a capped list of voluntary saves.
 */

import { describe, expect, it } from 'vitest';
import { ChessMatch } from '../src/chess/index';
import {
  acceptSavedGame,
  emptySaveCabinet,
  parseSaveCabinet,
  putInterrupt,
  putVoluntary,
  type SavedGame,
} from '../src/chess/play/savedGames';

function movedFen(): string {
  const match = ChessMatch.starting();
  expect(match.tryMove('e2', 'e4').ok).toBe(true);
  return match.fen();
}

function fiche(id: string, shellMode: SavedGame['shellMode'] = 'cpu'): SavedGame {
  const accepted = acceptSavedGame({
    id,
    kind: 'voluntary',
    shellMode,
    fen: movedFen(),
    whiteSeconds: 400,
    blackSeconds: 500,
    localColor: 'white',
    savedAt: 1,
  });
  if (!accepted) throw new Error('expected a storable game');
  return accepted;
}

describe('save cabinet', () => {
  it('reads an unreadable payload as an empty cabinet', () => {
    expect(parseSaveCabinet(null)).toEqual(emptySaveCabinet());
    expect(parseSaveCabinet('{')).toEqual(emptySaveCabinet());
  });

  it('refuses an intact start and a finished game', () => {
    const start = ChessMatch.starting().fen();
    expect(
      acceptSavedGame({
        kind: 'interrupt',
        shellMode: 'cpu',
        fen: start,
        whiteSeconds: 600,
        blackSeconds: 600,
        localColor: 'white',
      })
    ).toBeNull();
    expect(
      acceptSavedGame({
        kind: 'interrupt',
        shellMode: 'cpu',
        fen: movedFen(),
        whiteSeconds: 400,
        blackSeconds: 500,
        localColor: 'white',
        flag: 'black',
      })
    ).toBeNull();
  });

  it('keeps a voluntary save when an interruption is written, and the reverse', () => {
    const kept = fiche('kept');
    const stopped = fiche('stopped');
    const withVoluntary = putVoluntary(emptySaveCabinet(), kept);
    const withBoth = putInterrupt(withVoluntary, stopped);
    expect(withBoth.voluntary.map((game) => game.id)).toEqual(['kept']);
    expect(withBoth.interrupt?.id).toBe('stopped');
    const again = putVoluntary(withBoth, fiche('next'));
    expect(again.interrupt?.id).toBe('stopped');
    expect(again.voluntary.map((game) => game.id)).toEqual(['kept', 'next']);
  });

  it('accepts local and online games the same way as a solo game', () => {
    for (const shellMode of ['cpu', 'hotseat', 'local', 'online', 'learn'] as const) {
      expect(fiche('one', shellMode).shellMode).toBe(shellMode);
    }
  });

  it('drops the oldest voluntary save at 21 and leaves the interruption', () => {
    let cabinet = emptySaveCabinet();
    for (let index = 0; index < 20; index += 1) {
      cabinet = putVoluntary(cabinet, fiche(`v${index}`));
    }
    cabinet = putInterrupt(cabinet, fiche('stop'));
    cabinet = putVoluntary(cabinet, fiche('v20'));
    expect(cabinet.voluntary).toHaveLength(20);
    expect(cabinet.voluntary[0]?.id).toBe('v1');
    expect(cabinet.voluntary[19]?.id).toBe('v20');
    expect(cabinet.interrupt?.id).toBe('stop');
  });
});
