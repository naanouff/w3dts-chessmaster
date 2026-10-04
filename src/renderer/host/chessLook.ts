/**
 * @file chessLook.ts
 * @project w3dts
 * @description Marble / steel Shader Graphs and photo PBR maps for ChessDemoProject.
 */

import { boardAlbedoCell, CHESS_BOARD_MESH_EXTENT } from '../../chess';
import {
  CORE_PBR_KHR_FLAGS,
  Material as MaterialClass,
  TextureLoader,
  type Material,
  type PbrKhrExtensionCompileFlags,
  type ResourceManager,
  type ShaderGraph,
  type ShaderGraphNode,
} from '@naanouff/w3dts-core';
import { fetchPublicAssetPreferSameOrigin } from './assetFetch';

/** Enable KHR anisotropy so the brushed-steel highlight is not stripped. */
const CHESS_STEEL_KHR: PbrKhrExtensionCompileFlags = {
  ...CORE_PBR_KHR_FLAGS,
  khrMaterialsAnisotropy: true,
};

export const MARBLE_PBR_SHADER_ID = 'MarbleProceduralPBR';
export const STEEL_PBR_SHADER_ID = 'BrushedSteelProceduralPBR';

function propertyDefaults(graph: ShaderGraph): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!graph.properties) return out;
  for (const [key, entry] of Object.entries(graph.properties)) {
    if (entry && typeof entry === 'object' && 'defaultValue' in entry) {
      out[key] = entry.defaultValue;
    }
  }
  return out;
}

async function loadGraph(baseUrl: string, file: string): Promise<ShaderGraph> {
  const res = await fetch(`${baseUrl}/${file}`);
  if (!res.ok) throw new Error(`Failed to load ${file}`);
  return (await res.json()) as ShaderGraph;
}

export async function loadChessPieceShaderGraphs(
  baseUrl = '/shader-graphs'
): Promise<{ marble: ShaderGraph; steel: ShaderGraph }> {
  const [marble, steel] = await Promise.all([
    loadGraph(baseUrl, 'MarbleProceduralPBR.json'),
    loadGraph(baseUrl, 'BrushedSteelProceduralPBR.json'),
  ]);
  return { marble, steel };
}

function createGraphMaterial(
  resourceManager: ResourceManager,
  name: string,
  graph: ShaderGraph,
  extraProperties?: Record<string, unknown>
): Material {
  const sampler =
    resourceManager['device']?.createSampler?.({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      maxAnisotropy: 8,
    }) ?? undefined;
  const material = new MaterialClass({
    name,
    shadingModel: 'graph',
    shaderGraph: graph,
    properties: { ...propertyDefaults(graph), ...extraProperties },
    sampler,
  });
  resourceManager.uploadMaterial(material);
  return material;
}

export function createMarbleMaterial(
  resourceManager: ResourceManager,
  graph: ShaderGraph
): Material {
  return createGraphMaterial(resourceManager, 'ChessMarblePBR', graph, {
    normalDetailScale: 0,
    triplanarScale: 2.4,
    baseColor: [0.84, 0.78, 0.68],
    accentColor: [0.45, 0.28, 0.2],
    wearColor: [0.4, 0.38, 0.36],
    roughness: 0.22,
    metallic: 0,
  });
}

export function createBrushedSteelMaterial(
  resourceManager: ResourceManager,
  graph: ShaderGraph
): Material {
  return createGraphMaterial(resourceManager, 'ChessBrushedSteelPBR', graph, {
    normalDetailScale: 0,
    triplanarScale: 1.4,
    baseColor: [0.17, 0.185, 0.2],
    accentColor: [0.4, 0.42, 0.45],
    roughness: 0.42,
    metallic: 0.96,
    anisotropy: 0.88,
    anisotropyRotation: 0,
    pbrKhrExtensionFlags: CHESS_STEEL_KHR,
  });
}

const PHOTO_TEX = '/textures/chess';

const CHESS_GLOW_NEON_TEX_KEY = 'chess/glow/neon';

function registerChessGpuTexture(
  resourceManager: ResourceManager,
  cacheKey: string,
  texture: GPUTexture,
  sourceUrl?: string
): void {
  resourceManager.registerTexture(cacheKey, texture, sourceUrl);
}

function registerChessPhotoMapSet(
  resourceManager: ResourceManager,
  prefix: string,
  maps: { color: GPUTexture; normal: GPUTexture; orm: GPUTexture },
  sourcePrefix?: string
): void {
  registerChessGpuTexture(
    resourceManager,
    `${prefix}/baseColor`,
    maps.color,
    sourcePrefix ? `${sourcePrefix}/color` : undefined
  );
  registerChessGpuTexture(
    resourceManager,
    `${prefix}/normal`,
    maps.normal,
    sourcePrefix ? `${sourcePrefix}/normal` : undefined
  );
  registerChessGpuTexture(
    resourceManager,
    `${prefix}/orm`,
    maps.orm,
    sourcePrefix ? `${sourcePrefix}/orm` : undefined
  );
}

/** Re-attach photo/glow GPU maps after Play Mode restore (descriptor strips live handles). */
export function patchChessPhotoMaterialsFromCache(resourceManager: ResourceManager): void {
  const photoPrefixes = [
    'ChessMarblePhotoPBR',
    'ChessMetalPhotoPBR',
    'ChessBoardWoodPhotoPBR',
    'ChessBoardGoldPhotoPBR',
  ];
  for (const prefix of photoPrefixes) {
    const mat = resourceManager.getMaterialByName(prefix);
    if (!mat) continue;
    const color = resourceManager.getTexture(`${prefix}/baseColor`);
    const normal = resourceManager.getTexture(`${prefix}/normal`);
    const orm = resourceManager.getTexture(`${prefix}/orm`);
    if (color) mat.properties.set('baseColorTexture', color);
    if (normal) mat.properties.set('normalTexture', normal);
    if (orm) mat.properties.set('metallicRoughnessTexture', orm);
    resourceManager.uploadMaterial(mat);
  }

  const canvasBoard = resourceManager.getMaterialByName('ChessBoard');
  const canvasAlbedo = resourceManager.getTexture('chess/board/canvas-albedo');
  if (canvasBoard && canvasAlbedo) {
    canvasBoard.properties.set('baseColorTexture', canvasAlbedo);
    resourceManager.uploadMaterial(canvasBoard);
  }

  const neon = resourceManager.getTexture(CHESS_GLOW_NEON_TEX_KEY);
  if (!neon) return;
  for (const name of [
    'ChessLegalSquare',
    'ChessDropHoverLegal',
    'ChessDropHoverHome',
    'ChessDropHoverIllegal',
    'ChessBookSpline',
    'ChessBookSplineHead',
  ]) {
    const mat = resourceManager.getMaterialByName(name);
    if (!mat) continue;
    mat.properties.set('baseColorTexture', neon);
    mat.properties.set('emissiveTexture', neon);
    resourceManager.uploadMaterial(mat);
  }
}

/** Satin varnish: weaker coat, rougher so the studio HDR is a blur not a mirror. */
export const CHESS_BOARD_CLEARCOAT_FACTOR = 0.38;
export const CHESS_BOARD_CLEARCOAT_ROUGHNESS = 0.36;

const NEON_MASK_SIZE = 256;

/**
 * White RGB + alpha square ring (soft inward glow). Tint via `baseColor` / `emissiveColor`.
 */
export function bakeSquareNeonMask(size = NEON_MASK_SIZE): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  const linePos = 0.042;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const dEdge = Math.min(u, 1 - u, v, 1 - v);
      const lineT = (dEdge - linePos) / 0.014;
      const inT = Math.max(dEdge - linePos, 0) / 0.085;
      const line = Math.exp(-(lineT * lineT));
      const inward = Math.exp(-(inT * inT)) * 0.28;
      const core = Math.min(1, line * 1.15 + inward);
      const o = (y * size + x) * 4;
      const lum = Math.round(255 * core);
      data[o] = lum;
      data[o + 1] = lum;
      data[o + 2] = lum;
      data[o + 3] = Math.round(255 * Math.min(1, core));
    }
  }
  return new ImageData(data, size, size);
}

export async function loadChessMoveGlowTexture(
  device: GPUDevice,
  resourceManager?: ResourceManager
): Promise<GPUTexture> {
  const bitmap = await createImageBitmap(bakeSquareNeonMask());
  const texture = TextureLoader.fromImageBitmap(device, bitmap, {
    generateMips: true,
    flipY: false,
    samplerDescriptor: {
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
    },
  }).texture;
  if (resourceManager) {
    registerChessGpuTexture(resourceManager, CHESS_GLOW_NEON_TEX_KEY, texture);
  }
  return texture;
}

export function createChessMoveGlowMaterial(
  resourceManager: ResourceManager,
  pbrGraph: ShaderGraph,
  neon: GPUTexture,
  name: string,
  tint: [number, number, number],
  emissive: [number, number, number],
  alpha = 1
): Material {
  const sampler = resourceManager['device']?.createSampler?.({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });
  const material = new MaterialClass({
    name,
    shadingModel: 'pbr',
    shaderGraph: pbrGraph,
    alphaMode: 'BLEND',
    sampler,
    doubleSided: true,
    properties: {
      tag: 'transparent',
      baseColor: [...tint, alpha],
      baseColorTexture: neon,
      emissiveColor: [...emissive, 1],
      emissiveTexture: neon,
      roughness: 1,
      metallic: 0,
    },
  });
  resourceManager.uploadMaterial(material);
  return material;
}

function coachProperty(id: string, propertyName: string, dataType: 'vec3f' | 'f32', y: number): ShaderGraphNode {
  return {
    id,
    type: 'Property',
    position: { x: 0, y },
    stage: 'common',
    inputs: [],
    outputs: [{ id: 'out', name: propertyName, dataType }],
    data: { propertyName },
  };
}

/** Flat color. Ghosts blend it; the mask pass writes it for the silhouette. */
const COACH_UNLIT_GRAPH: ShaderGraph = {
  id: 'CoachCutoutUnlit',
  properties: {
    color: { name: 'Color', type: 'vec3f', defaultValue: [1, 1, 1] },
    opacity: { name: 'Opacity', type: 'f32', defaultValue: 1 },
  },
  nodes: [
    coachProperty('color', 'color', 'vec3f', 0),
    coachProperty('opacity', 'opacity', 'f32', 80),
    {
      id: 'master',
      type: 'UnlitMasterNode',
      position: { x: 280, y: 0 },
      stage: 'fragment',
      inputs: [
        { id: 'albedo', name: 'Albedo', dataType: 'vec3f' },
        { id: 'alpha', name: 'Alpha', dataType: 'f32' },
      ],
      outputs: [],
    },
  ],
  connections: [
    { fromNodeId: 'color', fromSocketId: 'out', toNodeId: 'master', toSocketId: 'albedo' },
    { fromNodeId: 'opacity', fromSocketId: 'out', toNodeId: 'master', toSocketId: 'alpha' },
  ],
};

function createCoachUnlitMaterial(
  resourceManager: ResourceManager,
  name: string,
  tint: readonly [number, number, number],
  opacity: number,
  alphaMode: 'OPAQUE' | 'BLEND',
  tag: string
): Material {
  const material = new MaterialClass({
    name,
    shadingModel: 'unlit',
    shaderGraph: COACH_UNLIT_GRAPH,
    alphaMode,
    doubleSided: false,
    properties: {
      tag,
      color: [tint[0], tint[1], tint[2]],
      opacity,
    },
  });
  resourceManager.uploadMaterial(material);
  return material;
}

/** Flat translucent piece on the destination square. */
export function createChessGhostMaterial(
  resourceManager: ResourceManager,
  name: string,
  tint: readonly [number, number, number]
): Material {
  return createCoachUnlitMaterial(resourceManager, name, tint, 0.72, 'BLEND', 'transparent');
}

/** Flat mask. Only the coach cutout pass draws it. */
export function createChessCutoutMaterial(
  resourceManager: ResourceManager,
  name: string,
  tint: readonly [number, number, number]
): Material {
  return createCoachUnlitMaterial(resourceManager, name, tint, 1, 'OPAQUE', 'coach_mask');
}

/** Legal / drop-hover / spline glow recipes used by ChessDemoProject. */
export const CHESS_MOVE_GLOW_RECIPES = [
  {
    name: 'ChessLegalSquare',
    tint: [0.28, 1, 0.42] as [number, number, number],
    emissive: [2.2, 22, 4] as [number, number, number],
  },
  {
    name: 'ChessDropHoverLegal',
    tint: [1, 0.86, 0.22] as [number, number, number],
    emissive: [18, 14, 1.8] as [number, number, number],
  },
  {
    name: 'ChessDropHoverHome',
    tint: [0.72, 0.88, 1] as [number, number, number],
    emissive: [5, 10, 24] as [number, number, number],
  },
  {
    name: 'ChessDropHoverIllegal',
    tint: [1, 0.22, 0.18] as [number, number, number],
    emissive: [32, 4.5, 2] as [number, number, number],
  },
  {
    name: 'ChessBookSpline',
    tint: [0.35, 0.92, 1] as [number, number, number],
    emissive: [4, 16, 22] as [number, number, number],
  },
  {
    name: 'ChessBookSplineHead',
    tint: [1, 0.95, 0.55] as [number, number, number],
    emissive: [22, 18, 4] as [number, number, number],
  },
] as const;

/**
 * Bake neon ring mask and replace SceneDD placeholder glow mats with transparent emissive ones.
 */
export async function ensureChessMoveGlowMaterials(
  device: GPUDevice,
  resourceManager: ResourceManager,
  pbrGraph: ShaderGraph
): Promise<void> {
  const neon = await loadChessMoveGlowTexture(device, resourceManager);
  for (const recipe of CHESS_MOVE_GLOW_RECIPES) {
    createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      recipe.name,
      recipe.tint,
      recipe.emissive
    );
  }
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetchPublicAssetPreferSameOrigin(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return createImageBitmap(await res.blob());
}

function chessPhotoPath(file: string): string {
  return `${PHOTO_TEX}/${file}`;
}

async function loadChessGpuTexture(
  device: GPUDevice,
  file: string,
  options: { generateMips?: boolean; normalMap?: boolean } = {}
): Promise<GPUTexture> {
  const bitmap = await loadBitmap(chessPhotoPath(file));
  return TextureLoader.fromImageBitmap(device, bitmap, {
    flipY: true,
    generateMips: options.generateMips !== false,
    normalMap: options.normalMap === true,
  }).texture;
}

/** glTF ORM: R=AO, G=roughness, B=metallic. */
async function packOrmTexture(
  device: GPUDevice,
  roughnessUrl: string,
  metallic: ImageBitmap | number,
  roughnessRemap?: { bias: number; scale: number }
): Promise<GPUTexture> {
  const roughness = await loadBitmap(roughnessUrl);
  const w = roughness.width;
  const h = roughness.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(roughness, 0, 0);
  const rough = ctx.getImageData(0, 0, w, h).data;
  let metalPx: Uint8ClampedArray | null = null;
  if (typeof metallic !== 'number') {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(metallic, 0, 0, w, h);
    metalPx = ctx.getImageData(0, 0, w, h).data;
  }
  const packed = new ImageData(w, h);
  const metalConst = typeof metallic === 'number' ? Math.round(metallic * 255) : 0;
  const bias = roughnessRemap?.bias ?? 0;
  const scale = roughnessRemap?.scale ?? 1;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    packed.data[o] = 255;
    packed.data[o + 1] = Math.min(255, Math.max(0, bias * 255 + rough[o]! * scale));
    packed.data[o + 2] = metalPx ? metalPx[o]! : metalConst;
    packed.data[o + 3] = 255;
  }
  const bitmap = await createImageBitmap(packed);
  return TextureLoader.fromImageBitmap(device, bitmap, { flipY: true, generateMips: true }).texture;
}

function createPhotoPbrMaterial(
  resourceManager: ResourceManager,
  pbrGraph: ShaderGraph,
  name: string,
  maps: {
    color: GPUTexture;
    normal: GPUTexture;
    orm: GPUTexture;
    metallic: number;
    roughness: number;
    anisotropy: number;
    uvScale?: [number, number];
    normalScale?: number;
    clearcoatFactor?: number;
    clearcoatRoughnessFactor?: number;
  }
): Material {
  const uvScale = maps.uvScale ?? [1, 1];
  const uvOs: [number, number, number, number] = [0, 0, uvScale[0], uvScale[1]];
  const uvRs: [number, number, number, number] = [1, 0, 0, 0];
  const sampler =
    resourceManager['device']?.createSampler?.({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      maxAnisotropy: 8,
    }) ?? undefined;
  const khr: PbrKhrExtensionCompileFlags = { ...CORE_PBR_KHR_FLAGS };
  if (maps.anisotropy > 0) khr.khrMaterialsAnisotropy = true;
  if ((maps.clearcoatFactor ?? 0) > 0) khr.khrMaterialsClearcoat = true;
  const material = new MaterialClass({
    name,
    shadingModel: 'pbr',
    shaderGraph: pbrGraph,
    sampler,
    properties: {
      baseColor: [1, 1, 1],
      baseColorTexture: maps.color,
      normalTexture: maps.normal,
      metallicRoughnessTexture: maps.orm,
      roughness: maps.roughness,
      metallic: maps.metallic,
      normalScale: maps.normalScale ?? 1,
      anisotropy: maps.anisotropy,
      anisotropyRotation: 0,
      clearcoatFactor: maps.clearcoatFactor ?? 0,
      clearcoatRoughnessFactor: maps.clearcoatRoughnessFactor ?? 0,
      uvTfAlbedoOs: uvOs,
      uvTfAlbedoRs: uvRs,
      uvTfNormalOs: uvOs,
      uvTfNormalRs: uvRs,
      uvTfOrmMrOs: uvOs,
      uvTfOrmMrRs: uvRs,
      uvTfOrmAoOs: uvOs,
      uvTfOrmAoRs: uvRs,
      pbrKhrExtensionFlags: khr,
    },
  });
  registerChessPhotoMapSet(resourceManager, name, maps);
  resourceManager.uploadMaterial(material);
  return material;
}

/** Sampled ambientCG maps (Marble020 / Metal010) for match pieces. */
export async function loadChessPhotoPbrMaterials(
  device: GPUDevice,
  resourceManager: ResourceManager,
  pbrGraph: ShaderGraph
): Promise<{ marble: Material; metal: Material }> {
  const [marbleColor, marbleNormal, marbleOrm, metalColor, metalNormal, metalnessBmp] =
    await Promise.all([
      loadChessGpuTexture(device, 'Marble020_1K_Color.jpg'),
      loadChessGpuTexture(device, 'Marble020_1K_NormalGL.jpg', { normalMap: true }),
      packOrmTexture(device, chessPhotoPath('Marble020_1K_Roughness.jpg'), 0),
      loadChessGpuTexture(device, 'Metal010_1K_Color.jpg'),
      loadChessGpuTexture(device, 'Metal010_1K_NormalGL.jpg', { normalMap: true }),
      loadBitmap(chessPhotoPath('Metal010_1K_Metalness.jpg')),
    ]);
  const metalOrm = await packOrmTexture(
    device,
    chessPhotoPath('Metal010_1K_Roughness.jpg'),
    metalnessBmp,
    // Metal010 has dark (mirror) texels; neon studio HDR would otherwise read as chrome streaks.
    { bias: 0.28, scale: 0.46 }
  );
  return {
    marble: createPhotoPbrMaterial(resourceManager, pbrGraph, 'ChessMarblePhotoPBR', {
      color: marbleColor,
      normal: marbleNormal,
      orm: marbleOrm,
      metallic: 0,
      roughness: 1,
      anisotropy: 0,
    }),
    metal: createPhotoPbrMaterial(resourceManager, pbrGraph, 'ChessMetalPhotoPBR', {
      color: metalColor,
      normal: metalNormal,
      orm: metalOrm,
      metallic: 1,
      roughness: 1,
      // Photo maps already carry the brush. KHR aniso + cylindrical UV = a white meridian crack.
      anisotropy: 0,
      uvScale: [3.2, 2.1],
      normalScale: 0.32,
    }),
  };
}

type RgbaMap = { data: Uint8ClampedArray; w: number; h: number };

const BOARD_COMPOSE_SIZE = 2048;

function wrap01(t: number): number {
  return t - Math.floor(t);
}

function bitmapToRgba(bmp: ImageBitmap): RgbaMap {
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return { data: img.data, w: bmp.width, h: bmp.height };
}

function sampleBilinear(map: RgbaMap, u: number, v: number): [number, number, number] {
  const x = wrap01(u) * map.w;
  const y = wrap01(v) * map.h;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const x1 = (x0 + 1) % map.w;
  const y1 = (y0 + 1) % map.h;
  const x0w = ((x0 % map.w) + map.w) % map.w;
  const y0w = ((y0 % map.h) + map.h) % map.h;
  const at = (ix: number, iy: number): [number, number, number] => {
    const o = (iy * map.w + ix) * 4;
    return [map.data[o]!, map.data[o + 1]!, map.data[o + 2]!];
  };
  const a = at(x0w, y0w);
  const b = at(x1, y0w);
  const c = at(x0w, y1);
  const d = at(x1, y1);
  const mix = (p: number, q: number, t: number) => p + (q - p) * t;
  return [
    mix(mix(a[0], b[0], tx), mix(c[0], d[0], tx), ty),
    mix(mix(a[1], b[1], tx), mix(c[1], d[1], tx), ty),
    mix(mix(a[2], b[2], tx), mix(c[2], d[2], tx), ty),
  ];
}

function squareSeed(fx: number, fy: number): number {
  const n = Math.sin(fx * 1.73 * 127.1 + fy * 3.11 * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function encodeNormal(nx: number, ny: number, nz: number): [number, number, number] {
  const len = Math.hypot(nx, ny, nz) || 1;
  return [
    ((nx / len) * 0.5 + 0.5) * 255,
    ((ny / len) * 0.5 + 0.5) * 255,
    ((nz / len) * 0.5 + 0.5) * 255,
  ];
}

async function composeChessBoardWoodMaps(
  device: GPUDevice,
  resourceManager?: ResourceManager
): Promise<{
  color: GPUTexture;
  normal: GPUTexture;
  orm: GPUTexture;
}> {
  const [lightColorBmp, lightNormalBmp, lightRoughBmp, darkColorBmp, darkNormalBmp, darkRoughBmp] =
    await Promise.all([
      loadBitmap(chessPhotoPath('Wood094_1K_Color.jpg')),
      loadBitmap(chessPhotoPath('Wood094_1K_NormalGL.jpg')),
      loadBitmap(chessPhotoPath('Wood094_1K_Roughness.jpg')),
      loadBitmap(chessPhotoPath('Wood051_1K_Color.jpg')),
      loadBitmap(chessPhotoPath('Wood051_1K_NormalGL.jpg')),
      loadBitmap(chessPhotoPath('Wood051_1K_Roughness.jpg')),
    ]);
  const lightColor = bitmapToRgba(lightColorBmp);
  const lightNormal = bitmapToRgba(lightNormalBmp);
  const lightRough = bitmapToRgba(lightRoughBmp);
  const darkColor = bitmapToRgba(darkColorBmp);
  const darkNormal = bitmapToRgba(darkNormalBmp);
  const darkRough = bitmapToRgba(darkRoughBmp);

  const size = BOARD_COMPOSE_SIZE;
  const albedo = new ImageData(size, size);
  const normal = new ImageData(size, size);
  const orm = new ImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const cell = boardAlbedoCell(u, v);
      let su: number;
      let sv: number;
      let rotate = false;
      let colorMap: RgbaMap;
      let normalMap: RgbaMap;
      let roughMap: RgbaMap;
      if (cell.kind === 'frame') {
        su = u * 4.5;
        sv = v * 1.15;
        colorMap = darkColor;
        normalMap = darkNormal;
        roughMap = darkRough;
      } else {
        const seed = squareSeed(cell.fx, cell.fy);
        rotate = !cell.light;
        su = (rotate ? cell.lv : cell.lu) * 1.12 + seed * 0.85;
        sv = (rotate ? cell.lu : cell.lv) * 1.12 + seed * 0.37;
        if (cell.light) {
          colorMap = lightColor;
          normalMap = lightNormal;
          roughMap = lightRough;
        } else {
          colorMap = darkColor;
          normalMap = darkNormal;
          roughMap = darkRough;
        }
      }
      const rgb = sampleBilinear(colorMap, su, sv);
      const nRgb = sampleBilinear(normalMap, su, sv);
      const rRgb = sampleBilinear(roughMap, su, sv);
      let nx = (nRgb[0] / 255) * 2 - 1;
      let ny = (nRgb[1] / 255) * 2 - 1;
      const nz = (nRgb[2] / 255) * 2 - 1;
      if (rotate) {
        const t = nx;
        nx = ny;
        ny = t;
      }
      const nEnc = encodeNormal(nx, ny, nz);
      const o = (y * size + x) * 4;
      albedo.data[o] = rgb[0];
      albedo.data[o + 1] = rgb[1];
      albedo.data[o + 2] = rgb[2];
      albedo.data[o + 3] = 255;
      normal.data[o] = nEnc[0];
      normal.data[o + 1] = nEnc[1];
      normal.data[o + 2] = nEnc[2];
      normal.data[o + 3] = 255;
      orm.data[o] = 255;
      orm.data[o + 1] = rRgb[0];
      orm.data[o + 2] = 0;
      orm.data[o + 3] = 255;
    }
  }

  const [albedoBmp, normalBmp, ormBmp] = await Promise.all([
    createImageBitmap(albedo),
    createImageBitmap(normal),
    createImageBitmap(orm),
  ]);
  const maps = {
    color: TextureLoader.fromImageBitmap(device, albedoBmp, {
      flipY: false,
      generateMips: true,
    }).texture,
    normal: TextureLoader.fromImageBitmap(device, normalBmp, {
      flipY: false,
      generateMips: true,
      normalMap: true,
    }).texture,
    orm: TextureLoader.fromImageBitmap(device, ormBmp, {
      flipY: false,
      generateMips: true,
    }).texture,
  };
  if (resourceManager) {
    registerChessPhotoMapSet(resourceManager, 'ChessBoardWoodPhotoPBR', maps);
  }
  return maps;
}

/** Wood094 / Wood051 checker + Metal048C gold plinth. Fallback is canvas + WoodProceduralPBR. */
export async function loadChessBoardPhotoMaterials(
  device: GPUDevice,
  resourceManager: ResourceManager,
  pbrGraph: ShaderGraph
): Promise<{ top: Material; gold: Material }> {
  const [woodMaps, goldColor, goldNormal, goldMetalBmp] = await Promise.all([
    composeChessBoardWoodMaps(device, resourceManager),
    loadChessGpuTexture(device, 'Metal048C_1K_Color.jpg'),
    loadChessGpuTexture(device, 'Metal048C_1K_NormalGL.jpg', { normalMap: true }),
    loadBitmap(chessPhotoPath('Metal048C_1K_Metalness.jpg')),
  ]);
  const goldOrm = await packOrmTexture(
    device,
    chessPhotoPath('Metal048C_1K_Roughness.jpg'),
    goldMetalBmp,
    // Metal048C roughness is high-contrast pitting; keep a satin gold, not corroded iron.
    { bias: 0.36, scale: 0.22 }
  );
  return {
    top: createPhotoPbrMaterial(resourceManager, pbrGraph, 'ChessBoardWoodPhotoPBR', {
      color: woodMaps.color,
      normal: woodMaps.normal,
      orm: woodMaps.orm,
      metallic: 0,
      roughness: 1,
      anisotropy: 0,
      normalScale: 0.55,
      clearcoatFactor: CHESS_BOARD_CLEARCOAT_FACTOR,
      clearcoatRoughnessFactor: CHESS_BOARD_CLEARCOAT_ROUGHNESS,
    }),
    gold: createPhotoPbrMaterial(resourceManager, pbrGraph, 'ChessBoardGoldPhotoPBR', {
      color: goldColor,
      normal: goldNormal,
      orm: goldOrm,
      metallic: 1,
      roughness: 1,
      anisotropy: 0,
      uvScale: [24 / CHESS_BOARD_MESH_EXTENT, 24 / CHESS_BOARD_MESH_EXTENT],
      normalScale: 0.14,
    }),
  };
}
