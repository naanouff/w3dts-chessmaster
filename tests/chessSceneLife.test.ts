/**
 * @file chessSceneLife.test.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Review-only hearth flicker, dust shafts and the cigar tip.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { chessSetPunctualLights } from '../src/renderer/host/chessAmbiance';
import {
  CIGAR_LENGTH_M,
  CIGAR_PERIOD_S,
  CIGAR_SMOKE_INTENSITY,
  HEARTH_INTENSITY,
  HEARTH_MOUTH_Z,
  SCENE_LIFE_INTENSITY,
  SCENE_LIFE_PARTICLE_CAP,
  cigarTip,
  hearthFlicker,
  sceneLifeEmitters,
  sceneLifeWanted,
} from '../src/renderer/host/chessSceneLife';

function beam(
  from: readonly [number, number, number],
  to: readonly [number, number, number]
): [number, number, number] {
  const x = to[0] - from[0];
  const y = to[1] - from[1];
  const z = to[2] - from[2];
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

describe('scene life', () => {
  it('keeps the hearth flicker inside a band and never steady', () => {
    const samples = [0, 0.17, 0.41, 0.83, 1.2, 2.4].map((time) => hearthFlicker(time));
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(0.75);
      expect(sample).toBeLessThanOrEqual(1.25);
      expect(sample).not.toBe(0);
    }
    expect(new Set(samples.map((sample) => sample.toFixed(4))).size).toBeGreaterThan(1);
  });

  it('lists salon, atelier and club emitters only while the review life is on', () => {
    expect(sceneLifeEmitters(false, true)).toEqual([]);
    expect(sceneLifeEmitters(true, false)).toEqual([]);
    const live = sceneLifeEmitters(true, true);
    const rooms = new Set(live.map((emitter) => emitter.room));
    expect(rooms).toEqual(new Set(['salon', 'atelier', 'club']));
    expect(live.some((emitter) => emitter.room === 'jardin' || emitter.room === 'terrasse')).toBe(false);
    for (const emitter of live) {
      expect(emitter.graphId === 'fire-realistic' || emitter.graphId === 'smoke-realistic').toBe(true);
      expect(emitter.maxParticles).toBeLessThanOrEqual(SCENE_LIFE_PARTICLE_CAP);
      expect(emitter.maxParticles).toBeGreaterThan(0);
      expect(emitter.intensity).toBeLessThan(1);
    }
    const mouth = chessSetPunctualLights('salon').find((light) => light.kind === 'point');
    expect(mouth).toBeDefined();
    for (const id of ['hearth-fire', 'hearth-smoke']) {
      const hearth = live.find((emitter) => emitter.id === id);
      expect(hearth?.position[2]).toBe(HEARTH_MOUTH_Z);
      expect(hearth!.position[2]).toBeGreaterThan(mouth!.position[2] + 0.3);
      expect(hearth?.intensity).toBe(HEARTH_INTENSITY);
      expect(hearth!.intensity).toBeLessThan(SCENE_LIFE_INTENSITY);
    }
    const cigarSmoke = live.find((emitter) => emitter.id === 'cigar-smoke');
    expect(cigarSmoke?.sprite).toBe('wisp');
    expect(cigarSmoke?.intensity).toBe(CIGAR_SMOKE_INTENSITY);
    expect(cigarSmoke!.intensity).toBeLessThan(SCENE_LIFE_INTENSITY);
    const shafts = chessSetPunctualLights('atelier');
    const dust = live.filter((emitter) => emitter.room === 'atelier');
    expect(dust).toHaveLength(2);
    dust.forEach((emitter, index) => {
      const light = shafts[index];
      expect(light).toBeDefined();
      const direction = beam(light!.position, light!.target);
      expect(emitter.direction[0]).toBeCloseTo(direction[0]);
      expect(emitter.direction[1]).toBeCloseTo(direction[1]);
      expect(emitter.direction[2]).toBeCloseTo(direction[2]);
    });
  });

  it('walks the cigar tip along the stick and keeps the smoke on it', () => {
    const start = cigarTip(0);
    const mid = cigarTip(CIGAR_PERIOD_S / 2);
    const loop = cigarTip(CIGAR_PERIOD_S);
    expect(start.along).toBeCloseTo(0);
    expect(mid.along).toBeCloseTo(CIGAR_LENGTH_M / 2);
    expect(loop.along).toBeCloseTo(0);
    expect(mid.smoke[0]).toBeCloseTo(mid.ember[0]);
    expect(mid.smoke[1]).toBeCloseTo(mid.ember[1]);
    expect(mid.smoke[2]).toBeCloseTo(mid.ember[2]);
    expect(mid.ember[0]).toBeGreaterThan(start.ember[0]);
  });

  it('keeps the life switch on the review bar and the compute off a match', () => {
    const bar = readFileSync(new URL('../src/renderer/review/SetReviewBar.tsx', import.meta.url), 'utf8');
    const ambiance = bar.indexOf('<p>Ambiance</p>');
    const vie = bar.indexOf('Vie');
    expect(ambiance).toBeGreaterThan(-1);
    expect(vie).toBeGreaterThan(ambiance);
    expect(vie - ambiance).toBeLessThan(400);
    expect(bar).toContain('setSceneLifeEnabled');
    const graphics = readFileSync(
      new URL('../src/renderer/graphics/chessGraphicsSettings.ts', import.meta.url),
      'utf8'
    );
    expect(graphics).toContain('sceneLife');
    expect(sceneLifeWanted(false, true, true)).toBe(true);
    expect(sceneLifeWanted(true, false, true)).toBe(false);
    expect(sceneLifeEmitters(sceneLifeWanted(false, true, true), true)).toEqual(sceneLifeEmitters(true, true));
    const host = readFileSync(new URL('../src/renderer/startChessHost.ts', import.meta.url), 'utf8');
    expect(host).toContain('createParticleSystem');
    const project = readFileSync(
      new URL('../src/renderer/host/ChessDemoProject.ts', import.meta.url),
      'utf8'
    );
    expect(project).toContain('sceneLifeWanted');
    expect(project).toContain('hearthFlicker');
    expect(project).toContain('disposeParticleEmitterGpu');
    expect(project).not.toContain('ember_particles.compute.wgsl');
  });
});
