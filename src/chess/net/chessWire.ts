/**
 * @file chessWire.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-27
 * @description Move / reset / sync messages for CHESS-B2 (FEN + from/to, not piece transforms).
 */

import { parseFen } from 'chessops/fen';
import type { ChessColor, ChessSquareName } from '../rules/chessTypes';

export type ChessWireClocks = { whiteSeconds: number; blackSeconds: number };

export type ChessWireMessage =
  | ({ v: 1; t: 'move'; from: ChessSquareName; to: ChessSquareName; fen: string } & Partial<ChessWireClocks>)
  | { v: 1; t: 'reset'; fen: string }
  | ({ v: 1; t: 'sync'; fen: string } & Partial<ChessWireClocks>)
  | { v: 1; t: 'restore'; fen: string; whiteSeconds: number; blackSeconds: number }
  | {
      v: 1;
      t: 'hello';
      host: boolean;
      color: ChessColor;
      fen: string;
      whiteSeconds: number;
      blackSeconds: number;
    }
  | { v: 1; t: 'resign'; loser: ChessColor }
  | { v: 1; t: 'draw-offer' }
  | { v: 1; t: 'draw-accept' }
  | { v: 1; t: 'draw-refuse' };

export type ChessFenSyncDecision = 'apply' | 'ignore' | 'reply';

/** What a received hello means for the local seat. Host color wins. */
export type OnlineHelloDecision =
  | { kind: 'adopt'; localColor: ChessColor }
  | { kind: 'ready' }
  | { kind: 'refuse' }
  | { kind: 'ignore' };

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
  if (rec.v !== 1) return null;
  if (rec.t === 'resign' && isColor(rec.loser)) return { v: 1, t: 'resign', loser: rec.loser };
  if (rec.t === 'draw-offer') return { v: 1, t: 'draw-offer' };
  if (rec.t === 'draw-accept') return { v: 1, t: 'draw-accept' };
  if (rec.t === 'draw-refuse') return { v: 1, t: 'draw-refuse' };
  if (typeof rec.fen !== 'string') return null;
  const clocks = wireClocks(rec.whiteSeconds, rec.blackSeconds);
  if (clocks === null) return null;
  if (rec.t === 'reset') return { v: 1, t: 'reset', fen: rec.fen };
  if (rec.t === 'sync') return { v: 1, t: 'sync', fen: rec.fen, ...clocks };
  if (rec.t === 'hello' && typeof rec.host === 'boolean' && isColor(rec.color) && hasClocks(clocks)) {
    return { v: 1, t: 'hello', host: rec.host, color: rec.color, fen: rec.fen, ...clocks };
  }
  if (
    rec.t === 'restore' &&
    typeof rec.whiteSeconds === 'number' &&
    typeof rec.blackSeconds === 'number' &&
    Number.isFinite(rec.whiteSeconds) &&
    Number.isFinite(rec.blackSeconds)
  ) {
    return {
      v: 1,
      t: 'restore',
      fen: rec.fen,
      whiteSeconds: rec.whiteSeconds,
      blackSeconds: rec.blackSeconds,
    };
  }
  if (rec.t === 'move' && isSquareName(rec.from) && isSquareName(rec.to)) {
    return { v: 1, t: 'move', from: rec.from, to: rec.to, fen: rec.fen, ...clocks };
  }
  return null;
}

function isColor(value: unknown): value is ChessColor {
  return value === 'white' || value === 'black';
}

function hasClocks(clocks: ChessWireClocks | Record<string, never>): clocks is ChessWireClocks {
  return 'whiteSeconds' in clocks;
}

function wireClocks(
  white: unknown,
  black: unknown
): ChessWireClocks | Record<string, never> | null {
  const present = typeof white === 'number' || typeof black === 'number';
  if (!present) return {};
  if (typeof white !== 'number' || typeof black !== 'number') return null;
  if (!Number.isFinite(white) || !Number.isFinite(black)) return null;
  return { whiteSeconds: white, blackSeconds: black };
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

/**
 * Seat agreement for an online table. The host color wins. Two hosts refuse.
 * A guest hello does not change the host. A guest ignores another guest.
 * @param localSeat - Seat chosen when this window created or joined the table.
 * @param remoteHost - True when the other window created the table.
 * @param remoteColor - Color announced by a host hello.
 */
export function decideOnlineHello(
  localSeat: 'host' | 'guest',
  remoteHost: boolean,
  remoteColor: ChessColor
): OnlineHelloDecision {
  if (localSeat === 'host' && remoteHost) return { kind: 'refuse' };
  if (remoteHost) return { kind: 'adopt', localColor: remoteColor === 'white' ? 'black' : 'white' };
  if (localSeat === 'host') return { kind: 'ready' };
  return { kind: 'ignore' };
}
