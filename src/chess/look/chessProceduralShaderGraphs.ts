/**
 * @file chessProceduralShaderGraphs.ts
 * @project w3dts
 * @description Marble / brushed-steel Shader Graphs for Staunton pieces (CHESS-B4d).
 */

import type { ShaderGraph, ShaderGraphConnection, ShaderGraphNode } from '@naanouff/w3dts-core';

export const MARBLE_PBR_SHADER_ID = 'MarbleProceduralPBR';
export const STEEL_PBR_SHADER_ID = 'BrushedSteelProceduralPBR';

function sock(
  id: string,
  name: string,
  dataType: 'f32' | 'vec2f' | 'vec3f' | 'vec4f'
): { id: string; name: string; dataType: 'f32' | 'vec2f' | 'vec3f' | 'vec4f' } {
  return { id, name, dataType };
}

function node(
  id: string,
  type: string,
  x: number,
  y: number,
  rest: Partial<ShaderGraphNode> & Pick<ShaderGraphNode, 'inputs' | 'outputs'>
): ShaderGraphNode {
  return { id, type, stage: 'fragment', position: { x, y }, ...rest };
}

function conn(
  fromNodeId: string,
  fromSocketId: string,
  toNodeId: string,
  toSocketId: string
): ShaderGraphConnection {
  return { fromNodeId, fromSocketId, toNodeId, toSocketId };
}

export function createMarbleProceduralPBRGraph(): ShaderGraph {
  return buildMarbleGraph();
}

function buildMarbleGraph(): ShaderGraph {
  const properties: ShaderGraph['properties'] = {
    seed: { name: 'Seed', type: 'f32', defaultValue: 11 },
    triplanarScale: { name: 'Triplanar Scale', type: 'f32', defaultValue: 2.4 },
    aoStrength: { name: 'AO Strength', type: 'f32', defaultValue: 0.22 },
    heightInfluence: { name: 'Height Roughness', type: 'f32', defaultValue: 0.02 },
    normalDetailScale: { name: 'Normal Detail Scale', type: 'f32', defaultValue: 0 },
    baseColor: {
      name: 'Marble Color',
      type: 'vec3f',
      defaultValue: [0.84, 0.78, 0.68],
    },
    accentColor: {
      name: 'Rust Vein',
      type: 'vec3f',
      defaultValue: [0.45, 0.28, 0.2],
    },
    wearColor: {
      name: 'Grey Vein',
      type: 'vec3f',
      defaultValue: [0.4, 0.38, 0.36],
    },
    edgeWear: { name: 'Edge Wear', type: 'f32', defaultValue: 0.04 },
    roughness: { name: 'Roughness', type: 'f32', defaultValue: 0.22 },
    metallic: { name: 'Metallic', type: 'f32', defaultValue: 0 },
    opacity: { name: 'Opacity', type: 'f32', defaultValue: 1 },
  };

  const nodes: ShaderGraphNode[] = [
    node('pbr_master', 'PBRMasterNode', 1680, 200, {
      inputs: [
        sock('albedo', 'Albedo', 'vec4f'),
        sock('opacity', 'Opacity', 'f32'),
        sock('normal', 'Normal', 'vec3f'),
        sock('roughness_factor', 'Roughness F', 'f32'),
        sock('metallic_factor', 'Metallic F', 'f32'),
      ],
      outputs: [],
    }),
    node('obj_pos', 'GetObjectPosition', 0, 0, {
      inputs: [],
      outputs: [sock('pos', 'Position', 'vec3f')],
    }),
    node('prop_scale', 'Property', 180, 80, {
      data: { propertyName: 'triplanarScale' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('prop_seed', 'Property', 180, 160, {
      data: { propertyName: 'seed' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('marble_fn', 'CustomFunction', 380, 40, {
      data: { functionName: 'marble_look' },
      inputs: [
        sock('pos', 'Position', 'vec3f'),
        sock('seed', 'Seed', 'f32'),
        sock('scale', 'Scale', 'f32'),
      ],
      outputs: [sock('out', 'Look', 'vec4f')],
    }),
    node('split_mar', 'SplitVec4', 560, 40, {
      inputs: [sock('in', 'In', 'vec4f')],
      outputs: [
        sock('x', 'Rust', 'f32'),
        sock('y', 'Grey', 'f32'),
        sock('z', 'Cloud', 'f32'),
        sock('w', 'Rough', 'f32'),
      ],
    }),
    node('vertex_color', 'VertexColor', 0, 280, {
      inputs: [],
      outputs: [sock('color', 'Color', 'vec4f')],
    }),
    node('mesh_maps', 'MeshMaps', 220, 280, {
      inputs: [sock('color', 'Vertex Color', 'vec4f')],
      outputs: [
        sock('concavity', 'Concavity', 'f32'),
        sock('convexity', 'Convexity', 'f32'),
        sock('ao', 'AO', 'f32'),
        sock('height', 'Height', 'f32'),
      ],
    }),
    node('world_n', 'GetWorldNormal', 0, 520, {
      inputs: [],
      outputs: [sock('norm', 'Normal', 'vec3f')],
    }),
    node('prop_base', 'Property', 760, 160, {
      data: { propertyName: 'baseColor' },
      inputs: [],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_accent', 'Property', 760, 240, {
      data: { propertyName: 'accentColor' },
      inputs: [],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_wear', 'Property', 760, 320, {
      data: { propertyName: 'wearColor' },
      inputs: [],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('cloud_k', 'ConstantFloat', 760, 400, {
      data: { value: 0.22 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('cloud_amt', 'Multiply', 980, 120, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('lerp_cloud', 'Lerp', 1140, 80, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'vec3f'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('lerp_grey', 'Lerp', 1140, 200, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'vec3f'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('lerp_rust', 'Lerp', 1140, 320, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'vec3f'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_ao_str', 'Property', 1140, 440, {
      data: { propertyName: 'aoStrength' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('one', 'ConstantFloat', 1140, 520, {
      data: { value: 1 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('ao_mix', 'Lerp', 1320, 400, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('mul_ao_color', 'Multiply', 1480, 200, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_edge', 'Property', 1140, 600, {
      data: { propertyName: 'edgeWear' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('wear_amt', 'Multiply', 1320, 560, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('lerp_wear', 'Lerp', 1480, 320, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'vec3f'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('split_alb', 'SplitVec3', 1480, 80, {
      inputs: [sock('in', 'In', 'vec3f')],
      outputs: [sock('x', 'X', 'f32'), sock('y', 'Y', 'f32'), sock('z', 'Z', 'f32')],
    }),
    node('prop_opacity', 'Property', 1480, 640, {
      data: { propertyName: 'opacity' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('alb_rgba', 'Combine', 1600, 80, {
      inputs: [
        sock('r', 'R', 'f32'),
        sock('g', 'G', 'f32'),
        sock('b', 'B', 'f32'),
        sock('a', 'A', 'f32'),
      ],
      outputs: [sock('out', 'Out', 'vec4f')],
    }),
    node('prop_rough', 'Property', 1140, 720, {
      data: { propertyName: 'roughness' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('add_rough', 'Add', 1320, 720, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('cavity_k', 'ConstantFloat', 1140, 840, {
      data: { value: 0.08 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('cavity_rough', 'Multiply', 1320, 800, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('add_cavity_r', 'Add', 1480, 720, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('clamp_rough', 'Clamp', 1600, 720, {
      inputs: [sock('in', 'In', 'f32'), sock('min', 'Min', 'f32'), sock('max', 'Max', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('zero', 'ConstantFloat', 1480, 880, {
      data: { value: 0 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('prop_metal', 'Property', 1480, 960, {
      data: { propertyName: 'metallic' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
  ];

  const connections: ShaderGraphConnection[] = [
    conn('obj_pos', 'pos', 'marble_fn', 'pos'),
    conn('prop_seed', 'out', 'marble_fn', 'seed'),
    conn('prop_scale', 'out', 'marble_fn', 'scale'),
    conn('marble_fn', 'out', 'split_mar', 'in'),
    conn('vertex_color', 'color', 'mesh_maps', 'color'),
    conn('split_mar', 'z', 'cloud_amt', 'a'),
    conn('cloud_k', 'out', 'cloud_amt', 'b'),
    conn('prop_base', 'out', 'lerp_cloud', 'a'),
    conn('prop_wear', 'out', 'lerp_cloud', 'b'),
    conn('cloud_amt', 'out', 'lerp_cloud', 't'),
    conn('lerp_cloud', 'out', 'lerp_grey', 'a'),
    conn('prop_wear', 'out', 'lerp_grey', 'b'),
    conn('split_mar', 'y', 'lerp_grey', 't'),
    conn('lerp_grey', 'out', 'lerp_rust', 'a'),
    conn('prop_accent', 'out', 'lerp_rust', 'b'),
    conn('split_mar', 'x', 'lerp_rust', 't'),
    conn('one', 'out', 'ao_mix', 'a'),
    conn('mesh_maps', 'ao', 'ao_mix', 'b'),
    conn('prop_ao_str', 'out', 'ao_mix', 't'),
    conn('lerp_rust', 'out', 'mul_ao_color', 'a'),
    conn('ao_mix', 'out', 'mul_ao_color', 'b'),
    conn('mesh_maps', 'convexity', 'wear_amt', 'a'),
    conn('prop_edge', 'out', 'wear_amt', 'b'),
    conn('mul_ao_color', 'out', 'lerp_wear', 'a'),
    conn('prop_base', 'out', 'lerp_wear', 'b'),
    conn('wear_amt', 'out', 'lerp_wear', 't'),
    conn('lerp_wear', 'out', 'split_alb', 'in'),
    conn('split_alb', 'x', 'alb_rgba', 'r'),
    conn('split_alb', 'y', 'alb_rgba', 'g'),
    conn('split_alb', 'z', 'alb_rgba', 'b'),
    conn('prop_opacity', 'out', 'alb_rgba', 'a'),
    conn('prop_rough', 'out', 'add_rough', 'a'),
    conn('split_mar', 'w', 'add_rough', 'b'),
    conn('mesh_maps', 'concavity', 'cavity_rough', 'a'),
    conn('cavity_k', 'out', 'cavity_rough', 'b'),
    conn('add_rough', 'out', 'add_cavity_r', 'a'),
    conn('cavity_rough', 'out', 'add_cavity_r', 'b'),
    conn('add_cavity_r', 'out', 'clamp_rough', 'in'),
    conn('zero', 'out', 'clamp_rough', 'min'),
    conn('one', 'out', 'clamp_rough', 'max'),
    conn('alb_rgba', 'out', 'pbr_master', 'albedo'),
    conn('prop_opacity', 'out', 'pbr_master', 'opacity'),
    conn('world_n', 'norm', 'pbr_master', 'normal'),
    conn('clamp_rough', 'out', 'pbr_master', 'roughness_factor'),
    conn('prop_metal', 'out', 'pbr_master', 'metallic_factor'),
  ];

  return { id: MARBLE_PBR_SHADER_ID, properties, nodes, connections };
}

function buildSteelGraph(): ShaderGraph {
  const properties: ShaderGraph['properties'] = {
    seed: { name: 'Seed', type: 'f32', defaultValue: 7 },
    triplanarScale: { name: 'Triplanar Scale', type: 'f32', defaultValue: 1.4 },
    aoStrength: { name: 'AO Strength', type: 'f32', defaultValue: 0.32 },
    heightInfluence: { name: 'Height Roughness', type: 'f32', defaultValue: 0.02 },
    normalDetailScale: { name: 'Normal Detail Scale', type: 'f32', defaultValue: 0 },
    baseColor: {
      name: 'Steel Color',
      type: 'vec3f',
      defaultValue: [0.17, 0.185, 0.2],
    },
    accentColor: {
      name: 'Brush Highlight',
      type: 'vec3f',
      defaultValue: [0.4, 0.42, 0.45],
    },
    wearColor: {
      name: 'Blotch Color',
      type: 'vec3f',
      defaultValue: [0.1, 0.105, 0.115],
    },
    edgeWear: { name: 'Edge Wear', type: 'f32', defaultValue: 0.05 },
    roughness: { name: 'Roughness', type: 'f32', defaultValue: 0.42 },
    metallic: { name: 'Metallic', type: 'f32', defaultValue: 0.96 },
    opacity: { name: 'Opacity', type: 'f32', defaultValue: 1 },
    anisotropy: { name: 'Anisotropy', type: 'f32', defaultValue: 0.88 },
    anisotropyRotation: { name: 'Anisotropy Rotation', type: 'f32', defaultValue: 0 },
  };

  const nodes: ShaderGraphNode[] = [
    node('pbr_master', 'PBRMasterNode', 1680, 200, {
      inputs: [
        sock('albedo', 'Albedo', 'vec4f'),
        sock('opacity', 'Opacity', 'f32'),
        sock('normal', 'Normal', 'vec3f'),
        sock('roughness_factor', 'Roughness F', 'f32'),
        sock('metallic_factor', 'Metallic F', 'f32'),
        sock('anisotropy', 'Anisotropy', 'f32'),
        sock('anisotropy_rotation', 'Anisotropy Rot', 'f32'),
      ],
      outputs: [],
    }),
    node('obj_pos', 'GetObjectPosition', 0, 0, {
      inputs: [],
      outputs: [sock('pos', 'Position', 'vec3f')],
    }),
    node('prop_scale', 'Property', 180, 80, {
      data: { propertyName: 'triplanarScale' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('prop_seed', 'Property', 180, 160, {
      data: { propertyName: 'seed' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('steel_look', 'CustomFunction', 380, 40, {
      data: { functionName: 'brushed_steel_look' },
      inputs: [
        sock('pos', 'Position', 'vec3f'),
        sock('seed', 'Seed', 'f32'),
        sock('scale', 'Scale', 'f32'),
      ],
      outputs: [sock('out', 'Look', 'vec4f')],
    }),
    node('split_steel', 'SplitVec4', 560, 40, {
      inputs: [sock('in', 'In', 'vec4f')],
      outputs: [
        sock('x', 'Grain', 'f32'),
        sock('y', 'Blotch', 'f32'),
        sock('z', 'Bump', 'f32'),
        sock('w', 'Rough', 'f32'),
      ],
    }),
    node('vertex_color', 'VertexColor', 0, 280, {
      inputs: [],
      outputs: [sock('color', 'Color', 'vec4f')],
    }),
    node('mesh_maps', 'MeshMaps', 220, 280, {
      inputs: [sock('color', 'Vertex Color', 'vec4f')],
      outputs: [
        sock('concavity', 'Concavity', 'f32'),
        sock('convexity', 'Convexity', 'f32'),
        sock('ao', 'AO', 'f32'),
        sock('height', 'Height', 'f32'),
      ],
    }),
    node('world_n', 'GetWorldNormal', 0, 520, {
      inputs: [],
      outputs: [sock('norm', 'Normal', 'vec3f')],
    }),
    node('prop_base', 'Property', 760, 200, {
      data: { propertyName: 'baseColor' },
      inputs: [],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_accent', 'Property', 760, 280, {
      data: { propertyName: 'accentColor' },
      inputs: [],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_wear', 'Property', 760, 360, {
      data: { propertyName: 'wearColor' },
      inputs: [],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('lerp_grain', 'Lerp', 980, 160, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'vec3f'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('blotch_k', 'ConstantFloat', 760, 440, {
      data: { value: 0.38 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('blotch_amt', 'Multiply', 980, 360, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('lerp_blotch', 'Lerp', 1140, 200, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'vec3f'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_ao_str', 'Property', 1140, 320, {
      data: { propertyName: 'aoStrength' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('one', 'ConstantFloat', 1140, 400, {
      data: { value: 1 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('ao_mix', 'Lerp', 1320, 280, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('mul_ao_color', 'Multiply', 1480, 200, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('prop_edge', 'Property', 1140, 480, {
      data: { propertyName: 'edgeWear' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('wear_amt', 'Multiply', 1320, 440, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('lerp_wear', 'Lerp', 1480, 320, {
      inputs: [sock('a', 'A', 'vec3f'), sock('b', 'B', 'vec3f'), sock('t', 'T', 'f32')],
      outputs: [sock('out', 'Out', 'vec3f')],
    }),
    node('split_alb', 'SplitVec3', 1480, 80, {
      inputs: [sock('in', 'In', 'vec3f')],
      outputs: [sock('x', 'X', 'f32'), sock('y', 'Y', 'f32'), sock('z', 'Z', 'f32')],
    }),
    node('prop_opacity', 'Property', 1480, 560, {
      data: { propertyName: 'opacity' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('alb_rgba', 'Combine', 1600, 80, {
      inputs: [
        sock('r', 'R', 'f32'),
        sock('g', 'G', 'f32'),
        sock('b', 'B', 'f32'),
        sock('a', 'A', 'f32'),
      ],
      outputs: [sock('out', 'Out', 'vec4f')],
    }),
    node('prop_rough', 'Property', 1140, 640, {
      data: { propertyName: 'roughness' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('add_rough', 'Add', 1320, 640, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('cavity_k', 'ConstantFloat', 1140, 800, {
      data: { value: 0.1 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('cavity_rough', 'Multiply', 1320, 760, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('add_cavity_r', 'Add', 1480, 640, {
      inputs: [sock('a', 'A', 'f32'), sock('b', 'B', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('clamp_rough', 'Clamp', 1600, 640, {
      inputs: [sock('in', 'In', 'f32'), sock('min', 'Min', 'f32'), sock('max', 'Max', 'f32')],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('zero', 'ConstantFloat', 1480, 800, {
      data: { value: 0 },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('prop_metal', 'Property', 1480, 880, {
      data: { propertyName: 'metallic' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('prop_aniso', 'Property', 1480, 960, {
      data: { propertyName: 'anisotropy' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
    node('prop_aniso_rot', 'Property', 1480, 1040, {
      data: { propertyName: 'anisotropyRotation' },
      inputs: [],
      outputs: [sock('out', 'Out', 'f32')],
    }),
  ];

  const connections: ShaderGraphConnection[] = [
    conn('obj_pos', 'pos', 'steel_look', 'pos'),
    conn('prop_seed', 'out', 'steel_look', 'seed'),
    conn('prop_scale', 'out', 'steel_look', 'scale'),
    conn('steel_look', 'out', 'split_steel', 'in'),
    conn('vertex_color', 'color', 'mesh_maps', 'color'),
    conn('prop_base', 'out', 'lerp_grain', 'a'),
    conn('prop_accent', 'out', 'lerp_grain', 'b'),
    conn('split_steel', 'x', 'lerp_grain', 't'),
    conn('split_steel', 'y', 'blotch_amt', 'a'),
    conn('blotch_k', 'out', 'blotch_amt', 'b'),
    conn('lerp_grain', 'out', 'lerp_blotch', 'a'),
    conn('prop_wear', 'out', 'lerp_blotch', 'b'),
    conn('blotch_amt', 'out', 'lerp_blotch', 't'),
    conn('one', 'out', 'ao_mix', 'a'),
    conn('mesh_maps', 'ao', 'ao_mix', 'b'),
    conn('prop_ao_str', 'out', 'ao_mix', 't'),
    conn('lerp_blotch', 'out', 'mul_ao_color', 'a'),
    conn('ao_mix', 'out', 'mul_ao_color', 'b'),
    conn('mesh_maps', 'convexity', 'wear_amt', 'a'),
    conn('prop_edge', 'out', 'wear_amt', 'b'),
    conn('mul_ao_color', 'out', 'lerp_wear', 'a'),
    conn('prop_wear', 'out', 'lerp_wear', 'b'),
    conn('wear_amt', 'out', 'lerp_wear', 't'),
    conn('lerp_wear', 'out', 'split_alb', 'in'),
    conn('split_alb', 'x', 'alb_rgba', 'r'),
    conn('split_alb', 'y', 'alb_rgba', 'g'),
    conn('split_alb', 'z', 'alb_rgba', 'b'),
    conn('prop_opacity', 'out', 'alb_rgba', 'a'),
    conn('prop_rough', 'out', 'add_rough', 'a'),
    conn('split_steel', 'w', 'add_rough', 'b'),
    conn('mesh_maps', 'concavity', 'cavity_rough', 'a'),
    conn('cavity_k', 'out', 'cavity_rough', 'b'),
    conn('add_rough', 'out', 'add_cavity_r', 'a'),
    conn('cavity_rough', 'out', 'add_cavity_r', 'b'),
    conn('add_cavity_r', 'out', 'clamp_rough', 'in'),
    conn('zero', 'out', 'clamp_rough', 'min'),
    conn('one', 'out', 'clamp_rough', 'max'),
    conn('alb_rgba', 'out', 'pbr_master', 'albedo'),
    conn('prop_opacity', 'out', 'pbr_master', 'opacity'),
    conn('world_n', 'norm', 'pbr_master', 'normal'),
    conn('clamp_rough', 'out', 'pbr_master', 'roughness_factor'),
    conn('prop_metal', 'out', 'pbr_master', 'metallic_factor'),
    conn('prop_aniso', 'out', 'pbr_master', 'anisotropy'),
    conn('prop_aniso_rot', 'out', 'pbr_master', 'anisotropy_rotation'),
  ];

  return { id: STEEL_PBR_SHADER_ID, properties, nodes, connections };
}

export function createBrushedSteelProceduralPBRGraph(): ShaderGraph {
  return buildSteelGraph();
}
