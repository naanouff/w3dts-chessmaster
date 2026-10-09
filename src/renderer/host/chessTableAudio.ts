/**
 * @file chessTableAudio.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Tabletop clips and layered ambience beds (CHESS-B25).
 * Loads Asset Store WAVs from `/audio/chess/`; falls back to synths if decode fails.
 */

import type { AudioPlayHandle, WebAudioService } from '@naanouff/w3dts-audio';
import {
  chessAudioTensionStep,
  type ChessAudioBedGains,
  type ChessAudioTensionBand,
  type ChessTableSfxId,
} from '../../chess';
import type { ChessAmbianceId } from './chessAmbiance';
import { chessTableClipUrl } from './chessAudioClips';

const SAMPLE_RATE = 22050;

type BedLayer = 'calm' | 'edge' | 'pressure' | 'music' | 'musicEdge' | 'musicPressure';

const BED_CLIP: Record<
  BedLayer,
  'bed-calm' | 'bed-edge' | 'bed-pressure' | 'bed-music' | 'bed-music-edge' | 'bed-music-pressure'
> = {
  calm: 'bed-calm',
  edge: 'bed-edge',
  pressure: 'bed-pressure',
  music: 'bed-music',
  musicEdge: 'bed-music-edge',
  musicPressure: 'bed-music-pressure',
};

const BED_LAYERS: readonly BedLayer[] = [
  'calm',
  'edge',
  'pressure',
  'music',
  'musicEdge',
  'musicPressure',
];

const DEFAULT_GAINS: ChessAudioBedGains = {
  calm: 0.5,
  edge: 0,
  pressure: 0,
  music: 1.1,
  musicEdge: 0,
  musicPressure: 0,
};

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

const SYNTH: Record<ChessTableSfxId | 'ambience', () => Float32Array> = {
  drop: () => woodHit(620, 0.09, 0.25),
  capture: () => woodHit(280, 0.16, 0.45),
  check: () => chime([880, 1174], 0.22),
  win: () => chime([523, 659, 784], 0.7),
  lose: () => chime([392, 311], 0.55),
  ambience: () => brownNoise(4),
};

async function installSynthClip(audio: WebAudioService, id: string, build: () => Float32Array): Promise<void> {
  try {
    const wav = encodePcmWav(build(), SAMPLE_RATE);
    const buffer = await audio.decodeArrayBuffer(wav);
    audio.setClip(id, buffer);
  } catch {
    /* suspended / missing AudioContext — skip */
  }
}

async function installUrlClip(audio: WebAudioService, id: string, url: string): Promise<boolean> {
  try {
    await audio.preloadClip(id, url);
    return Boolean(audio.getClip(id));
  } catch {
    return false;
  }
}

/**
 * Loads room hits, shared state cues, and bed layers. Synths fill any missing file.
 * @param audio - Web Audio service.
 * @param ambiance - Active room for material hits and calm bed.
 */
export async function installChessTableClips(
  audio: WebAudioService,
  ambiance: ChessAmbianceId = 'atelier'
): Promise<void> {
  const sfxIds: ChessTableSfxId[] = ['drop', 'capture', 'check', 'win', 'lose'];
  for (const id of sfxIds) {
    const ok = await installUrlClip(audio, id, chessTableClipUrl(id, ambiance));
    if (!ok) await installSynthClip(audio, id, SYNTH[id]);
  }

  for (const layer of BED_LAYERS) {
    const clipId = BED_CLIP[layer];
    const ok = await installUrlClip(audio, clipId, chessTableClipUrl(clipId, ambiance));
    if (!ok && layer === 'calm') {
      await installSynthClip(audio, clipId, SYNTH.ambience);
    }
  }

  /* Legacy id kept for older call sites that still ask for `ambience`. */
  const calm = audio.getClip('bed-calm');
  if (calm) audio.setClip('ambience', calm);
  else await installSynthClip(audio, 'ambience', SYNTH.ambience);
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
  activeBeds?.applyMaster();
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

/**
 * Three looped beds with tension gains. Restarts voices when the band changes
 * (WebAudioService has no per-voice gain).
 */
export class ChessAmbienceBeds {
  private audio: WebAudioService | null = null;
  private handles: Partial<Record<BedLayer, AudioPlayHandle>> = {};
  private band: ChessAudioTensionBand = 'calm';
  private gains: ChessAudioBedGains = { ...DEFAULT_GAINS };
  private running = false;

  /** Starts calm (and any non-zero layers) after clips are installed. */
  start(audio: WebAudioService): void {
    this.stop();
    this.audio = audio;
    this.running = true;
    this.band = 'calm';
    this.gains = { ...DEFAULT_GAINS };
    this.restartVoices();
  }

  /** Reloads drop/capture/beds for a new room and restarts the bus. */
  async applyAmbiance(audio: WebAudioService, ambiance: ChessAmbianceId): Promise<void> {
    const wasRunning = this.running;
    this.stop();
    await installChessTableClips(audio, ambiance);
    this.audio = audio;
    if (wasRunning) {
      this.running = true;
      this.restartVoices();
    }
  }

  /**
   * Steps tension from a local-centric material score.
   * @param scoreForLocal - Positive when the listener is ahead.
   */
  setTension(scoreForLocal: number): void {
    const next = chessAudioTensionStep(scoreForLocal, this.band);
    if (next.band === this.band) return;
    this.band = next.band;
    this.gains = next.gains;
    if (this.running) this.restartVoices();
  }

  /** Forces calm beds (mate / flag). */
  resetTension(): void {
    this.band = 'calm';
    this.gains = { ...DEFAULT_GAINS };
    if (this.running) this.restartVoices();
  }

  /** Reapplies the ambience master after a Paramètres change. */
  applyMaster(): void {
    if (this.running) this.restartVoices();
  }

  stop(): void {
    for (const handle of Object.values(this.handles)) handle?.stop();
    this.handles = {};
    this.running = false;
  }

  private restartVoices(): void {
    const audio = this.audio;
    if (!audio || !this.running) return;
    for (const handle of Object.values(this.handles)) handle?.stop();
    this.handles = {};
    const master = chessAmbienceGain();
    if (master <= 0) return;
    for (const layer of BED_LAYERS) {
      const layerGain = this.gains[layer];
      if (layerGain <= 0) continue;
      const clipId = BED_CLIP[layer];
      if (!audio.getClip(clipId)) continue;
      try {
        this.handles[layer] = audio.playOneShot(clipId, {
          loop: true,
          volume: master * layerGain,
        });
      } catch {
        /* clip missing */
      }
    }
  }
}

let activeBeds: ChessAmbienceBeds | null = null;

/** Registers the running bed bus so Paramètres can retarget gains. */
export function bindChessAmbienceBeds(beds: ChessAmbienceBeds | null): void {
  activeBeds = beds;
}
