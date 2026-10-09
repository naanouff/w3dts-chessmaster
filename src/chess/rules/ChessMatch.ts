/**
 * @file ChessMatch.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Legal chess match wrapper around chessops (FEN, dests, SAN, auto-queen).
 */

import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { makeSquare, parseSquare } from 'chessops/util';
import type { NormalMove, Piece, Role, Square } from 'chessops';
import type {
  ChessCastleDelta,
  ChessColor,
  ChessMoveResult,
  ChessPieceOnSquare,
  ChessPieceRole,
  ChessSquareName,
} from './chessTypes';

function isSquareName(value: string): value is ChessSquareName {
  return /^[a-h][1-8]$/.test(value);
}

function asSquareName(square: Square): ChessSquareName {
  const name = makeSquare(square);
  if (!isSquareName(name)) {
    throw new Error(`ChessMatch: unexpected square encoding ${square}`);
  }
  return name;
}

function roleOf(role: Role): ChessPieceRole {
  return role;
}

function pieceOn(piece: Piece, square: Square): ChessPieceOnSquare {
  return {
    square: asSquareName(square),
    role: roleOf(piece.role),
    color: piece.color,
  };
}

function castleRookDelta(from: Square, to: Square, color: ChessColor): ChessCastleDelta | null {
  const fromFile = from & 7;
  const toFile = to & 7;
  if (Math.abs(toFile - fromFile) !== 2) return null;
  const rankChar = color === 'white' ? '1' : '8';
  if (toFile > fromFile) {
    return {
      rookFrom: `h${rankChar}` as ChessSquareName,
      rookTo: `f${rankChar}` as ChessSquareName,
    };
  }
  return { rookFrom: `a${rankChar}` as ChessSquareName, rookTo: `d${rankChar}` as ChessSquareName };
}

function capturedSquareBeforePlay(pos: Chess, to: Square, piece: Piece): ChessSquareName | null {
  if (pos.board.get(to)) return asSquareName(to);
  if (piece.role !== 'pawn' || pos.epSquare === undefined || pos.epSquare !== to) return null;
  const cap = piece.color === 'white' ? to - 8 : to + 8;
  return asSquareName(cap);
}

function buildLegalMove(
  pos: Chess,
  fromName: ChessSquareName,
  toName: ChessSquareName
): NormalMove | null {
  const from = parseSquare(fromName);
  const to = parseSquare(toName);
  if (from === undefined || to === undefined) return null;
  const piece = pos.board.get(from);
  if (!piece || piece.color !== pos.turn) return null;
  const move: NormalMove = { from, to };
  const toRank = to >> 3;
  if (piece.role === 'pawn' && (toRank === 0 || toRank === 7)) {
    move.promotion = 'queen';
  }
  if (!pos.isLegal(move)) return null;
  return move;
}

/**
 * Mutable legal-chess game. Does not know about meshes or physics.
 */
export class ChessMatch {
  private position: Chess;

  private constructor(position: Chess) {
    this.position = position;
  }

  public static starting(): ChessMatch {
    return new ChessMatch(Chess.default());
  }

  public static fromFen(fen: string): ChessMatch {
    const setup = parseFen(fen);
    if (setup.isErr) {
      throw new Error(`ChessMatch.fromFen: invalid FEN (${fen})`);
    }
    const pos = Chess.fromSetup(setup.value);
    if (pos.isErr) {
      throw new Error(`ChessMatch.fromFen: illegal setup (${fen})`);
    }
    return new ChessMatch(pos.value);
  }

  public fen(): string {
    return makeFen(this.position.toSetup());
  }

  public sideToMove(): ChessColor {
    return this.position.turn;
  }

  public isCheck(): boolean {
    return this.position.isCheck();
  }

  public isCheckmate(): boolean {
    return this.position.isCheckmate();
  }

  public isStalemate(): boolean {
    return this.position.isStalemate();
  }

  /** True when neither side can force mate with the remaining material. */
  public isInsufficientMaterial(): boolean {
    return this.position.isInsufficientMaterial();
  }

  public isEnd(): boolean {
    return this.position.isEnd();
  }

  public pieceAt(square: ChessSquareName): ChessPieceOnSquare | null {
    const sq = parseSquare(square);
    if (sq === undefined) return null;
    const piece = this.position.board.get(sq);
    return piece ? pieceOn(piece, sq) : null;
  }

  public pieces(): ChessPieceOnSquare[] {
    const out: ChessPieceOnSquare[] = [];
    for (const [square, piece] of this.position.board) {
      out.push(pieceOn(piece, square));
    }
    return out;
  }

  public legalSquares(from: ChessSquareName): ChessSquareName[] {
    const sq = parseSquare(from);
    if (sq === undefined) return [];
    const piece = this.position.board.get(sq);
    if (!piece || piece.color !== this.position.turn) return [];
    const names = new Set<ChessSquareName>();
    for (const to of this.position.dests(sq)) {
      names.add(asSquareName(to));
    }
    if (piece.role === 'king') {
      const rank = piece.color === 'white' ? '1' : '8';
      for (const file of ['c', 'g'] as const) {
        const name = `${file}${rank}`;
        if (!isSquareName(name)) continue;
        const to = parseSquare(name);
        if (to !== undefined && this.position.isLegal({ from: sq, to })) names.add(name);
      }
    }
    return [...names];
  }

  /** All legal destinations for the side to move (auto-queen promotions included). */
  public legalMoves(): Array<{ from: ChessSquareName; to: ChessSquareName }> {
    const turn = this.sideToMove();
    const out: Array<{ from: ChessSquareName; to: ChessSquareName }> = [];
    for (const piece of this.pieces()) {
      if (piece.color !== turn) continue;
      for (const to of this.legalSquares(piece.square)) {
        out.push({ from: piece.square, to });
      }
    }
    return out;
  }

  public tryMove(from: ChessSquareName, to: ChessSquareName): ChessMoveResult {
    if (!isSquareName(from) || !isSquareName(to)) {
      return { ok: false, reason: 'invalid-square' };
    }
    if (this.position.isEnd()) {
      return { ok: false, reason: 'game-over' };
    }
    const move = buildLegalMove(this.position, from, to);
    if (!move) {
      return { ok: false, reason: 'illegal' };
    }
    const fromSq = move.from;
    const toSq = move.to;
    const piece = this.position.board.get(fromSq);
    if (!piece) {
      return { ok: false, reason: 'illegal' };
    }
    const capturedSquare = capturedSquareBeforePlay(this.position, toSq, piece);
    const castle = piece.role === 'king' ? castleRookDelta(fromSq, toSq, piece.color) : null;
    const promotion = move.promotion ? roleOf(move.promotion) : null;
    const san = makeSan(this.position, move);
    this.position.play(move);
    return {
      ok: true,
      from,
      to,
      san,
      capturedSquare,
      castle,
      promotion,
    };
  }

  public reset(): void {
    this.position = Chess.default();
  }

  /** Replace the position from FEN. Returns false if the string is not a legal setup. */
  public loadFen(fen: string): boolean {
    const setup = parseFen(fen);
    if (setup.isErr) return false;
    const pos = Chess.fromSetup(setup.value);
    if (pos.isErr) return false;
    this.position = pos.value;
    return true;
  }

  /**
   * Resolve a SAN string against the current position (auto-queen promotions).
   * `+` / `#` suffixes are ignored.
   */
  public moveFromSan(san: string): { from: ChessSquareName; to: ChessSquareName } | null {
    const normalized = san.trim().replace(/[+#]$/, '');
    if (!normalized) return null;
    const fen = this.fen();
    for (const move of this.legalMoves()) {
      const child = ChessMatch.fromFen(fen);
      const result = child.tryMove(move.from, move.to);
      if (!result.ok) continue;
      if (result.san.replace(/[+#]$/, '') === normalized) return move;
    }
    return null;
  }
}
