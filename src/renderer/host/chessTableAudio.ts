/**
 * @file chessTableAudio.ts
 * @description Synthesized tabletop clips for ChessDemoProject (CHESS-B6e).
 * Replaceable later by CC0 files under /audio/chess/ — no throw if decode fails.
 */

import type { WebAudioService } from '@naanouff/w3dts-audio';
import type { ChessTableSfxId } from '../../chess';

const SAMPLE_RATE = 22050;

function encodePcmWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function envelope(i: number, n: number, attack: number, release: number): number {
  const a = Math.min(1, i / Math.max(1, attack));
  const r = Math.min(1, (n - 1 - i) / Math.max(1, release));
  return Math.min(a, r);
}

function woodHit(freq: number, seconds: number, noise = 0.35): Float32Array {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  let brown = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    brown = (brown + (Math.random() * 2 - 1) * 0.08) * 0.96;
    const click = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 18);
    const env = envelope(i, n, 8, n * 0.5);
    out[i] = (click * 0.7 + brown * noise) * env;
  }
  return out;
}

function chime(freqs: readonly number[], seconds: number): Float32Array {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (let k = 0; k < freqs.length; k++) {
      s += Math.sin(2 * Math.PI * freqs[k]! * t) * Math.exp(-t * (3 + k));
    }
    out[i] = (s / freqs.length) * envelope(i, n, 40, n * 0.35);
  }
  return out;
}

function brownNoise(seconds: number): Float32Array {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  let brown = 0;
  for (let i = 0; i < n; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.02) * 0.995;
    out[i] = brown * 0.15 * envelope(i, n, 200, 200);
  }
  return out;
}

const CLIP_BUILDERS: Record<ChessTableSfxId | 'ambience', () => Float32Array> = {
  drop: () => woodHit(620, 0.09, 0.25),
  capture: () => woodHit(280, 0.16, 0.45),
  check: () => chime([880, 1174], 0.22),
  win: () => chime([523, 659, 784], 0.7),
  lose: () => chime([392, 311], 0.55),
  ambience: () => brownNoise(4),
};

export async function installChessTableClips(audio: WebAudioService): Promise<void> {
  for (const [id, build] of Object.entries(CLIP_BUILDERS)) {
    try {
      const wav = encodePcmWav(build(), SAMPLE_RATE);
      const buffer = await audio.decodeArrayBuffer(wav);
      audio.setClip(id, buffer);
    } catch {
      /* suspended / missing AudioContext — skip */
    }
  }
}

/**
 * Scales a clip gain by a 0–100 preference.
 * @param base - Authored gain.
 * @param percent - Player setting.
 */
export function chessMixVolume(base: number, percent: number): number {
  const scale = Math.min(100, Math.max(0, percent)) / 100;
  return base * scale;
}

let sfxPercent = 80;
let ambiencePercent = 40;

/** Remembers the shell sliders. The next clip uses them. */
export function setChessAudioLevels(sfx: number, ambience: number): void {
  sfxPercent = Math.min(100, Math.max(0, sfx));
  ambiencePercent = Math.min(100, Math.max(0, ambience));
}

export function chessSfxGain(id: ChessTableSfxId): number {
  return chessMixVolume(CHESS_SFX_VOLUME[id], sfxPercent);
}

export function chessAmbienceGain(): number {
  return chessMixVolume(CHESS_AMBIENCE_VOLUME, ambiencePercent);
}

export const CHESS_AMBIENCE_VOLUME = 0.045;
export const CHESS_SFX_VOLUME: Record<ChessTableSfxId, number> = {
  drop: 0.55,
  capture: 0.7,
  check: 0.4,
  win: 0.55,
  lose: 0.5,
};
