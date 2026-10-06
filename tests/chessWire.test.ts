/**
 * @file chessWire.test.ts
 * @description CHESS-B2 wire codec (FEN + from/to).
 */

import { describe, expect, it } from 'vitest';
import {
  ChessMatch,
  chessPlyFromFen,
  decideChessFenSync,
  chessRelayUrl,
  CHESS_RELAY_PRODUCTION_URL,
  decideOnlineHello,
  decodeChessWire,
  encodeChessWire,
  guestWaitExpired,
  ONLINE_GUEST_WAIT_MS,
  parseChessDemoQuery,
  formatChessClock,
} from '../src/chess/index';

describe('chess wire + demo query', () => {
  it('round-trips a move message', () => {
    const msg = { v: 1 as const, t: 'move' as const, from: 'e2' as const, to: 'e4' as const, fen: 'x' };
    expect(decodeChessWire(encodeChessWire(msg))).toEqual(msg);
  });

  it('round-trips a sync message', () => {
    const msg = { v: 1 as const, t: 'sync' as const, fen: 'start' };
    expect(decodeChessWire(encodeChessWire(msg))).toEqual(msg);
  });

  it('round-trips a hello and a move that carries both clocks', () => {
    const hello = {
      v: 1 as const,
      t: 'hello' as const,
      host: true,
      color: 'black' as const,
      fen: 'saved',
      whiteSeconds: 500,
      blackSeconds: 480,
    };
    expect(decodeChessWire(encodeChessWire(hello))).toEqual(hello);
    const move = {
      v: 1 as const,
      t: 'move' as const,
      from: 'e2' as const,
      to: 'e4' as const,
      fen: 'after',
      whiteSeconds: 590,
      blackSeconds: 600,
    };
    expect(decodeChessWire(encodeChessWire(move))).toEqual(move);
    const sync = {
      v: 1 as const,
      t: 'sync' as const,
      fen: 'after',
      whiteSeconds: 590,
      blackSeconds: 600,
    };
    expect(decodeChessWire(encodeChessWire(sync))).toEqual(sync);
  });

  it('lets the host color win and refuses two hosts', () => {
    expect(decideOnlineHello('guest', true, 'white')).toEqual({ kind: 'adopt', localColor: 'black' });
    expect(decideOnlineHello('guest', true, 'black')).toEqual({ kind: 'adopt', localColor: 'white' });
    expect(decideOnlineHello('host', false, 'white')).toEqual({ kind: 'ready' });
    expect(decideOnlineHello('host', true, 'white')).toEqual({ kind: 'refuse' });
    expect(decideOnlineHello('guest', false, 'black')).toEqual({ kind: 'ignore' });
  });

  it('uses the published relay unless the build overrides it', () => {
    expect(chessRelayUrl(undefined)).toBe(CHESS_RELAY_PRODUCTION_URL);
    expect(chessRelayUrl('  ws://127.0.0.1:4471  ')).toBe('ws://127.0.0.1:4471');
    expect(chessRelayUrl('')).toBe(CHESS_RELAY_PRODUCTION_URL);
    expect(guestWaitExpired(0, ONLINE_GUEST_WAIT_MS - 1)).toBe(false);
    expect(guestWaitExpired(0, ONLINE_GUEST_WAIT_MS)).toBe(true);
  });

  it('accepts a restore with both clocks and still accepts a sync without clocks', () => {
    const restore = {
      v: 1 as const,
      t: 'restore' as const,
      fen: 'saved',
      whiteSeconds: 180,
      blackSeconds: 240,
    };
    expect(decodeChessWire(encodeChessWire(restore))).toEqual(restore);
    const sync = new TextEncoder().encode(JSON.stringify({ v: 1, t: 'sync', fen: 'saved' }));
    expect(decodeChessWire(sync)).toEqual({ v: 1, t: 'sync', fen: 'saved' });
  });

  it('rejects garbage', () => {
    expect(decodeChessWire(new TextEncoder().encode('{"t":"nope"}'))).toBeNull();
    expect(decodeChessWire(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('counts half-moves from FEN and picks the more advanced board on sync', () => {
    const startMatch = ChessMatch.starting();
    const start = startMatch.fen();
    expect(startMatch.tryMove('e2', 'e4').ok).toBe(true);
    const e4 = startMatch.fen();
    expect(chessPlyFromFen(start)).toBe(0);
    expect(chessPlyFromFen(e4)).toBe(1);
    expect(chessPlyFromFen('not-a-fen')).toBeNull();
    expect(decideChessFenSync(start, e4)).toBe('apply');
    expect(decideChessFenSync(e4, start)).toBe('reply');
    expect(decideChessFenSync(e4, e4)).toBe('ignore');
  });

  it('parses chess=cpu by default and p2p black', () => {
    expect(parseChessDemoQuery('')).toEqual({ mode: 'cpu', localColor: 'white', quiz: false });
    expect(parseChessDemoQuery('chess=hotseat')).toEqual({
      mode: 'hotseat',
      localColor: 'white',
      quiz: false,
    });
    expect(parseChessDemoQuery('?chess=p2p&chessColor=black')).toEqual({
      mode: 'p2p',
      localColor: 'black',
      quiz: false,
    });
  });

  it('formats clocks as m:ss', () => {
    expect(formatChessClock(600)).toBe('10:00');
    expect(formatChessClock(9.2)).toBe('0:10');
    expect(formatChessClock(0)).toBe('0:00');
  });
});
