/**
 * @file spawnSceneLife.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Spawns the review hearth, dust and cigar. A match never calls this.
 */

import {
  Material,
  PrimitiveFactory,
  RenderableComponent,
  SceneNode,
  TextureLoader,
  TransformComponent,
  type Mesh,
  type ResourceManager,
  type ShaderGraph,
  type World,
} from '@naanouff/w3dts-core';
import { LogChannel, type ILogger } from '@naanouff/w3dts-logger';
import {
  ParticleEmitterComponent,
  validateParticleGraph,
} from '@naanouff/w3dts-particles';
import { quat, vec3 } from 'gl-matrix';

import {
  CIGAR_LENGTH_M,
  cigarTip,
  type SceneLifeEmitter,
} from './chessSceneLife';

const CATALOG_URL = '/particles/library/catalog.json';
const PARTICLE_GRAPH_URL = '/shader-graphs/ParticleInstanceColorGraph.json';

export interface SceneLifeHost {
  device: GPUDevice;
  world: World;
  resourceManager: ResourceManager;
  /** PBR graph for the cigar stick. Particles use their own graph. */
  pbrGraph: ShaderGraph;
  logger?: ILogger;
}

let quad: Mesh | null = null;
let stickMesh: Mesh | null = null;
let stickMaterial: Material | null = null;
let emberMaterial: Material | null = null;
let smokeMaterial: Material | null = null;
let wispMaterial: Material | null = null;
let libraryReady = false;

/**
 * Floor height used by props that sit on the room, in metres.
 * @param world - World that owns the set.
 * @param nodes - Nodes just added for the room.
 * @returns The floor, or 0 when the room has no floor node.
 */
export function sceneLifeFloorY(world: World, nodes: readonly SceneNode[]): number {
  const floor = nodes.find((node) => node.name === 'ChessSetFloor');
  if (!floor) return 0;
  const transform = world.getComponent(floor.entityId, TransformComponent);
  return (transform?.position[1] ?? 0) - 0.003;
}

/**
 * Builds life nodes and adds them to the world. The caller adds them to the scene.
 * @param host - Device and resources of the review.
 * @param specs - Emitters for the room on screen.
 * @param floorY - Floor height in metres.
 * @param scene - Scene that should own the nodes.
 * @returns Nodes to drop when the room or Vie changes.
 */
export async function spawnSceneLife(
  host: SceneLifeHost,
  specs: readonly SceneLifeEmitter[],
  floorY: number,
  scene: SceneNode
): Promise<SceneNode[]> {
  if (specs.length === 0) return [];
  const graph = await loadParticleGraph();
  if (!graph) {
    host.logger?.warn(LogChannel.DataLifecycle, 'Chess scene life: particle shader graph missing.');
    return [];
  }
  await preloadParticleLibrary(host.resourceManager, host.logger);
  const mesh = particleQuad(host.resourceManager);
  const ember = await particleMaterial(host, graph, 'ember');
  const smoke = await particleMaterial(host, graph, 'smoke');
  const wisp = await particleMaterial(host, graph, 'wisp');
  const nodes: SceneNode[] = [];
  for (const spec of specs) {
    const node = new SceneNode(`ChessLife-${spec.id}`, host.world);
    const component = new ParticleEmitterComponent({
      graphId: spec.graphId,
      maxParticles: spec.maxParticles,
      palette: spec.palette,
      parameters: { intensity: spec.intensity },
    });
    component.mesh = mesh;
    component.material = spec.sprite === 'wisp' ? wisp : spec.palette === 'ember' ? ember : smoke;
    component.castShadow = false;
    component.enabled = true;
    host.world.addComponent(node.entityId, component);
    place(host.world, node, worldPoint(spec, floorY), spec.direction);
    scene.add(node);
    nodes.push(node);
  }
  if (specs.some((spec) => spec.followsCigar)) nodes.push(cigarStick(host, floorY, scene));
  return nodes;
}

function worldPoint(
  spec: SceneLifeEmitter,
  floorY: number
): readonly [number, number, number] {
  const source = spec.followsCigar ? cigarTip(0).ember : spec.position;
  const y = spec.liftsWithFloor ? floorY + source[1] : source[1];
  return [source[0], y, source[2]];
}

function place(
  world: World,
  node: SceneNode,
  position: readonly [number, number, number],
  direction: readonly [number, number, number]
): void {
  const transform = world.getComponent(node.entityId, TransformComponent);
  if (!transform) return;
  vec3.set(transform.position, position[0], position[1], position[2]);
  const rotation = quat.create();
  quat.rotationTo(rotation, [0, 1, 0], [direction[0], direction[1], direction[2]]);
  quat.copy(transform.rotation, rotation);
  transform.updateLocalTransform();
}

function cigarStick(host: SceneLifeHost, floorY: number, scene: SceneNode): SceneNode {
  if (!stickMesh) {
    stickMesh = PrimitiveFactory.createCube(1);
    host.resourceManager.uploadMesh(stickMesh);
  }
  if (!stickMaterial) {
    stickMaterial = new Material({
      name: 'ChessLife-cigar-stick',
      shadingModel: 'pbr',
      shaderGraph: host.pbrGraph,
      doubleSided: false,
      properties: {
        baseColor: [0.28, 0.16, 0.08],
        roughness: 0.85,
        metallic: 0,
      },
    });
    host.resourceManager.uploadMaterial(stickMaterial);
  }
  const mesh = stickMesh;
  const material = stickMaterial;
  const node = new SceneNode('ChessLife-cigar', host.world, mesh, material);
  const origin = cigarTip(0).ember;
  place(
    host.world,
    node,
    [origin[0] + CIGAR_LENGTH_M / 2, floorY + origin[1], origin[2]],
    [0, 1, 0]
  );
  const transform = host.world.getComponent(node.entityId, TransformComponent);
  if (transform) {
    vec3.set(transform.scale, CIGAR_LENGTH_M, 0.008, 0.008);
    transform.updateLocalTransform();
  }
  const renderable = host.world.getComponent(node.entityId, RenderableComponent);
  if (renderable) renderable.castShadow = false;
  scene.add(node);
  return node;
}

function particleQuad(resourceManager: ResourceManager): Mesh {
  if (!quad) {
    quad = PrimitiveFactory.createQuad();
    quad.name = 'ChessLifeBillboard';
    resourceManager.uploadMesh(quad);
  }
  return quad;
}

async function particleMaterial(
  host: SceneLifeHost,
  graph: ShaderGraph,
  sprite: 'ember' | 'smoke' | 'wisp'
): Promise<Material> {
  const cached = sprite === 'ember' ? emberMaterial : sprite === 'wisp' ? wispMaterial : smokeMaterial;
  if (cached) return cached;
  const texture = await loadSoftTexture(host.device, sprite);
  const material = new Material({
    name: sprite === 'ember' ? 'ChessLifeEmber' : sprite === 'wisp' ? 'ChessLifeWisp' : 'ChessLifeSmoke',
    shadingModel: 'unlit',
    shaderGraph: graph,
    alphaMode: 'BLEND',
    diffuseTexture: texture?.texture,
    sampler: texture?.sampler,
    properties: {
      tag: 'transparent',
      baseColor: sprite === 'ember' ? [1.15, 0.7, 0.25] : [0.62, 0.64, 0.66],
      alpha: sprite === 'ember' ? 1 : sprite === 'wisp' ? 0.7 : 0.45,
      alphaCutoff: 0.02,
      cylindricalBillboard: true,
    },
    doubleSided: true,
  });
  host.resourceManager.uploadMaterial(material);
  if (sprite === 'ember') emberMaterial = material;
  else if (sprite === 'wisp') wispMaterial = material;
  else smokeMaterial = material;
  return material;
}

async function loadSoftTexture(
  device: GPUDevice,
  sprite: 'ember' | 'smoke' | 'wisp'
): Promise<{ texture?: GPUTexture; sampler?: GPUSampler } | null> {
  const url = sprite === 'ember'
    ? '/textures/particles/soft_ember.png'
    : sprite === 'wisp'
      ? '/textures/particles/cigar_wisp.png'
      : '/textures/particles/soft_smoke.png';
  try {
    return await TextureLoader.create(device, url, {
      generateMips: true,
      createSampler: true,
      samplerDescriptor: {
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
      },
    });
  } catch {
    return null;
  }
}

async function loadParticleGraph(): Promise<ShaderGraph | null> {
  try {
    const response = await fetch(PARTICLE_GRAPH_URL);
    if (!response.ok) return null;
    return (await response.json()) as ShaderGraph;
  } catch {
    return null;
  }
}

async function preloadParticleLibrary(
  resourceManager: ResourceManager,
  logger?: ILogger
): Promise<void> {
  if (libraryReady) return;
  try {
    const catalogRes = await fetch(CATALOG_URL);
    if (!catalogRes.ok) return;
    const catalog = (await catalogRes.json()) as { assets?: { id?: string; graphUrl?: string }[] };
    for (const asset of catalog.assets ?? []) {
      if (!asset.id || !asset.graphUrl) continue;
      const graphRes = await fetch(asset.graphUrl);
      if (!graphRes.ok) continue;
      const validated = validateParticleGraph(await graphRes.json());
      if (!validated.ok) continue;
      resourceManager.upsertGraphResource('particle-graph', validated.graph, asset.id);
    }
    libraryReady = true;
  } catch (err) {
    logger?.warn(LogChannel.DataLifecycle, 'Chess scene life: particle catalog skipped.', err as Error);
  }
}
