/**
 * @file heuristicChessEngine.test.ts
 * @description CHESS-B1: in-process CPU picks legal moves and mates in one.
 */

import { describe, expect, it } from 'vitest';
import { ChessMatch, HeuristicChessEngine } from '../src/chess/index';

describe('HeuristicChessEngine', () => {
  it('returns a legal opening move', async () => {
    const engine = new HeuristicChessEngine({ depth: 1, thinkMs: 0 });
    const match = ChessMatch.starting();
    const move = await engine.chooseMove(match.fen());
    expect(move).toBeTruthy();
    if (!move) return;
    expect(match.legalMoves()).toEqual(expect.arrayContaining([move]));
  });

  it('delivers mate in one', async () => {
    const engine = new HeuristicChessEngine({ depth: 1, thinkMs: 0 });
    const fen = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1';
    const move = await engine.chooseMove(fen);
    expect(move).toBeTruthy();
    const match = ChessMatch.fromFen(fen);
    expect(match.tryMove(move!.from, move!.to).ok).toBe(true);
    expect(match.isCheckmate()).toBe(true);
  });

  it('returns null on a finished game', async () => {
    const engine = new HeuristicChessEngine({ depth: 1, thinkMs: 0 });
    const match = ChessMatch.fromFen('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
    match.tryMove('f7', 'h7');
    expect(await engine.chooseMove(match.fen())).toBeNull();
  });
});
