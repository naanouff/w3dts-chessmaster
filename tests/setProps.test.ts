/**
 * @file setProps.test.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Scale, texture tiers and emissive contract for the first three sets.
 */

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { pieceTextureSize } from '../src/renderer/graphics/chessGraphicsSettings';
import { cleanGlb } from '../scripts/clean-set-props.mjs';
import {
  DRACO_VERTEX_THRESHOLD,
  EMISSIVE_LUMA_THRESHOLD,
  SET_PROPS,
  SET_TEXTURE_SIZES,
  emissiveFromAlbedo,
  needsDraco,
  scaleOf,
  setProp,
  srgbChannelToLinear,
} from '../scripts/setProps.mjs';

function glbChunk(json: object, bin: Buffer): Buffer {
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + bin.length + binPad;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length + jsonPad, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuf.copy(out, 20);
  out.fill(0x20, 20 + jsonBuf.length, 20 + jsonBuf.length + jsonPad);
  const binAt = 20 + jsonBuf.length + jsonPad;
  out.writeUInt32LE(bin.length + binPad, binAt);
  out.writeUInt32LE(0x004e4942, binAt + 4);
  bin.copy(out, binAt + 8);
  return out;
}

async function sampleGlb(): Promise<Buffer> {
  const positions = Buffer.alloc(9 * 4);
  const xyz = [0, 0, 0, 1, 0, 0, 0, 0.4, 0];
  xyz.forEach((value, index) => positions.writeFloatLE(value, index * 4));
  const normals = Buffer.alloc(9 * 4);
  for (let i = 0; i < 3; i++) normals.writeFloatLE(1, (i * 3 + 1) * 4);
  const uvs = Buffer.alloc(6 * 4);
  const indices = Buffer.from(new Uint16Array([0, 1, 2]).buffer);
  const image = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 2, height: 2, channels: 3, background: { r: 240, g: 240, b: 240 } },
        })
          .jpeg()
          .toBuffer(),
        left: 0,
        top: 0,
      },
    ])
    .jpeg()
    .toBuffer();
  const bin = Buffer.concat([positions, normals, uvs, indices, image]);
  const view = (byteOffset: number, byteLength: number) => ({ buffer: 0, byteOffset, byteLength });
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      view(0, positions.length),
      view(positions.length, normals.length),
      view(positions.length + normals.length, uvs.length),
      view(positions.length + normals.length + uvs.length, indices.length),
      view(positions.length + normals.length + uvs.length + indices.length, image.length),
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 0.4, 0],
      },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    images: [{ mimeType: 'image/jpeg', bufferView: 4 }],
    textures: [{ source: 0 }],
    materials: [
      {
        pbrMetallicRoughness: {
          metallicFactor: 1,
          roughnessFactor: 1,
          baseColorTexture: { index: 0 },
        },
        emissiveFactor: [0, 0, 0],
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  return glbChunk(json, bin);
}

function parseGlb(file: Buffer): { json: any; bin: Buffer } {
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength + 8;
  const binLength = file.readUInt32LE(20 + jsonLength);
  return { json, bin: file.subarray(binStart, binStart + binLength) };
}

describe('set prop cleanup', () => {
  it('uses the piece texture ladder and skips Draco below 20000 vertices', () => {
    expect(SET_TEXTURE_SIZES).toEqual([
      pieceTextureSize('low'),
      pieceTextureSize('medium'),
      pieceTextureSize('high'),
    ]);
    expect(DRACO_VERTEX_THRESHOLD).toBe(20000);
    expect(needsDraco(5894)).toBe(false);
    expect(needsDraco(20000)).toBe(true);
  });

  it('scales a span to the documented length', () => {
    expect(scaleOf([0, -0.2, 0], [1, 0.2, 0.5], 0, 1.8)).toBeCloseTo(1.8);
    expect(scaleOf([-0.5, -0.2, -0.3], [0.5, 0.193, 0.3], 1, 1.1)).toBeCloseTo(1.1 / 0.393);
  });

  it('keeps a bright texel and blacks out the rest', () => {
    const rgb = new Uint8Array([10, 10, 10, 240, 240, 240, 200, 200, 200]);
    const out = emissiveFromAlbedo(rgb, EMISSIVE_LUMA_THRESHOLD);
    expect([...out]).toEqual([0, 0, 0, 240, 240, 240, 0, 0, 0]);
  });

  it('assigns a length and an emissive mode to each prop of the first three sets', () => {
    expect(SET_PROPS.filter((prop) => prop.scene === 'atelier').map((prop) => prop.file)).toEqual([
      'table',
      'plateau-toile',
      'tabouret',
      'softbox',
      'projecteur',
      'cyclorama',
    ]);
    expect(SET_PROPS.filter((prop) => prop.scene === 'salon')).toHaveLength(8);
    expect(SET_PROPS.filter((prop) => prop.scene === 'club')).toHaveLength(7);
    expect(setProp('atelier', 'table')).toMatchObject({ axis: 0, metres: 1.8 });
    expect(setProp('atelier', 'softbox')).toMatchObject({ axis: 1, metres: 1.2, emissive: { mode: 'mask' } });
    expect(setProp('atelier', 'projecteur')).toMatchObject({ axis: 1, metres: 1.6, emissive: { mode: 'mask' } });
    expect(setProp('salon', 'lampe').emissive.mode).toBe('mask');
    expect(setProp('salon', 'cheminee').emissive.mode).toBe('none');
    expect(setProp('club', 'rail').emissive).toMatchObject({ mode: 'factor', color: [0, 0.95, 1] });
    expect(setProp('club', 'tube').emissive).toMatchObject({ mode: 'factor', color: [1, 1, 1] });
    expect(setProp('club', 'enseigne')).toMatchObject({ axis: 0, metres: 0.6, emissive: { mode: 'mask' } });
    expect(setProp('club', 'bouteilles')).toMatchObject({ axis: 1, metres: 0.3 });
    for (const prop of SET_PROPS) {
      expect(prop.metres).toBeGreaterThan(0);
      if (prop.emissive.mode !== 'none') expect(prop.emissive.strength).toBeGreaterThan(0);
    }
  });

  it('converts sRGB cyan toward linear', () => {
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(srgbChannelToLinear(1)).toBe(1);
    expect(srgbChannelToLinear(0.95)).toBeGreaterThan(0.8);
    expect(srgbChannelToLinear(0.95)).toBeLessThan(0.95);
  });

  it('scales a mesh and adds an emissive mask without Draco', async () => {
    const cleaned = await cleanGlb(await sampleGlb(), setProp('atelier', 'softbox'), 8);
    const { json, bin } = parseGlb(cleaned);
    const view = json.bufferViews[json.accessors[0].bufferView];
    const y = bin.readFloatLE((view.byteOffset ?? 0) + (2 * 3 + 1) * 4);
    expect(y).toBeCloseTo(1.2);
    expect(json.materials[0].pbrMetallicRoughness.metallicFactor).toBe(1);
    expect(json.materials[0].emissiveTexture.index).toBeGreaterThanOrEqual(0);
    expect(json.materials[0].extensions.KHR_materials_emissive_strength.emissiveStrength).toBeGreaterThan(0);
    expect(json.extensions?.KHR_draco_mesh_compression).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain('KHR_draco_mesh_compression');
    const imageView = json.bufferViews[json.images[0].bufferView];
    const jpeg = bin.subarray(imageView.byteOffset, imageView.byteOffset + imageView.byteLength);
    const meta = await sharp(jpeg).metadata();
    expect(meta.width).toBe(8);
    expect(meta.height).toBe(8);
  });

  it('paints the rail cyan and leaves the fireplace dark', async () => {
    const source = await sampleGlb();
    const rail = parseGlb(await cleanGlb(source, setProp('club', 'rail'), 8)).json;
    expect(rail.materials[0].emissiveTexture).toBeUndefined();
    expect(rail.materials[0].emissiveFactor[1]).toBeCloseTo(srgbChannelToLinear(0.95));
    expect(rail.materials[0].emissiveFactor[2]).toBeCloseTo(1);
    const hearth = parseGlb(await cleanGlb(source, setProp('salon', 'cheminee'), 8)).json;
    expect(hearth.materials[0].emissiveFactor).toEqual([0, 0, 0]);
    expect(hearth.materials[0].emissiveTexture).toBeUndefined();
    expect(hearth.extensionsUsed ?? []).not.toContain('KHR_materials_emissive_strength');
  });
});
