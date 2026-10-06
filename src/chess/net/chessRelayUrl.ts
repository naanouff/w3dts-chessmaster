/**
 * @file chessRelayUrl.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Relay address for an online table. The game bytes stay opaque.
 */

/** Public Railway room for ChessMaster. */
export const CHESS_RELAY_PRODUCTION_URL = 'wss://relay-production-01c1.up.railway.app/v1/chessmaster';

/** How long a guest waits for the host hello before leaving the lobby. */
export const ONLINE_GUEST_WAIT_MS = 8000;

/**
 * Relay the client opens. A set override wins, including a relay on this machine.
 * @param override - `VITE_CHESS_RELAY_URL`, when the build provides one.
 * @returns WebSocket URL, already `wss://` for the published relay.
 */
export function chessRelayUrl(override: string | undefined): string {
  const trimmed = typeof override === 'string' ? override.trim() : '';
  return trimmed.length > 0 ? trimmed : CHESS_RELAY_PRODUCTION_URL;
}

/**
 * True once a guest has waited long enough without a host hello.
 * @param startedAtMs - Time the guest opened the socket.
 * @param nowMs - Time of the check.
 */
export function guestWaitExpired(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs >= ONLINE_GUEST_WAIT_MS;
}
