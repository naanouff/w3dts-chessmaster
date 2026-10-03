/**
 * @file woodLook.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-19
 * @description Load WoodProceduralPBR and sync GProc seed/scale into the shader.
 */

import type { Material, ResourceManager, ShaderGraph } from '@naanouff/w3dts-core';
import { Material as MaterialClass } from '@naanouff/w3dts-core';
import type { GProcGraph } from '@naanouff/w3dts-gproc';

export const WOOD_PBR_SHADER_NAME = 'Wood Procedural PBR';
export const WOOD_PBR_SHADER_ID = 'WoodProceduralPBR';

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

export async function loadWoodShaderGraph(baseUrl = '/shader-graphs'): Promise<ShaderGraph> {
  const res = await fetch(`${baseUrl}/WoodProceduralPBR.json`);
  if (!res.ok) {
    throw new Error('Failed to load WoodProceduralPBR shader graph');
  }
  return (await res.json()) as ShaderGraph;
}

export function createWoodMaterial(resourceManager: ResourceManager, graph: ShaderGraph): Material {
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
    name: 'WoodProceduralPBRMaterial',
    shadingModel: 'graph',
    shaderGraph: graph,
    properties: propertyDefaults(graph),
    sampler,
  });
  resourceManager.uploadMaterial(material);
  return material;
}

/** Sync shader seed / triplanar scale from GProc group input or component parameters. */
export function syncWoodMaterialFromGProcParams(
  material: Material,
  parameters: Record<string, unknown> | undefined
): void {
  if (!parameters) return;

  const seed = parameters.Seed ?? parameters.seed;
  const scale = parameters.Scale ?? parameters.scale;

  if (seed !== undefined) {
    const s = Number(seed);
    if (Number.isFinite(s)) material.properties.set('seed', s);
  }
  if (scale !== undefined) {
    const sc = Number(scale);
    if (Number.isFinite(sc)) material.properties.set('triplanarScale', Math.max(0.8, sc * 1.15));
  }
}

export function syncWoodMaterialFromGProcGraph(material: Material, graph: GProcGraph): void {
  const groupInput = graph.nodes.find((n) => n.type === 'GroupInput');
  const params = (groupInput?.properties ?? {}) as Record<string, unknown>;
  syncWoodMaterialFromGProcParams(material, params);
}
