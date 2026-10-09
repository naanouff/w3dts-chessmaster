/**
 * @file chessSetReview.test.ts
 * @description The ambiance review is a flag on the game client, with the game camera and a wider frame.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLUID_GRAPHICS,
  gamePassNames,
  pieceTextureSize,
} from '../src/renderer/graphics/chessGraphicsSettings';
import { chessSetBoardY } from '../src/renderer/host/chessAmbiance';
import {
  applyReviewDof,
  applyReviewGrade,
  CHESS_REVIEW_GRAPHICS,
  CHESS_REVIEW_POSES,
  chessReviewFrame,
  isChessSetReview,
  requestChessCameraArrival,
  reviewGrade,
  setChessReviewFrame,
  setReviewGrade,
  subscribeChessCameraArrival,
  subscribeChessReviewFrame,
} from '../src/renderer/host/chessSetReview';
import { reviewSearchFromArgv } from '../src/main/reviewArgv';
import { REVIEW_POST_CONTROLS, writeReviewPost } from '../src/renderer/review/reviewPostControls';
import { reviewPassCosts, reviewPostConfigJson, stepReviewScene, toggleReviewSection } from '../src/renderer/review/reviewHud';

describe('chess set review', () => {
  it('opens only when the client is asked for the review', () => {
    expect(isChessSetReview('')).toBe(false);
    expect(isChessSetReview('?chess=cpu')).toBe(false);
    expect(isChessSetReview('?review=1')).toBe(true);
    expect(isChessSetReview('review=ambiance')).toBe(true);
  });

  it('starts on the wide frame and keeps the game camera numbers', () => {
    expect(chessReviewFrame()).toBe('wide');
    expect(CHESS_REVIEW_POSES.game.eye).toEqual([0, 0.55, -0.72]);
    expect(CHESS_REVIEW_POSES.game.target).toEqual([0, 0.02, 0]);
    expect(CHESS_REVIEW_POSES.wide.eye).toEqual([0, 0.95, -2.35]);
    expect(CHESS_REVIEW_POSES.wide.target).toEqual([0, 0.28, 0.7]);
  });

  it('tells the host when the frame changes', () => {
    const seen: string[] = [];
    const stop = subscribeChessReviewFrame((frame) => seen.push(frame));
    setChessReviewFrame('game');
    setChessReviewFrame('wide');
    stop();
    setChessReviewFrame('game');
    expect(seen).toEqual(['game', 'wide']);
    setChessReviewFrame('wide');
  });

  it('asks the host to replay the camera arrival', () => {
    const seen: number[] = [];
    const stop = subscribeChessCameraArrival(() => seen.push(seen.length));
    requestChessCameraArrival();
    requestChessCameraArrival();
    stop();
    requestChessCameraArrival();
    expect(seen).toEqual([0, 1]);
  });

  it('judges the rooms with the finish on, without touching the stored game profile', () => {
    expect(CHESS_REVIEW_GRAPHICS.ambientOcclusion).toBe(true);
    expect(CHESS_REVIEW_GRAPHICS.reflections).toBe(true);
    expect(CHESS_REVIEW_GRAPHICS.reflectionProbes).toBe(true);
    expect(CHESS_REVIEW_GRAPHICS.bloom).toBe(false);
    expect(CHESS_REVIEW_GRAPHICS.textureQuality).toBe('high');
    expect(pieceTextureSize(CHESS_REVIEW_GRAPHICS.textureQuality)).toBe(1024);
    const host = readFileSync(
      new URL('../src/renderer/host/ChessDemoProject.ts', import.meta.url),
      'utf8'
    );
    expect(host).toContain('loadChessSet(');
    expect(host).toContain('getChessGraphicsSettings().textureQuality');
    expect(host).not.toContain('CHESS_SET_REVIEW_TEXTURE_SIZE');
    const names = gamePassNames(CHESS_REVIEW_GRAPHICS);
    expect(names).toContain('04b_HBAO');
    expect(names).toContain('05_SSR_Floor');
    expect(names).not.toContain('06_Bright');
    expect(names).toContain('09_Fog');
    expect(CHESS_REVIEW_GRAPHICS.volume).toBe(true);
    expect(FLUID_GRAPHICS.volume).toBe(false);
    expect(gamePassNames(FLUID_GRAPHICS)).not.toContain('09_Fog');
    expect(names).toContain('10_DoF');
    expect(CHESS_REVIEW_GRAPHICS.dof).toBe(true);
    expect(FLUID_GRAPHICS.dof).toBe(false);
    expect(gamePassNames(FLUID_GRAPHICS)).not.toContain('10_DoF');
  });

  it('offers the garden on the review bar', () => {
    const source = readFileSync(new URL('../src/renderer/review/SetReviewBar.tsx', import.meta.url), 'utf8');
    expect(source).toContain("{ id: 'jardin', label: 'Jardin' }");
    expect(source).toContain("{ id: 'terrasse', label: 'Terrasse' }");
    expect(source).toContain('toFixed(2)');
    expect(source).toContain('img/s');
    expect(source).toContain('triangles');
    expect(source).toContain('passes');
    expect(source).toContain('set-review-scenes');
    expect(source).toContain('toggleReviewSection');
    expect(source).toContain('Copier JSON');
    expect(source).toContain('set-review-menu');
    expect(source).toContain('aria-label="Menu revue"');
    expect(source).toContain('Caméra de jeu');
    expect(source).toContain('Arrivée');
  });

  it('steps scenes in a loop and prices each traced pass', () => {
    expect(stepReviewScene('atelier', 1)).toBe('salon');
    expect(stepReviewScene('terrasse', 1)).toBe('atelier');
    expect(stepReviewScene('atelier', -1)).toBe('terrasse');
    const costs = reviewPassCosts(new Map([
      ['02_Opaques', [{ value: 1.2 }]],
      ['04b_HBAO', [{ value: 0.4 }, { value: 3.5 }]],
      ['07_FXAA', []],
    ]));
    expect(costs.map((row) => row.name)).toEqual(['04b_HBAO', '02_Opaques']);
    expect(costs[0].ms).toBe(3.5);
    const hbaoOff = toggleReviewSection(CHESS_REVIEW_GRAPHICS, 'HBAO');
    expect(hbaoOff.ambientOcclusion).toBe(false);
    expect(CHESS_REVIEW_GRAPHICS.ambientOcclusion).toBe(true);
    expect(toggleReviewSection(hbaoOff, 'Upscale').upscale).toBe('off');
    expect(toggleReviewSection({ ...hbaoOff, upscale: 'off' }, 'Upscale').upscale).toBe('quality');
    expect(toggleReviewSection(CHESS_REVIEW_GRAPHICS, 'Image')).toBe(CHESS_REVIEW_GRAPHICS);
  });

  it('copies the live post-process configuration as json', () => {
    const json = reviewPostConfigJson(CHESS_REVIEW_GRAPHICS, {
      'grade-brightness': 1.25,
      'grade-contrast': 1.4,
      'grade-saturation': 0.6,
      'hbao-radius': 0.085,
    });
    const parsed = JSON.parse(json) as {
      Image: { 'grade-brightness': number };
      HBAO: { enabled: boolean; 'hbao-radius': number };
      Upscale: { enabled: boolean; mode: string };
      FXAA: { enabled: boolean };
      Bloom: { enabled: boolean };
    };
    expect(parsed.Image['grade-brightness']).toBe(1.25);
    expect(parsed.HBAO.enabled).toBe(true);
    expect(parsed.HBAO['hbao-radius']).toBe(0.085);
    expect(parsed.Upscale.mode).toBe('quality');
    expect(parsed.FXAA.enabled).toBe(true);
    expect(parsed.Bloom.enabled).toBe(false);
  });

  it('starts every post slider on the shared look', () => {
    const byId = Object.fromEntries(REVIEW_POST_CONTROLS.map((control) => [control.id, control.initial]));
    expect(byId).toMatchObject({
      'grade-brightness': 1.25,
      'grade-contrast': 1.4,
      'grade-saturation': 0.6,
      'hbao-steps': 4,
      'ssr-steps': 16,
      'fog-steps': 14,
      'dof-radius': 4,
      'upscale-sharpness': 0.7,
    });
  });

  it('writes each post-process parameter the review can drag', () => {
    const groups = new Set(REVIEW_POST_CONTROLS.map((control) => control.group));
    expect([...groups]).toEqual(['Image', 'HBAO', 'SSR', 'Volume', 'Bloom', 'DOF', 'Upscale']);
    expect(REVIEW_POST_CONTROLS.filter((control) => control.group === 'Image').map((control) => control.label)).toEqual([
      'Luminosité',
      'Contraste',
      'Saturation',
    ]);
    const tone = {
      name: 'Tone Mapping & Output',
      uniforms: { exposure: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 } },
    };
    const brightness = REVIEW_POST_CONTROLS.find((control) => control.id === 'grade-brightness');
    expect(brightness).toBeDefined();
    writeReviewPost([tone], brightness!, 1.15);
    expect(tone.uniforms.exposure.value).toBe(1.15);
    const fog = { name: '09_Fog', uniforms: { fogParams: { value: [0.06, 0.45, 0, 0.6, 16] } } };
    const density = REVIEW_POST_CONTROLS.find((control) => control.id === 'fog-density');
    expect(density).toBeDefined();
    writeReviewPost([fog], density!, 0.02);
    expect(fog.uniforms.fogParams.value[0]).toBe(0.02);
    const horizontal = { name: '06b_BlurH', uniforms: { radius: { value: 3 } } };
    const vertical = { name: '06c_BlurV', uniforms: { radius: { value: 3 } } };
    const radius = REVIEW_POST_CONTROLS.find((control) => control.id === 'bloom-radius');
    expect(radius).toBeDefined();
    writeReviewPost([horizontal, vertical], radius!, 5);
    expect(horizontal.uniforms.radius.value).toBe(5);
    expect(vertical.uniforms.radius.value).toBe(5);
  });

  it('keeps the depth of field on the board when the room lifts it', () => {
    const dof = { name: '10_DoF', uniforms: { dofParams: { value: [1, 2, 3, 0.5, 16] } } };
    applyReviewDof([dof], 'salon');
    expect(dof.uniforms.dofParams.value[0]).toBe(0);
    expect(dof.uniforms.dofParams.value[1]).toBeCloseTo(chessSetBoardY('salon'));
    expect(dof.uniforms.dofParams.value[2]).toBe(0);
    const host = readFileSync(
      new URL('../src/renderer/host/ChessDemoProject.ts', import.meta.url),
      'utf8'
    );
    expect(host).toContain('applyReviewDof');
    expect(host).toContain('applyReviewGrade');
  });

  it('starts every scene at the same grade', () => {
    const scene = { brightness: 1.25, contrast: 1.4, saturation: 0.6 };
    for (const id of ['atelier', 'salon', 'club', 'jardin', 'terrasse'] as const) {
      expect(reviewGrade(id)).toEqual(scene);
    }
    setReviewGrade('salon', { brightness: 1.4, contrast: 0.8, saturation: 1.25 });
    expect(reviewGrade('atelier')).toEqual(scene);
    const tone = {
      name: 'Tone Mapping & Output',
      uniforms: { exposure: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 } },
    };
    applyReviewGrade([tone], 'salon');
    expect(tone.uniforms.exposure.value).toBe(1.4);
    expect(tone.uniforms.contrast.value).toBe(0.8);
    expect(tone.uniforms.saturation.value).toBe(1.25);
    applyReviewGrade([tone], 'atelier');
    expect(tone.uniforms.exposure.value).toBe(1.25);
    expect(tone.uniforms.contrast.value).toBe(1.4);
    expect(tone.uniforms.saturation.value).toBe(0.6);
    setReviewGrade('salon', scene);
  });

  it('forwards a review launch argument into the window query', () => {
    expect(reviewSearchFromArgv(['electron', '.'])).toBe('');
    expect(reviewSearchFromArgv(['electron', '.', '--review'])).toBe('review=1');
    expect(reviewSearchFromArgv(['electron', '.', '--review=1'])).toBe('review=1');
  });
});
