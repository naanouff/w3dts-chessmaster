/**
 * @file chessWire.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-27
 * @description Move / reset / sync messages for CHESS-B2 (FEN + from/to, not piece transforms).
 */

import { parseFen } from 'chessops/fen';
import type { ChessSquareName } from '../rules/chessTypes';

export type ChessWireMessage =
  | { v: 1; t: 'move'; from: ChessSquareName; to: ChessSquareName; fen: string }
  | { v: 1; t: 'reset'; fen: string }
  | { v: 1; t: 'sync'; fen: string };

export type ChessFenSyncDecision = 'apply' | 'ignore' | 'reply';

function isSquareName(value: unknown): value is ChessSquareName {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}

export function encodeChessWire(message: ChessWireMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function decodeChessWire(bytes: Uint8Array): ChessWireMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 1 || typeof rec.fen !== 'string') return null;
  if (rec.t === 'reset' || rec.t === 'sync') return { v: 1, t: rec.t, fen: rec.fen };
  if (rec.t === 'move' && isSquareName(rec.from) && isSquareName(rec.to)) {
    return { v: 1, t: 'move', from: rec.from, to: rec.to, fen: rec.fen };
  }
  return null;
}

/**
 * Half-move index from a FEN (0 at start, 1 after White's first move, …).
 * Returns null when the string is not a parseable FEN.
 */
export function chessPlyFromFen(fen: string): number | null {
  const setup = parseFen(fen);
  if (setup.isErr) return null;
  const fullmoves = setup.value.fullmoves;
  if (!Number.isFinite(fullmoves) || fullmoves < 1) return null;
  return (fullmoves - 1) * 2 + (setup.value.turn === 'black' ? 1 : 0);
}

/**
 * Late-joiner handshake: apply a more advanced FEN, reply if we are ahead, ignore ties.
 * Explicit `{ t: 'reset' }` still force-applies and is not routed through this helper.
 */
export function decideChessFenSync(localFen: string, remoteFen: string): ChessFenSyncDecision {
  const remotePly = chessPlyFromFen(remoteFen);
  if (remotePly === null) return 'ignore';
  const localPly = chessPlyFromFen(localFen);
  if (localPly === null) return 'apply';
  if (remotePly > localPly) return 'apply';
  if (remotePly < localPly) return 'reply';
  return 'ignore';
}
