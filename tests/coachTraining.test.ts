/**
 * @file coachTraining.test.ts
 * @description Coach search, prompts, and training undo.
 */

import { describe, expect, it } from 'vitest';
import { ChessMatch } from '../src/chess/rules/ChessMatch';
import { clampCoachHorizon, planAhead, reviewPlayedMove } from '../src/chess/coach/coachPlan';
import {
  buildHintMessages,
  buildMistakeMessages,
  legalSansFromFen,
} from '../src/chess/coach/coachPrompt';
import {
  canUndoMyMove,
  recordPly,
  shouldCpuReply,
  undoMyMove,
} from '../src/chess/coach/trainingReview';
import { parseChessDemoQuery } from '../src/chess/play/parseChessDemoQuery';
import { coachGhostSteps } from '../src/renderer/shell/coachDrawer';
import { coachDialoguePages } from '../src/renderer/shell/coachDialogue';
import {
  coachErrorColor,
  coachGhostColor,
  coachMaskPosition,
  coachPieceMarks,
  coachPinnedSquares,
  coachSourceMarks,
  coachStableMarks,
} from '../src/chess/coach/coachMarks';

const HANGING = '4k3/8/8/8/8/1q6/P7/4K3 w - - 0 1';

describe('coach plan', () => {
  it('clamps the horizon to 1–5', () => {
    expect(clampCoachHorizon(0)).toBe(1);
    expect(clampCoachHorizon(3.9)).toBe(3);
    expect(clampCoachHorizon(9)).toBe(5);
    expect(clampCoachHorizon(Number.NaN)).toBe(1);
  });

  it('returns a legal line from the start', () => {
    const fen = ChessMatch.starting().fen();
    const line = planAhead(fen, 1);
    expect(line).not.toBeNull();
    const root = ChessMatch.fromFen(fen);
    const step = line?.steps[0];
    expect(step).toBeTruthy();
    if (!step) return;
    expect(root.tryMove(step.from, step.to).ok).toBe(true);
    expect(legalSansFromFen(fen).length).toBeLessThanOrEqual(48);
  });

  it('rejects a fen the rules cannot load', () => {
    expect(planAhead('not a fen', 1)).toBeNull();
  });

  it('calls a missed queen a mistake', () => {
    const review = reviewPlayedMove(HANGING, 'Ke2', 2);
    expect(review?.kind).toBe('mistake');
    expect(review?.line.sans[0]).toBe('axb3');
  });

  it('keeps the move shown on the board even when a shorter search prefers another', () => {
    const shown = [{ san: 'Ke2', from: 'e1', to: 'e2', role: 'king' as const, color: 'white' as const }];
    const review = reviewPlayedMove(HANGING, 'Ke2', 2, shown);
    expect(review?.kind).toBe('kept');
  });
});

describe('coach prompts', () => {
  it('does not label a book move during a quiz', () => {
    const text = buildHintMessages(ChessMatch.starting().fen(), [], true)
      .map((message) => message.content)
      .join('\n');
    expect(text).not.toMatch(/book move|coup du livre|expected move/i);
  });

  it('names the played move and the search move when they differ', () => {
    const line = planAhead(HANGING, 2);
    const text = buildMistakeMessages(HANGING, [], 'Ke2', line, 'fr')
      .map((message) => message.content)
      .join('\n');
    expect(text).toContain('Ke2');
    expect(text).toContain('Teach the mistake');
    expect(text).toContain('French');
    expect(text).toContain('at most two short sentences');
    expect(text).toContain('opponent piece');
    expect(text).toContain(line?.sans[0]);
  });
});

describe('coach dialogue', () => {
  it('keeps only the student moves on the board', () => {
    const fen = ChessMatch.starting().fen();
    const raw = planAhead(fen, 3)?.steps ?? [];
    expect(raw.some((step) => step.color === 'black')).toBe(true);
    const shown = coachGhostSteps(fen, 3, 'white');
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((step) => step.color === 'white')).toBe(true);
  });

  it('packs whole sentences into a dialogue bubble', () => {
    expect(coachDialoguePages('Un. Deux mots. Trois.', 12)).toEqual(['Un.', 'Deux mots.', 'Trois.']);
  });

  it('does not cut a sentence that is longer than the bubble', () => {
    const sentence = 'Cette phrase est bien trop longue pour la bulle.';
    expect(coachDialoguePages(sentence, 12)).toEqual([sentence]);
  });
});

describe('training review', () => {
  it('undoes the student ply and a reply already played', () => {
    const log = recordPly(
      recordPly([], { fenBefore: 'start', san: 'e4', color: 'white' }),
      { fenBefore: 'after', san: 'e5', color: 'black' }
    );
    const undone = undoMyMove(log, 'white');
    expect(undone).toEqual({
      log: [],
      fen: 'start',
      undoneSan: 'e4',
      removedReplySan: 'e5',
    });
    expect(canUndoMyMove([], 'white')).toBe(false);
  });

  it('holds the computer only in training', () => {
    const base = {
      mode: 'training' as const,
      held: false,
      busy: false,
      motion: false,
      gameOver: false,
      side: 'black' as const,
      local: 'white' as const,
    };
    expect(shouldCpuReply(base)).toBe(true);
    expect(shouldCpuReply({ ...base, held: true })).toBe(false);
    expect(shouldCpuReply({ ...base, mode: 'hotseat' })).toBe(false);
    expect(shouldCpuReply({ ...base, mode: 'cpu', held: true })).toBe(true);
  });
});

describe('coach marks', () => {
  it('paints the next ghost green, then blue, then yellow', () => {
    const green = coachGhostColor(0);
    const blue = coachGhostColor(1);
    const yellow = coachGhostColor(2);
    expect(green[1]).toBeGreaterThan(green[0] + 0.4);
    expect(green[1]).toBeGreaterThan(green[2]);
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(blue[2]).toBeGreaterThan(blue[1]);
    expect(yellow[0]).toBeGreaterThan(0.8);
    expect(yellow[1]).toBeGreaterThan(0.7);
    expect(yellow[2]).toBeLessThan(0.3);
  });

  it('reserves red for the mistake cutout', () => {
    const red = coachErrorColor();
    expect(red[0]).toBeGreaterThan(0.9);
    expect(red[1]).toBeLessThan(0.2);
    expect(red[2]).toBeLessThan(0.2);
    for (let index = 0; index < 5; index++) {
      const tint = coachGhostColor(index);
      expect(tint[0] > 0.9 && tint[1] < 0.2 && tint[2] < 0.2).toBe(false);
    }
  });

  it('marks each source square once, and leaves the mistake piece to red', () => {
    expect(
      coachSourceMarks(
        [
          { from: 'e2' },
          { from: 'e7' },
          { from: 'e2' },
        ],
        'e4'
      )
    ).toEqual([
      { square: 'e2', index: 0 },
      { square: 'e7', index: 1 },
    ]);
    expect(coachSourceMarks([{ from: 'e4' }, { from: 'd7' }], 'e4')).toEqual([{ square: 'd7', index: 1 }]);
  });

  it('does not keep a cutout on a piece that has moved since the line was drawn', () => {
    const steps = [
      { from: 'b1', role: 'knight', color: 'white' },
      { from: 'c3', role: 'knight', color: 'white' },
    ];
    const before = (square: string) => (square === 'b1' ? { role: 'knight', color: 'white' } : null);
    const pinned = new Set(coachPinnedSquares(steps, null, before));
    expect([...pinned]).toEqual(['b1']);
    const after = (square: string) => (square === 'c3' ? { role: 'knight', color: 'white' } : null);
    expect(coachStableMarks(steps, null, pinned, after)).toEqual([]);
  });

  it('drops a cutout whose piece has already left the square', () => {
    expect(
      coachPieceMarks(
        [
          { from: 'c1' },
          { from: 'e4' },
          { from: 'f2' },
        ],
        null,
        new Set(['c1', 'f2'])
      )
    ).toEqual([
      { square: 'c1', index: 0 },
      { square: 'f2', index: 2 },
    ]);
  });

  it('pulls the mask toward the camera so the visible shell wins the depth test', () => {
    const moved = coachMaskPosition([0, 0, 0], [0, 0, -1], 0.005);
    expect(moved[2]).toBeCloseTo(-0.005);
    expect(moved[0]).toBeCloseTo(0);
    expect(moved[1]).toBeCloseTo(0);
  });

});

describe('training query', () => {
  it('keeps chess=train as learn and chess=training as training', () => {
    expect(parseChessDemoQuery('chess=train').mode).toBe('learn');
    expect(parseChessDemoQuery('chess=training').mode).toBe('training');
  });
});
