/**
 * @file chessSetViewSide.test.ts
 * @description Z-mirrored set dressing and which band each local color sees.
 */

import { describe, expect, it } from 'vitest';
import {
  chessSetPlacementViewSide,
  chessSetPlacements,
  chessSetPlacementsBothSides,
  chessSetViewSideFromNodeName,
  chessSetViewSideVisible,
  mirrorChessSetPlacement,
  tagChessSetNodeName,
} from '../src/renderer/host/chessAmbiance';

describe('chess set view side', () => {
  it('mirrors a prop across Z and turns it to face the other way', () => {
    expect(
      mirrorChessSetPlacement({
        file: 'tabouret',
        anchor: 'floor',
        x: 0.2,
        z: 2.05,
        yaw: Math.PI,
      })
    ).toEqual({
      file: 'tabouret',
      anchor: 'floor',
      x: 0.2,
      z: -2.05,
      yaw: 2 * Math.PI,
    });
  });

  it('tags atelier backdrop props as plusZ and keeps the table shared', () => {
    expect(chessSetPlacementViewSide({ file: 'tabouret', anchor: 'floor', z: 2.05 })).toBe('plusZ');
    expect(chessSetPlacementViewSide({ file: 'table', anchor: 'top' })).toBe('shared');
    expect(
      chessSetPlacementViewSide({ file: 'softbox', anchor: 'floor', x: 1.85, z: 0.45 })
    ).toBe('shared');
  });

  it('adds a mirrored tabouret for the atelier and does not double floor tiles', () => {
    const stools = chessSetPlacementsBothSides('atelier').filter((item) => item.file === 'tabouret');
    expect(stools.map((item) => item.z).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([-2.05, 2.05]);
    const authored = chessSetPlacements('salon').filter((item) => item.file === 'dalle').length;
    const both = chessSetPlacementsBothSides('salon').filter((item) => item.file === 'dalle').length;
    expect(both).toBe(authored);
  });

  it('shows the far band for each local color and keeps shared props', () => {
    expect(chessSetViewSideVisible('shared', 'white')).toBe(true);
    expect(chessSetViewSideVisible('shared', 'black')).toBe(true);
    expect(chessSetViewSideVisible('plusZ', 'white')).toBe(true);
    expect(chessSetViewSideVisible('plusZ', 'black')).toBe(false);
    expect(chessSetViewSideVisible('minusZ', 'white')).toBe(false);
    expect(chessSetViewSideVisible('minusZ', 'black')).toBe(true);
  });

  it('mirrors salon fireplace and club bar for the black-side view', () => {
    const salon = chessSetPlacementsBothSides('salon').filter((item) => item.file === 'cheminee');
    expect(salon.map((item) => item.z).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([-2.05, 2.05]);
    const bars = chessSetPlacementsBothSides('club').filter((item) => item.file === 'bar');
    expect(bars.map((item) => item.z).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([-3.05, 3.05]);
  });

  it('tags node names so visibility can hide the band behind the camera', () => {
    expect(tagChessSetNodeName('ChessSet-tabouret-0', 'plusZ')).toBe('ChessSet-tabouret-0@plusZ');
    expect(chessSetViewSideFromNodeName('ChessSet-tabouret-1@minusZ')).toBe('minusZ');
    expect(chessSetViewSideFromNodeName('ChessSetFloor')).toBe('shared');
  });
});
