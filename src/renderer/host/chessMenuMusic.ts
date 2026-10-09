/**
 * @file chessMenuMusic.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Looping shell menu piano, separate from in-match beds.
 */

import { WebAudioService, type AudioPlayHandle } from '@naanouff/w3dts-audio';
import { chessAmbienceGain } from './chessTableAudio';
import { chessTableClipUrl } from './chessAudioClips';

const CLIP_ID = 'menu-music';
/** Layer gain before the ambience master (same bus as table beds). */
const MENU_MUSIC_GAIN = 1.0;

/**
 * Owns a dedicated WebAudioService so the menu can play before a match loads.
 */
export class ChessMenuMusic {
  private audio: WebAudioService | null = null;
  private handle: AudioPlayHandle | null = null;
  private wanted = false;
  private armed = false;
  private loading: Promise<void> | null = null;

  /**
   * Starts or stops the loop for the current shell screen.
   * @param wanted - True on menu screens after the boot splash.
   */
  setWanted(wanted: boolean): void {
    this.wanted = wanted;
    if (!wanted) {
      this.stopVoice();
      return;
    }
    if (this.armed) void this.ensurePlaying();
  }

  /**
   * Resumes the AudioContext after a user gesture and starts if wanted.
   */
  async arm(): Promise<void> {
    this.armed = true;
    if (this.wanted) await this.ensurePlaying();
  }

  /** Rebuilds the voice when the ambience slider changes. */
  applyMaster(): void {
    if (this.wanted && this.armed) void this.ensurePlaying();
  }

  stop(): void {
    this.wanted = false;
    this.stopVoice();
  }

  private stopVoice(): void {
    this.handle?.stop();
    this.handle = null;
  }

  private async ensurePlaying(): Promise<void> {
    if (!this.wanted || !this.armed) return;
    if (this.loading) {
      await this.loading;
      if (this.wanted && this.armed && !this.handle) await this.startVoice();
      return;
    }
    this.loading = this.startVoice();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async startVoice(): Promise<void> {
    if (!this.audio) this.audio = new WebAudioService();
    const audio = this.audio;
    try {
      await audio.resume();
      if (!audio.getClip(CLIP_ID)) {
        await audio.preloadClip(CLIP_ID, chessTableClipUrl('menu-music', 'atelier'));
      }
      if (!audio.getClip(CLIP_ID) || !this.wanted) return;
      this.stopVoice();
      const master = chessAmbienceGain();
      if (master <= 0) return;
      this.handle = audio.playOneShot(CLIP_ID, {
        loop: true,
        volume: master * MENU_MUSIC_GAIN,
      });
    } catch {
      /* suspended / missing decode */
    }
  }
}
