/**
 * @file chessSceneExtension.ts
 * @description SceneDD extension `@naanouff/w3dts-chess` (match config payload).
 *
 * Minimal handler shape (local) to avoid chess ↔ scenedd cycles — same pattern as navmesh.
 */

import type { World } from '@naanouff/w3dts-core';

export const W3DTS_CHESS_EXTENSION_ID = '@naanouff/w3dts-chess';

export interface ChessSceneExtensionPayload {
  /** Starting FEN (optional; default standard start). */
  fen?: string;
  /** Play mode hint for host HUD / systems. */
  mode?: 'hotseat' | 'cpu' | 'p2p' | 'learn';
  /** Board entity SceneDD id (optional). */
  boardEntityId?: string;
}

export type ChessSceneExtensionHandler = {
  id: string;
  serialize?: (ctx: { world: World }) => unknown;
  deserialize?: (
    payload: unknown,
    ctx: { params: { world: World; scene?: { entityId?: number | null } } }
  ) => void;
};

/**
 * Stores chess match authoring on the scene descriptor. Runtime systems (future)
 * read `descriptor.extensions[W3DTS_CHESS_EXTENSION_ID]` after load.
 */
export function createChessSceneExtensionHandler(): ChessSceneExtensionHandler {
  return {
    id: W3DTS_CHESS_EXTENSION_ID,
    serialize() {
      return undefined;
    },
    deserialize() {
      // Payload remains on descriptor.extensions for host systems to consume.
    },
  };
}
