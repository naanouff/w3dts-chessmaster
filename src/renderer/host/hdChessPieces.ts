/**
 * @file hdChessPieces.ts
 * @description Staunton pieces authored as Draco GLBs (b_ white, n_ black).
 * Geometry is the scaled `.wmesh` produced by scripts/import-hd-pieces.mjs.
 * Maps are the WebP baked by scripts/bake-piece-textures.mjs. The GLB images
 * are only a fallback when those files are missing.
 */

import {
  CORE_PBR_KHR_FLAGS,
  Material as MaterialClass,
  Mesh,
  TextureLoader,
  type Material,
  type PbrKhrExtensionCompileFlags,
  type ResourceManager,
  type ShaderGraph,
} from '@naanouff/w3dts-core';
import type { ColliderShapeOptions } from '@naanouff/w3dts-physics';
import { CHESS_GROUP_PIECE, CHESS_MASK_PIECE, type ChessColor, type ChessPieceRole } from '../../chess';
import {
  getChessGraphicsSettings,
  registerPieceTextureReloader,
  type ChessTextureQuality,
} from '../graphics/chessGraphicsSettings';
import { roleTextureSize } from '../graphics/texelDensity';

const STRIDE = 20;
const MESH_MAGIC = 0x534d3357;

type MapKind = 'color' | 'normal' | 'orm';

const FILE_BY_PIECE: Record<ChessColor, Record<ChessPieceRole, string>> = {
  white: {
    pawn: 'b_pion',
    rook: 'b_tour',
    knight: 'b_cavalier',
    bishop: 'b_fou',
    queen: 'b_reine',
    king: 'b_roi',
  },
  black: {
    pawn: 'n_pion',
    rook: 'n_tour',
    knight: 'n_cavalier',
    bishop: 'n_fou',
    queen: 'n_reine',
    king: 'n_roi',
  },
};

const ROLES: ChessPieceRole[] = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];

export interface HdChessPiece {
  mesh: Mesh;
  material: Material;
}

export function hdPieceKey(color: ChessColor, role: ChessPieceRole): string {
  return `${color}:${role}`;
}

/** One box around the imported mesh. `size` is half-extents, matching the physics AABB. */
export function hdPieceCollider(mesh: Mesh): ColliderShapeOptions {
  const min = mesh.aabb.min;
  const max = mesh.aabb.max;
  return {
    type: 'AABB',
    size: [
      Math.max(0.004, (max[0] - min[0]) * 0.5),
      Math.max(0.004, (max[1] - min[1]) * 0.5),
      Math.max(0.004, (max[2] - min[2]) * 0.5),
    ],
    offset: [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5],
    collisionGroup: CHESS_GROUP_PIECE,
    collisionMask: CHESS_MASK_PIECE,
  };
}

interface GlbImage {
  mimeType?: string;
  bufferView?: number;
}

interface GlbJson {
  images?: GlbImage[];
  bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
  materials?: Array<{
    pbrMetallicRoughness?: {
      baseColorTexture?: { index: number };
      metallicRoughnessTexture?: { index: number };
    };
    normalTexture?: { index: number };
  }>;
  textures?: Array<{ source: number }>;
}

function parseGlb(buffer: ArrayBuffer): { json: GlbJson; bin: Uint8Array } {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as GlbJson;
  const binStart = 20 + jsonLength + 8;
  return { json, bin: new Uint8Array(buffer, binStart) };
}

function meshFromWmesh(buffer: ArrayBuffer, name: string): Mesh {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MESH_MAGIC) throw new Error(`${name} is not a chess mesh`);
  const vertexCount = view.getUint32(8, true);
  const indexCount = view.getUint32(12, true);
  const vertexBytes = vertexCount * STRIDE * 4;
  const vertices = new Float32Array(buffer, 16, vertexCount * STRIDE);
  const indices = new Uint16Array(buffer, 16 + vertexBytes, indexCount);
  return new Mesh(new Float32Array(vertices), new Uint16Array(indices), name);
}

async function bitmapFromImage(
  bin: Uint8Array,
  json: GlbJson,
  textureIndex: number,
  maxSize: number
): Promise<ImageBitmap> {
  const source = json.textures?.[textureIndex]?.source;
  const image = source === undefined ? undefined : json.images?.[source];
  const bufferView = image?.bufferView;
  const view = bufferView === undefined ? undefined : json.bufferViews?.[bufferView];
  if (!image || !view) throw new Error('GLB texture missing');
  const start = view.byteOffset ?? 0;
  const bytes = bin.slice(start, start + view.byteLength);
  const blob = new Blob([bytes], { type: image.mimeType ?? 'image/png' });
  const probe = await createImageBitmap(blob);
  const longest = Math.max(probe.width, probe.height);
  if (longest <= maxSize) return probe;
  const scale = maxSize / longest;
  const width = Math.max(1, Math.round(probe.width * scale));
  const height = Math.max(1, Math.round(probe.height * scale));
  probe.close();
  return createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
}

function gpuTexture(device: GPUDevice, bitmap: ImageBitmap, normalMap: boolean): GPUTexture {
  const texture = TextureLoader.fromImageBitmap(device, bitmap, {
    flipY: false,
    generateMips: true,
    normalMap,
  }).texture;
  bitmap.close();
  return texture;
}

interface LoadedPiece extends HdChessPiece {
  file: string;
  role: ChessPieceRole;
}

let session: {
  device: GPUDevice;
  resourceManager: ResourceManager;
  pieces: LoadedPiece[];
  quality: ChessTextureQuality;
  generation: number;
} | null = null;
let pendingQuality: ChessTextureQuality | null = null;

async function bakedBitmap(file: string, kind: MapKind, size: number): Promise<ImageBitmap | null> {
  const response = await fetch(`/models/chess/tex/${size}/${file}-${kind}.webp`);
  if (!response.ok) return null;
  return createImageBitmap(await response.blob());
}

async function mapsForPiece(
  file: string,
  size: number
): Promise<[ImageBitmap, ImageBitmap, ImageBitmap]> {
  const baked = await Promise.all([
    bakedBitmap(file, 'color', size),
    bakedBitmap(file, 'normal', size),
    bakedBitmap(file, 'orm', size),
  ]);
  if (baked[0] && baked[1] && baked[2]) {
    return [baked[0], baked[1], baked[2]];
  }
  for (const bitmap of baked) bitmap?.close();

  const glbRes = await fetch(`/models/chess/${file}.glb`);
  if (!glbRes.ok) throw new Error(`missing textures for ${file}`);
  const { json, bin } = parseGlb(await glbRes.arrayBuffer());
  const materialDef = json.materials?.[0];
  const colorIndex = materialDef?.pbrMetallicRoughness?.baseColorTexture?.index ?? 1;
  const normalIndex = materialDef?.normalTexture?.index ?? 0;
  const ormIndex = materialDef?.pbrMetallicRoughness?.metallicRoughnessTexture?.index ?? 2;
  return Promise.all([
    bitmapFromImage(bin, json, colorIndex, size),
    bitmapFromImage(bin, json, normalIndex, size),
    bitmapFromImage(bin, json, ormIndex, size),
  ]);
}

function isGpuTexture(value: unknown): value is GPUTexture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'destroy' in value &&
    'createView' in value
  );
}

function swapTexture(
  device: GPUDevice,
  material: Material,
  key: string,
  next: GPUTexture
): void {
  const previous = material.properties.get(key);
  material.properties.set(key, next);
  if (isGpuTexture(previous) && previous !== next) {
    const old = previous;
    device.queue.onSubmittedWorkDone().then(
      () => old.destroy(),
      () => old.destroy()
    );
  }
}

/**
 * Replaces the three maps on every HD piece from the quality ladder.
 * Queen and king load one step above the pawn. No-op when that tier is already on the GPU.
 * @param quality - Options texture tier.
 */
export async function applyHdPieceTextureQuality(quality: ChessTextureQuality): Promise<void> {
  const current = session;
  if (!current) {
    pendingQuality = quality;
    return;
  }
  if (current.quality === quality) return;
  const ticket = ++current.generation;
  const uploaded = new Map<LoadedPiece, { color: GPUTexture; normal: GPUTexture; orm: GPUTexture }>();
  try {
    for (const piece of current.pieces) {
      const size = roleTextureSize(piece.role, quality);
      const [colorBmp, normalBmp, ormBmp] = await mapsForPiece(piece.file, size);
      if (ticket !== current.generation) {
        colorBmp.close();
        normalBmp.close();
        ormBmp.close();
        return;
      }
      uploaded.set(piece, {
        color: gpuTexture(current.device, colorBmp, false),
        normal: gpuTexture(current.device, normalBmp, true),
        orm: gpuTexture(current.device, ormBmp, false),
      });
    }
  } catch (error) {
    for (const textures of uploaded.values()) {
      textures.color.destroy();
      textures.normal.destroy();
      textures.orm.destroy();
    }
    throw error;
  }
  if (ticket !== current.generation) {
    for (const textures of uploaded.values()) {
      textures.color.destroy();
      textures.normal.destroy();
      textures.orm.destroy();
    }
    return;
  }
  for (const piece of current.pieces) {
    const textures = uploaded.get(piece);
    if (!textures) continue;
    const name = `ChessHd_${piece.file}`;
    swapTexture(current.device, piece.material, 'baseColorTexture', textures.color);
    swapTexture(current.device, piece.material, 'normalTexture', textures.normal);
    swapTexture(current.device, piece.material, 'metallicRoughnessTexture', textures.orm);
    current.resourceManager.registerTexture(`${name}/baseColor`, textures.color);
    current.resourceManager.registerTexture(`${name}/normal`, textures.normal);
    current.resourceManager.registerTexture(`${name}/orm`, textures.orm);
    current.resourceManager.uploadMaterial(piece.material);
  }
  current.quality = quality;
}

/**
 * Loads the twelve HD pieces. Returns null when the imported files are absent
 * so the procedural Staunton set can still boot.
 */
export async function loadHdChessPieces(
  device: GPUDevice,
  resourceManager: ResourceManager,
  pbrGraph: ShaderGraph
): Promise<Map<string, HdChessPiece> | null> {
  const probe = await fetch('/models/chess/b_pion.wmesh');
  if (!probe.ok) return null;

  registerPieceTextureReloader((quality) => {
    void applyHdPieceTextureQuality(quality);
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    maxAnisotropy: 8,
  });
  const khr: PbrKhrExtensionCompileFlags = { ...CORE_PBR_KHR_FLAGS };
  const pieces = new Map<string, HdChessPiece>();
  const loaded: LoadedPiece[] = [];
  const quality = pendingQuality ?? getChessGraphicsSettings().textureQuality;
  pendingQuality = null;

  for (const color of ['white', 'black'] as const) {
    for (const role of ROLES) {
      const file = FILE_BY_PIECE[color][role];
      const meshRes =
        color === 'white' && role === 'pawn' ? probe : await fetch(`/models/chess/${file}.wmesh`);
      if (!meshRes.ok) return null;
      const mesh = meshFromWmesh(await meshRes.arrayBuffer(), `chess-hd-${file}`);
      resourceManager.uploadMesh(mesh);
      const [colorBmp, normalBmp, ormBmp] = await mapsForPiece(file, roleTextureSize(role, quality));
      const baseColorTexture = gpuTexture(device, colorBmp, false);
      const normalTexture = gpuTexture(device, normalBmp, true);
      const metallicRoughnessTexture = gpuTexture(device, ormBmp, false);
      const name = `ChessHd_${file}`;
      resourceManager.registerTexture(`${name}/baseColor`, baseColorTexture);
      resourceManager.registerTexture(`${name}/normal`, normalTexture);
      resourceManager.registerTexture(`${name}/orm`, metallicRoughnessTexture);
      const uvOs: [number, number, number, number] = [0, 0, 1, 1];
      const uvRs: [number, number, number, number] = [1, 0, 0, 0];
      const material = new MaterialClass({
        name,
        shadingModel: 'pbr',
        shaderGraph: pbrGraph,
        sampler,
        properties: {
          baseColor: [1, 1, 1],
          baseColorTexture,
          normalTexture,
          metallicRoughnessTexture,
          roughness: 1,
          metallic: 1,
          normalScale: 1,
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
      resourceManager.uploadMaterial(material);
      const piece = { mesh, material, file, role };
      loaded.push(piece);
      pieces.set(hdPieceKey(color, role), piece);
    }
  }

  session = { device, resourceManager, pieces: loaded, quality, generation: 0 };
  if (pendingQuality !== null && pendingQuality !== quality) {
    const next = pendingQuality;
    pendingQuality = null;
    void applyHdPieceTextureQuality(next);
  }
  return pieces;
}
