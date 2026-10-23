/**
 * @file chessMatch.test.ts
 * @project w3dts
 * @description Legal-move and FEN tests for ChessMatch.
 */

import { describe, expect, it } from 'vitest';
import { ChessMatch } from '../src/chess/index';

describe('ChessMatch', () => {
  it('starts from the standard FEN', () => {
    const match = ChessMatch.starting();
    expect(match.fen().startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')).toBe(true);
    expect(match.sideToMove()).toBe('white');
    expect(match.pieces()).toHaveLength(32);
  });

  it('allows pawn and knight developing moves', () => {
    const match = ChessMatch.starting();
    expect(match.legalSquares('e2')).toEqual(expect.arrayContaining(['e3', 'e4']));
    expect(match.tryMove('e2', 'e4').ok).toBe(true);
    expect(match.sideToMove()).toBe('black');
    expect(match.tryMove('g8', 'f6').ok).toBe(true);
  });

  it('rejects self-check and illegal slides', () => {
    const match = ChessMatch.starting();
    expect(match.tryMove('e1', 'e2').ok).toBe(false);
    expect(match.tryMove('a1', 'a8').ok).toBe(false);
  });

  it('captures and round-trips FEN', () => {
    const match = ChessMatch.starting();
    match.tryMove('e2', 'e4');
    match.tryMove('d7', 'd5');
    const cap = match.tryMove('e4', 'd5');
    expect(cap.ok).toBe(true);
    if (cap.ok) expect(cap.capturedSquare).toBe('d5');
    const restored = ChessMatch.fromFen(match.fen());
    expect(restored.fen()).toBe(match.fen());
    expect(restored.pieceAt('d5')?.color).toBe('white');
  });

  it('castles when rights and path are clear', () => {
    const match = ChessMatch.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(match.legalSquares('e1')).toEqual(expect.arrayContaining(['g1', 'c1']));
    const kingside = match.tryMove('e1', 'g1');
    expect(kingside.ok).toBe(true);
    if (kingside.ok) {
      expect(kingside.castle).toEqual({ rookFrom: 'h1', rookTo: 'f1' });
    }
    expect(match.pieceAt('g1')?.role).toBe('king');
    expect(match.pieceAt('f1')?.role).toBe('rook');
  });

  it('normalizes king-to-rook castling so the rook is not captured', () => {
    // chessops accepts e8→h8 as O-O (960-style). The host must land on g8 and move the rook.
    const black = ChessMatch.fromFen('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
    expect(black.legalSquares('e8')).toEqual(expect.arrayContaining(['g8', 'c8']));
    expect(black.legalSquares('e8')).not.toContain('h8');
    expect(black.legalSquares('e8')).not.toContain('a8');
    const byRook = black.tryMove('e8', 'h8');
    expect(byRook.ok).toBe(true);
    if (byRook.ok) {
      expect(byRook.to).toBe('g8');
      expect(byRook.capturedSquare).toBeNull();
      expect(byRook.castle).toEqual({ rookFrom: 'h8', rookTo: 'f8' });
      expect(byRook.san.replace(/[+#]$/, '')).toBe('O-O');
    }
    expect(black.pieceAt('g8')?.role).toBe('king');
    expect(black.pieceAt('f8')?.role).toBe('rook');
    expect(black.pieceAt('h8')).toBeNull();

    const white = ChessMatch.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const whiteByRook = white.tryMove('e1', 'h1');
    expect(whiteByRook.ok).toBe(true);
    if (whiteByRook.ok) {
      expect(whiteByRook.to).toBe('g1');
      expect(whiteByRook.capturedSquare).toBeNull();
      expect(whiteByRook.castle).toEqual({ rookFrom: 'h1', rookTo: 'f1' });
    }
  });

  it('auto-promotes pawns to queen', () => {
    const match = ChessMatch.fromFen('8/P7/8/8/8/8/8/4K2k w - - 0 1');
    const r = match.tryMove('a7', 'a8');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.promotion).toBe('queen');
    expect(match.pieceAt('a8')?.role).toBe('queen');
  });

  it('lists legal moves for the side to move', () => {
    const match = ChessMatch.starting();
    const moves = match.legalMoves();
    expect(moves.length).toBe(20);
    expect(moves).toEqual(
      expect.arrayContaining([
        { from: 'e2', to: 'e4' },
        { from: 'g1', to: 'f3' },
      ])
    );
  });

  it('loadFen replaces the position or rejects garbage', () => {
    const match = ChessMatch.starting();
    match.tryMove('e2', 'e4');
    expect(match.loadFen('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1')).toBe(true);
    expect(match.pieceAt('f7')?.role).toBe('queen');
    expect(match.loadFen('not-a-fen')).toBe(false);
    expect(match.pieceAt('f7')?.role).toBe('queen');
  });

  it('resolves SAN to from/to on the current position', () => {
    const match = ChessMatch.starting();
    expect(match.moveFromSan('e4')).toEqual({ from: 'e2', to: 'e4' });
    match.tryMove('e2', 'e4');
    expect(match.moveFromSan('e5')).toEqual({ from: 'e7', to: 'e5' });
  });

  it('detects insufficient material as an end without mate or stalemate', () => {
    const match = ChessMatch.fromFen('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
    expect(match.isInsufficientMaterial()).toBe(true);
    expect(match.isEnd()).toBe(true);
    expect(match.isCheckmate()).toBe(false);
    expect(match.isStalemate()).toBe(false);
    expect(ChessMatch.starting().isInsufficientMaterial()).toBe(false);
  });
});
