/**
 * @file chessAudioTension.test.ts
 * @description CHESS-B25e: local eval → bed gains with hysteresis.
 */

import { describe, expect, it } from 'vitest';
import {
  chessAudioTensionStep,
  chessScoreForLocal,
} from '../src/chess/index';

describe('chessScoreForLocal', () => {
  it('keeps a white-centric score for the white player', () => {
    expect(chessScoreForLocal(200, 'white')).toBe(200);
  });

  it('flips the score for the black player', () => {
    expect(chessScoreForLocal(200, 'black')).toBe(-200);
  });
});

describe('chessAudioTensionStep', () => {
  it('stays calm near equality', () => {
    const next = chessAudioTensionStep(0, 'calm');
    expect(next.band).toBe('calm');
    expect(next.gains.edge).toBe(0);
    expect(next.gains.pressure).toBe(0);
    expect(next.gains.calm).toBeGreaterThan(0);
    expect(next.gains.music).toBeGreaterThan(0);
  });

  it('plays only the calm music stem when the band is calm', () => {
    const next = chessAudioTensionStep(0, 'calm');
    expect(next.gains.music).toBeGreaterThan(0);
    expect(next.gains.musicEdge).toBe(0);
    expect(next.gains.musicPressure).toBe(0);
  });

  it('plays only the edge music stem under advantage', () => {
    const next = chessAudioTensionStep(80, 'calm');
    expect(next.gains.musicEdge).toBeGreaterThan(0);
    expect(next.gains.music).toBe(0);
    expect(next.gains.musicPressure).toBe(0);
  });

  it('plays only the pressure music stem under pressure, quieter than calm music', () => {
    const calm = chessAudioTensionStep(0, 'calm');
    const pressure = chessAudioTensionStep(-80, 'calm');
    expect(pressure.gains.musicPressure).toBeGreaterThan(0);
    expect(pressure.gains.music).toBe(0);
    expect(pressure.gains.musicEdge).toBe(0);
    expect(pressure.gains.musicPressure).toBeLessThan(calm.gains.music);
  });

  it('enters edge when local advantage crosses +80', () => {
    expect(chessAudioTensionStep(79, 'calm').band).toBe('calm');
    const edge = chessAudioTensionStep(80, 'calm');
    expect(edge.band).toBe('edge');
    expect(edge.gains.edge).toBeGreaterThan(0);
  });

  it('enters pressure when local score crosses -80', () => {
    const pressure = chessAudioTensionStep(-80, 'calm');
    expect(pressure.band).toBe('pressure');
    expect(pressure.gains.pressure).toBeGreaterThan(0);
  });

  it('keeps edge until score falls below the exit threshold', () => {
    expect(chessAudioTensionStep(50, 'edge').band).toBe('edge');
    expect(chessAudioTensionStep(39, 'edge').band).toBe('calm');
  });

  it('keeps pressure until score rises above the exit threshold', () => {
    expect(chessAudioTensionStep(-50, 'pressure').band).toBe('pressure');
    expect(chessAudioTensionStep(-39, 'pressure').band).toBe('calm');
  });
});
