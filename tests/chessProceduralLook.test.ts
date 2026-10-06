/**
 * @file chessProceduralLook.test.ts
 * @description CHESS-B4d: marble / brushed-steel Shader Graphs + MeshMaps vertex colors.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  CORE_PBR_KHR_FLAGS,
  ShaderGraphCompiler,
  ShaderLoader,
  STANDARD_MESH_VERTEX_FLOATS,
  usesTransparentRenderQueue,
  validateShaderGraphShape,
  type Mesh,
  type ShaderGraph,
} from '@naanouff/w3dts-core';
import {
  buildChessBoardBodyMesh,
  buildStauntonPieceMesh,
  createBrushedSteelProceduralPBRGraph,
  createMarbleProceduralPBRGraph,
} from '../src/chess/index';
import {
  CHESS_MOVE_GLOW_RECIPES,
  chessBoardCheckerPlacement,
  chessBoardSurfaceMaterials,
  chessCutoutMaterial,
} from '../src/renderer/host/chessLook';

const repoPublic = join(dirname(fileURLToPath(import.meta.url)), '../public');
const shaderDir = join(repoPublic, 'shader-graphs');
const shadersRoot = join(repoPublic, 'shaders');
const STRIDE = STANDARD_MESH_VERTEX_FLOATS;

const mockLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() } as never;

(ShaderLoader as unknown as { load: (path: string) => Promise<string> }).load = async (path: string) => {
  const rel = path.replace(/^\/shaders\//, '');
  const filePath = join(shadersRoot, rel);
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    if (path.endsWith('graph_vertex.vert.wgsl')) {
      return `// vertex\n// [[VERTEX_FUNCTION_BODY]]\n// [[VERTEX_MASTER_NODE_LOGIC]]`;
    }
    if (path.endsWith('main_shader.wgsl')) {
      return `{{graph_id}}\n// [[DEFINES]]\n// [[UTILITY_FUNCTIONS]]\n// [[MATERIAL_UNIFORMS_STRUCT]]\n// [[TEXTURE_BINDINGS]]\n// [[FUNCTION_BODY]]`;
    }
    return '';
  }
};

function colorSpread(mesh: Mesh, channel: 0 | 1 | 2 | 3): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const v = mesh.vertices;
  for (let i = 0; i < v.length; i += STRIDE) {
    const c = v[i + 16 + channel]!;
    min = Math.min(min, c);
    max = Math.max(max, c);
  }
  return max - min;
}

async function compileGraph(graph: ShaderGraph): Promise<string> {
  const compiler = new ShaderGraphCompiler(mockLogger);
  await compiler.initialize();
  const result = await compiler.compile(graph, {} as never, {
    alphaMode: 'OPAQUE',
    hasShadows: false,
    hasIBL: false,
  });
  return result.fragmentWGSL;
}

describe('chess procedural look', () => {
  it('publishes marble and brushed-steel shader graphs', () => {
    const marble = createMarbleProceduralPBRGraph();
    const steel = createBrushedSteelProceduralPBRGraph();
    expect(marble.id).toBe('MarbleProceduralPBR');
    expect(steel.id).toBe('BrushedSteelProceduralPBR');
    expect(marble.properties?.normalDetailScale?.defaultValue).toBe(0);
    expect(steel.properties?.normalDetailScale?.defaultValue).toBe(0);
    expect(marble.nodes.some((n) => n.type === 'MeshMaps')).toBe(true);
    expect(steel.nodes.some((n) => n.type === 'MeshMaps')).toBe(true);
    expect(marble.nodes.some((n) => n.data?.functionName === 'marble_look')).toBe(true);
    expect(steel.nodes.some((n) => n.type === 'BlendNormalDetail')).toBe(false);
    expect(
      marble.connections.some(
        (c) => c.toNodeId === 'pbr_master' && c.toSocketId === 'normal' && c.fromNodeId === 'world_n'
      )
    ).toBe(true);
    expect(steel.nodes.some((n) => n.id === 'prop_aniso')).toBe(true);
    expect(steel.nodes.some((n) => n.data?.functionName === 'brushed_steel_look')).toBe(true);
    expect(steel.properties?.anisotropy?.defaultValue).toBe(0.88);
    expect(steel.properties?.anisotropyRotation?.defaultValue).toBe(0);
    expect(steel.properties?.triplanarScale?.defaultValue).toBe(1.4);
    expect(validateShaderGraphShape(marble).valid).toBe(true);
    expect(validateShaderGraphShape(steel).valid).toBe(true);

    const marblePath = join(shaderDir, 'MarbleProceduralPBR.json');
    const steelPath = join(shaderDir, 'BrushedSteelProceduralPBR.json');
    writeFileSync(marblePath, `${JSON.stringify(marble, null, 2)}\n`);
    writeFileSync(steelPath, `${JSON.stringify(steel, null, 2)}\n`);
    expect(JSON.parse(readFileSync(marblePath, 'utf8')).id).toBe(marble.id);
    expect(JSON.parse(readFileSync(steelPath, 'utf8')).id).toBe(steel.id);
  });

  it('compiles marble and steel graphs with MeshMaps (smooth world normals)', async () => {
    const marbleWgsl = await compileGraph(createMarbleProceduralPBRGraph());
    const steelWgsl = await compileGraph(createBrushedSteelProceduralPBRGraph());
    expect(marbleWgsl).toContain('unpack_mesh_maps');
    expect(marbleWgsl).toContain('marble_look');
    expect(marbleWgsl).toContain('input.color');
    expect(marbleWgsl).toContain('input.inverseModel_r1');
    expect(steelWgsl).toContain('unpack_mesh_maps');
    expect(steelWgsl).toContain('brushed_steel_look');
    expect(steelWgsl).toMatch(/anisotropy/i);
  });

  it('compiles steel with KHR anisotropy enabled', async () => {
    const compiler = new ShaderGraphCompiler(mockLogger);
    await compiler.initialize();
    const result = await compiler.compile(createBrushedSteelProceduralPBRGraph(), {} as never, {
      alphaMode: 'OPAQUE',
      hasShadows: false,
      hasIBL: false,
      pbrKhrExtensions: { ...CORE_PBR_KHR_FLAGS, khrMaterialsAnisotropy: true },
    });
    expect(result.fragmentWGSL).toContain('anisotropyTexture');
  });

  it('bakes non-uniform MeshMaps vertex colors on lathe, knight, and board', () => {
    const rook = buildStauntonPieceMesh('rook');
    const knight = buildStauntonPieceMesh('knight');
    const board = buildChessBoardBodyMesh();
    expect(colorSpread(rook, 0) + colorSpread(rook, 1) + colorSpread(rook, 2)).toBeGreaterThan(0.02);
    expect(colorSpread(knight, 0) + colorSpread(knight, 1) + colorSpread(knight, 2)).toBeGreaterThan(
      0.02
    );
    // Convex chamfered slab: RGB maps are nearly flat; height (A) still spans the body.
    expect(colorSpread(board, 3)).toBeGreaterThan(0.5);
  });

  it('keeps a move square bright enough to bloom without flooding the square', () => {
    for (const recipe of CHESS_MOVE_GLOW_RECIPES) {
      const peak = Math.max(...recipe.emissive);
      expect(peak).toBeGreaterThan(1);
      expect(peak).toBeLessThanOrEqual(2.5);
    }
  });
});

describe('board surface materials', () => {
  it('uses the photo wood checker and the gold plinth when the PBR maps load', () => {
    const photo = { top: 'wood-pbr', gold: 'gold-pbr' };
    const fallback = { top: 'canvas', rim: 'wood-graph' };
    expect(chessBoardSurfaceMaterials(photo, fallback)).toEqual({
      top: 'wood-pbr',
      rim: 'gold-pbr',
    });
  });

  it('uses the painted checker only when the PBR maps are missing', () => {
    const fallback = { top: 'canvas', rim: 'wood-graph' };
    expect(chessBoardSurfaceMaterials(null, fallback)).toEqual(fallback);
  });

  it('puts the photo checker on the piece bases without shadowing itself', () => {
    expect(chessBoardCheckerPlacement()).toEqual({
      y: 0.001,
      castShadow: false,
      doubleSided: true,
    });
  });
});

describe('coach cutout', () => {
  it('queues the coach mask so the cutout pass can draw it', () => {
    const material = chessCutoutMaterial('ChessCutout-0', [0.15, 0.95, 0.28]);
    expect(material.properties.get('tag')).toBe('coach_mask');
    expect(material.properties.get('opacity')).toBe(1);
    // Opaque meshes are batched and never reach a custom queue. Blend enters that queue.
    expect(usesTransparentRenderQueue(material)).toBe(true);
  });
});
