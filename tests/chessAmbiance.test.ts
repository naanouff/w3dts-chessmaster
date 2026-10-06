/**
 * @file chessAmbiance.test.ts
 * @description Room choice storage, apart from graphics, and the set each room names.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHESS_BOARD_BODY_HEIGHT } from '../src/chess/board/chessBoard';
import {
  GARDEN_PERGOLA_DEPTH,
  GARDEN_PERGOLA_HEIGHT,
  GARDEN_PERGOLA_WIDTH,
  GARDEN_SKY_HOUR,
  STUDIO_SKY_HOUR,
  applyRoomSky,
  gardenPergolaPieces,
  gardenShadowBox,
} from '../src/renderer/host/gardenStage';
import { pieceTextureSize } from '../src/renderer/graphics/chessGraphicsSettings';
import {
  CHESS_AMBIANCE_KEY,
  CHESS_AMBIANCES,
  chessBoardExposure,
  chessCameraFaceExposure,
  chessSetAmbient,
  chessSetBoardY,
  chessSetKeepsCloth,
  chessSetLook,
  chessSetPlacements,
  chessSetPropUrl,
  chessSetProps,
  chessSetPunctualLights,
  chessGlassTop,
  chessSetShell,
  chessSetSunIntensity,
  parseChessAmbiance,
  getChessAmbiance,
  rememberChessAmbiance,
  setChessAmbiance,
} from '../src/renderer/host/chessAmbiance';

describe('chess ambiance', () => {
  it('defaults to atelier and rejects an unknown room', () => {
    expect(parseChessAmbiance(null)).toBe('atelier');
    expect(parseChessAmbiance('')).toBe('atelier');
    expect(parseChessAmbiance('terrasse')).toBe('atelier');
    expect(parseChessAmbiance('salon')).toBe('salon');
    expect(parseChessAmbiance('club')).toBe('club');
  });

  it('stores the room apart from the graphics preset and the shell', () => {
    const saved = new Map<string, string>();
    saved.set('w3dts-chess-graphics', '{"textureQuality":"high"}');
    saved.set('w3dts-chess-shell', '{"language":"fr"}');
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
    };
    rememberChessAmbiance(storage, 'salon');
    expect(CHESS_AMBIANCE_KEY).toBe('w3dts-chess-ambiance');
    expect(saved.get(CHESS_AMBIANCE_KEY)).toBe('salon');
    expect(saved.get('w3dts-chess-graphics')).toBe('{"textureQuality":"high"}');
    expect(saved.get('w3dts-chess-shell')).toBe('{"language":"fr"}');
  });

  it('names the props for each room and does not ask for an HDRI', () => {
    expect(chessSetLook('atelier')).not.toHaveProperty('hdriName');
    expect(chessSetLook('salon')).not.toHaveProperty('hdriUrl');
    expect(chessSetLook('club')).not.toHaveProperty('iblGain');
    expect(chessSetProps('atelier')).not.toContain('cyclorama');
    expect(chessSetProps('club')).not.toContain('table');
    expect(chessSetProps('club')).not.toContain('rail');
    expect(chessSetProps('salon')).toContain('lampe');
  });

  it('reads props at the same size as the piece textures', () => {
    expect(chessSetPropUrl('atelier', 'table', pieceTextureSize('low'))).toBe(
      '/sets/atelier/256/table.glb'
    );
    expect(chessSetPropUrl('club', 'bar', pieceTextureSize('medium'))).toBe(
      '/sets/club/512/bar.glb'
    );
    expect(chessSetPropUrl('salon', 'fauteuil', pieceTextureSize('high'))).toBe(
      '/sets/salon/1024/fauteuil.glb'
    );
  });

  it('keeps the cloth plane until every required prop is present', () => {
    expect(chessSetKeepsCloth('atelier', ['table'])).toBe(true);
    expect(chessSetKeepsCloth('atelier', chessSetProps('atelier'))).toBe(false);
    expect(chessSetKeepsCloth('club', chessSetProps('club'))).toBe(false);
  });

  it('places the review copies and keeps the cyclorama and the glass table procedural', () => {
    const atelier = chessSetPlacements('atelier').map((item) => item.file);
    expect(atelier.filter((file) => file === 'plateau-toile')).toHaveLength(2);
    expect(atelier).not.toContain('cyclorama');
    expect(chessSetPlacements('club').map((item) => item.file)).not.toContain('table');
    expect(chessSetPlacements('club').map((item) => item.file)).not.toContain('rail');
    expect(chessSetShell('atelier').cove).not.toBeNull();
    expect(chessSetShell('atelier').glassTable).toBe(false);
    expect(chessSetShell('club').glassTable).toBe(true);
    expect(chessSetShell('salon').room).not.toBeNull();
    expect(chessSetPlacements('salon').find((item) => item.file === 'napperon')).toEqual({
      file: 'napperon',
      anchor: 'surface',
    });
    expect(chessSetPlacements('salon').find((item) => item.file === 'lampe')?.emissiveScale).toBe(0.25);
    expect(chessSetShell('atelier').floorDepth).toBe(7);
    expect(chessSetShell('atelier').floorZMax).toBe(0.7);
  });

  it('rests the board slab on the table', () => {
    // The body hangs this far under the playing surface, then a millimetre clears the top.
    const onTable = CHESS_BOARD_BODY_HEIGHT + 0.001;
    expect(chessSetBoardY('atelier')).toBeCloseTo(onTable);
    expect(chessSetBoardY('club')).toBeCloseTo(onTable);
    expect(chessSetBoardY('salon')).toBeCloseTo(onTable + 0.02);
    expect(chessSetBoardY('atelier') - CHESS_BOARD_BODY_HEIGHT).toBeGreaterThan(0);
  });

  it('copies the review lights', () => {
    const atelier = chessSetPunctualLights('atelier');
    expect(atelier.map((light) => light.kind)).toEqual(['spot', 'spot']);
    expect(atelier[0]?.outerAngle).toBeGreaterThan(0.25);
    expect(atelier[0]?.outerAngle).toBeLessThan(0.4);
    const salon = chessSetPunctualLights('salon');
    expect(salon.map((light) => light.kind)).toEqual(['spot', 'spot', 'point']);
    expect(salon.find((light) => light.kind === 'point')?.fromFloor).toBe(0.42);
    const club = chessSetPunctualLights('club');
    expect(club.map((light) => light.kind)).toEqual(['spot', 'point', 'point', 'spot']);
    expect(chessSetSunIntensity('atelier', false)).toBe(0.36);
    expect(chessSetSunIntensity('salon', false)).toBe(0.04);
    expect(chessSetSunIntensity('club', false)).toBe(0);
    expect(chessSetLook('atelier').sunPos).toEqual([1.6, 6.5, -0.4]);
    expect(chessSetLook('club').sunPos).toBeNull();
  });

  it('lets each room key cast the contact shadow', () => {
    const atelier = chessSetPunctualLights('atelier');
    expect(atelier[0]?.cast).toBe(false);
    expect(atelier[1]?.cast).toBe(true);
    const salon = chessSetPunctualLights('salon');
    expect(salon[0]?.cast).toBe(true);
    expect(salon[1]?.cast).toBe(false);
    const club = chessSetPunctualLights('club');
    expect(club[0]?.cast).toBe(true);
    expect(club[3]?.cast).toBe(false);
    expect(club.filter((light) => light.kind === 'point').every((light) => light.cast === false)).toBe(
      true
    );
  });

  it('lights the pawns from the game camera in the night rooms', () => {
    const floorY: Record<string, number> = { salon: -0.67, club: -0.95 };
    expect(chessCameraFaceExposure('salon', floorY.salon ?? -0.67)).toBeGreaterThan(0.35);
    expect(chessCameraFaceExposure('club', floorY.club ?? -0.95)).toBeGreaterThan(0.7);
  });

  it('lights the playing surface without clipping it to white', () => {
    // Table heights of the baked props, from the playing surface down to the feet.
    const floorY: Record<string, number> = { atelier: -0.8, salon: -0.67, club: -0.95 };
    for (const id of CHESS_AMBIANCES) {
      const exposure = chessBoardExposure(id, floorY[id] ?? -0.8);
      expect(exposure).toBeGreaterThan(0.3);
      expect(exposure).toBeLessThan(0.9);
    }
  });

  it('fills the surfaces the spots miss enough for them to read', () => {
    // The shader scales the fill by 0.12 before it reaches a surface, so the stored
    // value is not the fill itself. Below 0.015 on mid grey a room reads as a black hole.
    const SHADER_FLAT_AMBIENT = 0.12;
    const MID_GREY = 0.5;
    for (const id of CHESS_AMBIANCES) {
      expect(chessSetAmbient(id) * SHADER_FLAT_AMBIENT * MID_GREY).toBeGreaterThan(0.015);
    }
    expect(chessSetAmbient('atelier')).toBeGreaterThan(chessSetAmbient('salon'));
  });

  it('draws the club table as the review smoked glass', () => {
    const glass = chessGlassTop();
    expect(glass.alphaMode).toBe('BLEND');
    expect(glass.transmission).toBe(1);
    expect(glass.roughness).toBe(0.05);
    expect(glass.metallic).toBe(0);
    expect(glass.ior).toBe(1.45);
    expect(glass.thickness).toBe(0.012);
    expect(glass.attenuationDistance).toBe(0.4);
    expect(glass.color[0]).toBeCloseTo(0.473531, 5);
    expect(glass.color[1]).toBeCloseTo(0.539479, 5);
    expect(glass.color[2]).toBeCloseTo(0.57758, 5);
    expect(glass.attenuationColor[0]).toBeCloseTo(0.01033, 4);
    expect(glass.attenuationColor[1]).toBeCloseTo(0.015996, 4);
    expect(glass.attenuationColor[2]).toBeCloseTo(0.021219, 4);
    expect(glass.compile).toEqual({
      khrMaterialsTransmission: true,
      khrMaterialsVolume: true,
      khrMaterialsIor: true,
    });
  });

  it('dims the sun with the room only after the cloth is gone', () => {
    expect(chessSetSunIntensity('salon', true)).toBe(chessSetSunIntensity('atelier', true));
    expect(chessSetSunIntensity('club', false)).toBeLessThan(chessSetSunIntensity('salon', false));
    expect(chessSetSunIntensity('salon', false)).toBeLessThan(chessSetSunIntensity('atelier', false));
  });
});

describe('scene mockup', () => {
  it('offers the garden beside the three playable rooms', () => {
    const source = readFileSync(new URL('../docs/mockup/mockup.js', import.meta.url), 'utf8');
    const sets = source.slice(source.indexOf('const SETS'), source.indexOf('const RANKS'));
    expect(sets).toContain("{ id: 'jardin', label: 'Jardin', thumb: '../ambiances/jardin-suspendu.jpg' }");
  });
});

describe('garden review', () => {
  it('stages the hanging garden under a pergola on a full terracotta floor', () => {
    expect(CHESS_AMBIANCES).not.toContain('jardin');
    expect(parseChessAmbiance('jardin')).toBe('jardin');
    expect(chessSetProps('jardin')).toEqual(['table', 'coupe', 'dalle', 'banc', 'arrosoir', 'glycine']);
    const placed = chessSetPlacements('jardin');
    expect(placed.map((item) => item.file)).not.toContain('pergola');
    expect(chessSetShell('jardin').pergola).toBe(true);
    expect(chessSetShell('atelier').pergola).toBe(false);
    const posts = gardenPergolaPieces().filter((piece) => piece.name === 'post');
    expect(posts).toHaveLength(4);
    expect(posts.every((piece) => piece.scale[1] === GARDEN_PERGOLA_HEIGHT)).toBe(true);
    const postX = posts.map((piece) => piece.position[0]);
    const postZ = posts.map((piece) => piece.position[2]);
    expect(Math.max(...postX) - Math.min(...postX)).toBe(GARDEN_PERGOLA_WIDTH);
    expect(Math.max(...postZ) - Math.min(...postZ)).toBe(GARDEN_PERGOLA_DEPTH);
    expect(gardenPergolaPieces().some((piece) => piece.name === 'rafter')).toBe(true);
    expect(gardenPergolaPieces().some((piece) => piece.name === 'horizon')).toBe(true);
    const shadow = gardenShadowBox();
    expect(shadow.min[0]).toBeLessThanOrEqual(-GARDEN_PERGOLA_WIDTH / 2);
    expect(shadow.max[0]).toBeGreaterThanOrEqual(GARDEN_PERGOLA_WIDTH / 2);
    expect(shadow.max[1]).toBeGreaterThanOrEqual(GARDEN_PERGOLA_HEIGHT);
    expect(placed.find((item) => item.file === 'table')?.anchor).toBe('top');
    const bowls = placed.filter((item) => item.file === 'coupe');
    expect(bowls).toHaveLength(2);
    expect((bowls[0]?.x ?? 0) * (bowls[1]?.x ?? 0)).toBeLessThan(0);
    expect(placed.some((item) => item.file === 'haie')).toBe(false);
    expect(placed.find((item) => item.file === 'banc')?.yaw).toBeCloseTo(Math.PI);
    const tiles = placed.filter((item) => item.file === 'dalle');
    expect(Math.min(...tiles.map((tile) => tile.x ?? 0))).toBeLessThan(-2);
    expect(Math.max(...tiles.map((tile) => tile.x ?? 0))).toBeGreaterThan(2);
    expect(Math.min(...tiles.map((tile) => tile.z ?? 0))).toBeLessThan(-2);
    expect(Math.max(...tiles.map((tile) => tile.z ?? 0))).toBeGreaterThan(2);
    expect(tiles.every((tile) => tile.cast === false)).toBe(true);
    expect(placed.filter((item) => item.file === 'glycine').every((item) => (item.lift ?? 0) > 1.6)).toBe(true);
    expect(chessSetBoardY('jardin')).toBeCloseTo(chessSetBoardY('atelier'));
    expect(chessSetShell('jardin').room).toBeNull();
    expect(chessSetShell('jardin').cove).toBeNull();
    expect(chessSetShell('jardin').glassTable).toBe(false);
    const look = chessSetLook('jardin');
    expect(look.sun).toBeGreaterThan(1);
    expect(look.sunPos?.[0] ?? 0).toBeGreaterThan(0);
    expect(look.sunPos?.[1] ?? 0).toBeLessThan(Math.hypot(look.sunPos?.[0] ?? 0, look.sunPos?.[2] ?? 0));
    expect((look.sunColor?.[0] ?? 0) - (look.sunColor?.[2] ?? 1)).toBeGreaterThan(0.4);
    expect(chessSetPunctualLights('jardin').every((light) => light.cast === false)).toBe(true);
    const exposure = chessBoardExposure('jardin', -0.59);
    expect(exposure).toBeGreaterThan(0.25);
    expect(exposure).toBeLessThan(0.9);
  });

  it('paints an evening sea sky and restores the studio sky', () => {
    const sky = [
      {
        name: '03_Skybox',
        skyboxParams: {
          timeOfDay: STUDIO_SKY_HOUR,
          gradientStops: [
            { offset: 0, color: [0.62, 0.62, 0.64] as [number, number, number] },
            { offset: 0.5, color: [0.82, 0.82, 0.84] as [number, number, number] },
            { offset: 1, color: [0.9, 0.9, 0.92] as [number, number, number] },
          ],
        },
      },
    ];
    applyRoomSky(sky, 'jardin');
    expect(sky[0]?.skyboxParams.timeOfDay).toBe(GARDEN_SKY_HOUR);
    const evening = sky[0]?.skyboxParams.gradientStops ?? [];
    const horizon = evening.find((stop) => stop.offset === 0.42);
    const zenith = evening.find((stop) => stop.offset === 1);
    expect(horizon?.color[0] ?? 0).toBeGreaterThan(horizon?.color[2] ?? 1);
    expect(zenith?.color[2] ?? 0).toBeGreaterThan(zenith?.color[0] ?? 1);
    applyRoomSky(sky, 'atelier');
    expect(sky[0]?.skyboxParams.timeOfDay).toBe(STUDIO_SKY_HOUR);
    expect(sky[0]?.skyboxParams.gradientStops?.[0]?.color).toEqual([0.62, 0.62, 0.64]);
  });

  it('does not store the garden over the match room', () => {
    const saved = new Map<string, string>([[CHESS_AMBIANCE_KEY, 'salon']]);
    const previous = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => {
          saved.set(key, value);
        },
      },
    });
    setChessAmbiance('jardin');
    expect(getChessAmbiance()).toBe('jardin');
    expect(saved.get(CHESS_AMBIANCE_KEY)).toBe('salon');
    setChessAmbiance('atelier');
    expect(saved.get(CHESS_AMBIANCE_KEY)).toBe('atelier');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  });
});
