/**
 * @file openingTrainer.test.ts
 * @description CHESS-B3: ECO lines resolve and the SAN quiz accepts only book moves.
 */

import { describe, expect, it } from 'vitest';
import {
  ChessMatch,
  ECO_OPENINGS,
  OpeningTrainer,
  findEcoOpeningIndex,
  parseChessDemoQuery,
  resolveEcoLine,
} from '../src/chess/index';

describe('ECO openings', () => {
  it('resolves every catalog line from the start position', () => {
    for (const opening of ECO_OPENINGS) {
      const plies = resolveEcoLine(opening);
      expect(plies.length).toBe(opening.sans.length);
      expect(plies[0]?.from).toMatch(/^[a-h][1-8]$/);
    }
  });

  it('finds openings by ECO code or name', () => {
    expect(ECO_OPENINGS[findEcoOpeningIndex(ECO_OPENINGS, 'C50')]?.name).toBe('Italian Game');
    expect(ECO_OPENINGS[findEcoOpeningIndex(ECO_OPENINGS, 'ruy-lopez')]?.eco).toBe('C60');
  });
});

describe('OpeningTrainer', () => {
  it('accepts the Italian book and rejects an off-book legal move', () => {
    const trainer = new OpeningTrainer('C50');
    expect(trainer.opening().eco).toBe('C50');
    expect(trainer.expected()?.san.replace(/[+#]$/, '')).toBe('e4');
    expect(trainer.accept('e2', 'e4')).toBe(true);
    expect(trainer.isBookMove('e7', 'e6')).toBe(false);
    expect(trainer.accept('e7', 'e5')).toBe(true);
    expect(trainer.plyIndex()).toBe(2);
  });

  it('seeks to a book ply and stops at the end of the line', () => {
    const trainer = new OpeningTrainer('C50');
    trainer.seek(2);
    expect(trainer.plyIndex()).toBe(2);
    expect(trainer.isComplete()).toBe(false);
    trainer.seek(99);
    expect(trainer.plyIndex()).toBe(trainer.plyCount());
    expect(trainer.isComplete()).toBe(true);
    trainer.seek(-3);
    expect(trainer.plyIndex()).toBe(0);
  });

  it('completes a short line then cycles to the next opening', () => {
    const trainer = new OpeningTrainer('C00');
    for (const ply of resolveEcoLine(trainer.opening())) {
      expect(trainer.accept(ply.from, ply.to)).toBe(true);
    }
    expect(trainer.isComplete()).toBe(true);
    expect(trainer.nextOpening().eco).not.toBe('C00');
    expect(trainer.isComplete()).toBe(false);
  });
});

describe('ChessMatch.moveFromSan', () => {
  it('maps Nf3 from the start position', () => {
    const match = ChessMatch.starting();
    expect(match.moveFromSan('Nf3')).toEqual({ from: 'g1', to: 'f3' });
    expect(match.moveFromSan('not-a-move')).toBeNull();
  });
});

describe('learn query', () => {
  it('parses chess=learn with ECO and quiz flags', () => {
    expect(parseChessDemoQuery('?chess=learn&chessEco=C50&chessQuiz=1')).toEqual({
      mode: 'learn',
      localColor: 'white',
      eco: 'C50',
      quiz: true,
    });
    expect(parseChessDemoQuery('chess=eco').mode).toBe('learn');
  });
});
