/**
 * @file chessAudioClips.test.ts
 * @description CHESS-B25d: stable URLs under /audio/chess/ by ambiance.
 */

import { describe, expect, it } from 'vitest';
import { chessTableClipUrl } from '../src/renderer/host/chessAudioClips';

describe('chessTableClipUrl', () => {
  it('maps drop and capture to the room material files', () => {
    expect(chessTableClipUrl('drop', 'salon')).toBe('/audio/chess/drop-salon.ogg');
    expect(chessTableClipUrl('capture', 'terrasse')).toBe('/audio/chess/capture-terrasse.ogg');
  });

  it('keeps check win lose shared', () => {
    expect(chessTableClipUrl('check', 'club')).toBe('/audio/chess/check.ogg');
    expect(chessTableClipUrl('win', 'jardin')).toBe('/audio/chess/win.ogg');
    expect(chessTableClipUrl('lose', 'atelier')).toBe('/audio/chess/lose.ogg');
  });

  it('maps calm beds per room and shared tension stems', () => {
    expect(chessTableClipUrl('bed-calm', 'atelier')).toBe('/audio/chess/bed-atelier-calm.ogg');
    expect(chessTableClipUrl('bed-edge', 'salon')).toBe('/audio/chess/bed-edge.ogg');
    expect(chessTableClipUrl('bed-pressure', 'club')).toBe('/audio/chess/bed-pressure.ogg');
  });

  it('maps music stems per room for calm, edge, and pressure', () => {
    expect(chessTableClipUrl('bed-music', 'jardin')).toBe('/audio/chess/bed-jardin-music.ogg');
    expect(chessTableClipUrl('bed-music-edge', 'salon')).toBe(
      '/audio/chess/bed-salon-music-edge.ogg'
    );
    expect(chessTableClipUrl('bed-music-pressure', 'atelier')).toBe(
      '/audio/chess/bed-atelier-music-pressure.ogg'
    );
  });

  it('maps a shared menu music loop', () => {
    expect(chessTableClipUrl('menu-music', 'club')).toBe('/audio/chess/menu-music.ogg');
  });
});
