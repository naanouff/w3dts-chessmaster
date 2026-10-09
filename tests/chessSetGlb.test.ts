/**
 * @file chessSetGlb.test.ts
 * @description A non-Draco set GLB becomes the engine vertex layout, and anchors sit on the table.
 */

import { describe, expect, it } from 'vitest';
import {
  cycloramaMesh,
  fetchChessSetBuffers,
  meshFromSetGlb,
  placeSetProp,
  setMapTextureFormat,
  setPropRotation,
} from '../src/renderer/host/chessSetGlb';

function packTriangle(): ArrayBuffer {
  const positions = new Float32Array([0, 1, 0, 1, 0, 0, 0, 0, 1]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const indices = new Uint16Array([0, 1, 2]);
  const bin = new Uint8Array(positions.byteLength + uvs.byteLength + normals.byteLength + indices.byteLength);
  bin.set(new Uint8Array(positions.buffer), 0);
  bin.set(new Uint8Array(uvs.buffer), positions.byteLength);
  bin.set(new Uint8Array(normals.buffer), positions.byteLength + uvs.byteLength);
  const indexAt = positions.byteLength + uvs.byteLength + normals.byteLength;
  bin.set(new Uint8Array(indices.buffer), indexAt);
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { byteOffset: 0, byteLength: positions.byteLength },
      { byteOffset: positions.byteLength, byteLength: uvs.byteLength },
      { byteOffset: positions.byteLength + uvs.byteLength, byteLength: normals.byteLength },
      { byteOffset: indexAt, byteLength: indices.byteLength },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1, NORMAL: 2 }, indices: 3 }] }],
  };
  const jsonBuf = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + bin.byteLength;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBuf.length + jsonPad, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jsonBuf.length).set(jsonBuf);
  const binAt = 20 + jsonBuf.length + jsonPad;
  view.setUint32(binAt, bin.byteLength, true);
  view.setUint32(binAt + 4, 0x004e4942, true);
  new Uint8Array(out, binAt + 8, bin.byteLength).set(bin);
  return out;
}

describe('set glb', () => {
  it('reads a triangle into the 20-float vertex layout', () => {
    const mesh = meshFromSetGlb(packTriangle());
    expect(mesh.indices).toEqual(new Uint16Array([0, 1, 2]));
    expect(mesh.vertices.length).toBe(60);
    expect(mesh.vertices[0]).toBeCloseTo(0);
    expect(mesh.vertices[1]).toBeCloseTo(1);
    expect(mesh.vertices[2]).toBeCloseTo(0);
    expect(mesh.vertices[7]).toBeCloseTo(0);
    expect(mesh.vertices[8]).toBeCloseTo(1);
  });

  it('puts the top of a table on the playing surface', () => {
    const placed = placeSetProp([0, -0.74, 0], [0.9, 0, 0.45], { file: 'table', anchor: 'top' }, -0.74);
    expect(placed.x).toBe(0);
    expect(placed.y).toBeCloseTo(0);
    expect(placed.z).toBe(0);
  });

  it('drops a top-anchored cloth just under the board', () => {
    const placed = placeSetProp([0, 0, 0], [1, 0.02, 1], { file: 'napperon', anchor: 'top', lift: -0.001 }, -0.74);
    expect(placed.y + 0.02).toBeCloseTo(-0.001);
  });

  it('sits a floor prop on the feet of the table', () => {
    const placed = placeSetProp([0, 0, 0], [0.4, 0.45, 0.4], { file: 'tabouret', anchor: 'floor', x: 0, z: 2.05 }, -0.74);
    expect(placed.y).toBeCloseTo(-0.74);
    expect(placed.z).toBeCloseTo(2.05);
  });

  it('keeps the cloth when one baked prop is missing', async () => {
    const loaded = await fetchChessSetBuffers('atelier', 'low', async (url) => {
      if (url.endsWith('/tabouret.glb')) return null;
      return new ArrayBuffer(8);
    });
    expect(loaded).toBeNull();
  });

  it('loads each prop file once at its scene density size', async () => {
    const urls: string[] = [];
    const loaded = await fetchChessSetBuffers('atelier', 'low', async (url) => {
      urls.push(url);
      return new ArrayBuffer(4);
    });
    expect(urls).toEqual([
      '/sets/atelier/1024/table.glb',
      '/sets/atelier/256/plateau-toile.glb',
      '/sets/atelier/256/tabouret.glb',
      '/sets/atelier/512/softbox.glb',
      '/sets/atelier/1024/projecteur.glb',
    ]);
    expect(loaded?.size).toBe(5);
  });

  it('falls back to a neighbour bake size when the density pick is missing', async () => {
    const urls: string[] = [];
    const loaded = await fetchChessSetBuffers('atelier', 'low', async (url) => {
      urls.push(url);
      if (url.includes('/1024/table.glb')) return null;
      return new ArrayBuffer(4);
    });
    expect(urls[0]).toBe('/sets/atelier/1024/table.glb');
    expect(urls).toContain('/sets/atelier/512/table.glb');
    expect(loaded?.get('table')).toBeInstanceOf(ArrayBuffer);
  });

  it('builds a cove with a quarter circle', () => {
    const cove = cycloramaMesh(1.85);
    expect(cove.vertices.length).toBeGreaterThan(20 * 20);
    expect(cove.indices.length % 3).toBe(0);
  });

  it('turns a prop by the yaw it was given, in radians', () => {
    const half = setPropRotation(Math.PI, 0);
    expect(half[1]).toBeCloseTo(1);
    expect(half[3]).toBeCloseTo(0);
    const quarter = setPropRotation(Math.PI / 2, 0);
    expect(quarter[1]).toBeCloseTo(Math.SQRT1_2);
    expect(quarter[3]).toBeCloseTo(Math.SQRT1_2);
    expect(setPropRotation(0, 0)).toEqual([0, 0, 0, 1]);
    const rolled = setPropRotation(0, Math.PI / 2);
    expect(rolled[2]).toBeCloseTo(Math.SQRT1_2);
  });

  it('decodes the baked color and emissive maps, and leaves the data maps linear', () => {
    expect(setMapTextureFormat('color')).toBe('rgba8unorm-srgb');
    expect(setMapTextureFormat('emissive')).toBe('rgba8unorm-srgb');
    expect(setMapTextureFormat('normal')).toBe('rgba8unorm');
    expect(setMapTextureFormat('orm')).toBe('rgba8unorm');
  });
});
