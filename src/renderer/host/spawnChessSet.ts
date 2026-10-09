/**
 * @file spawnChessSet.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @description Spawns one baked room around the playable board. A missing prop leaves the cloth plane.
 */

import {
  CORE_PBR_KHR_FLAGS,
  Material,
  Mesh,
  PointLightComponent,
  PrimitiveFactory,
  RenderableComponent,
  SceneNode,
  SpotLightComponent,
  TextureLoader,
  TransformComponent,
  type PbrKhrExtensionCompileFlags,
  type ResourceManager,
  type ShaderGraph,
  type World,
} from '@naanouff/w3dts-core';
import { quat, vec3 } from 'gl-matrix';
import type { ChessTextureQuality } from '../graphics/chessGraphicsSettings';
import {
  chessGlassTop,
  chessSetCovePoses,
  chessSetPlacementViewSide,
  chessSetPlacementsBothSides,
  chessSetPunctualLights,
  chessSetShell,
  chessSetViewSideFromNodeName,
  chessSetViewSideFromZ,
  chessSetViewSideVisible,
  tagChessSetNodeName,
  type ChessAmbianceId,
  type ChessPunctualLight,
  type ChessSetPlacement,
} from './chessAmbiance';
import type { ChessColor } from '../../chess/rules/chessTypes';
import { gardenPergolaPieces } from './gardenStage';
import {
  cycloramaMesh,
  fetchChessSetBuffers,
  meshFromSetGlb,
  placeSetProp,
  setMapTextureFormat,
  setPropRotation,
  type SetGlbImage,
  type SetGlbMesh,
  type SetMapKind,
} from './chessSetGlb';

const CLUB_TABLE_HEIGHT = 0.74;

export interface ChessSetHost {
  device: GPUDevice;
  world: World;
  resourceManager: ResourceManager;
  pbrGraph: ShaderGraph;
}

/**
 * Builds the room nodes. They are not added to the scene.
 * @param host - Device, world, and the PBR graph.
 * @param id - Room to build.
 * @param quality - Options texture tier. Props resolve their bake size from scene density.
 * @param localColor - Which backdrop band stays visible (white → +Z, black → −Z).
 * @returns Nodes, or null when a required GLB is missing.
 */
export async function loadChessSet(
  host: ChessSetHost,
  id: ChessAmbianceId,
  quality: ChessTextureQuality,
  localColor: ChessColor = 'white'
): Promise<SceneNode[] | null> {
  const buffers = await fetchChessSetBuffers(id, quality, async (url) => {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.arrayBuffer();
  });
  if (!buffers) return null;
  const nodes = await buildChessSet(host, id, buffers);
  applyChessSetView(nodes, host.world, localColor);
  return nodes;
}

/**
 * Shows the far backdrop for the local player and hides the band behind the camera.
 * @param nodes - Set nodes tagged with `@plusZ` / `@minusZ` / shared.
 * @param world - World that owns the renderables.
 * @param localColor - Side the local client plays.
 */
export function applyChessSetView(nodes: readonly SceneNode[], world: World, localColor: ChessColor): void {
  for (const node of nodes) {
    const side = chessSetViewSideFromNodeName(node.name);
    const renderable = world.getComponent(node.entityId, RenderableComponent);
    if (renderable) renderable.visible = chessSetViewSideVisible(side, localColor);
  }
}

async function buildChessSet(
  host: ChessSetHost,
  id: ChessAmbianceId,
  buffers: Map<string, ArrayBuffer>
): Promise<SceneNode[]> {
  const parsed = new Map<string, SetGlbMesh>();
  const meshes = new Map<string, Mesh>();
  for (const [file, buffer] of buffers) {
    const meshData = meshFromSetGlb(buffer);
    const mesh = new Mesh(meshData.vertices, meshData.indices, `ChessSet-${file}`);
    host.resourceManager.uploadMesh(mesh);
    parsed.set(file, meshData);
    meshes.set(file, mesh);
  }

  const materials = new Map<string, Material>();
  const placements = chessSetPlacementsBothSides(id);
  for (const spec of placements) {
    const data = parsed.get(spec.file);
    if (!data) continue;
    await sharedMaterial(host, materials, spec, data);
  }

  const shell = chessSetShell(id);
  const table = meshes.get('table');
  const floorY = shell.glassTable || !table
    ? -CLUB_TABLE_HEIGHT
    : table.aabb.min[1] - table.aabb.max[1];

  const nodes: SceneNode[] = [];
  const floorZ = shell.floorZMax === null ? 0 : shell.floorZMax - shell.floorDepth / 2;
  nodes.push(solidNode(host, 'ChessSetFloor', PrimitiveFactory.createPlane(1), {
    color: shell.floor,
    roughness: shell.floorRoughness,
    metallic: shell.floorMetal,
    doubleSided: false,
    shadow: false,
    position: [0, floorY + 0.003, floorZ],
    scale: [shell.floorWidth, 1, shell.floorDepth],
  }));

  if (shell.cove) {
    const cove = cycloramaMesh(shell.cove.floorRun);
    const mesh = new Mesh(cove.vertices, cove.indices, 'ChessSetCove');
    host.resourceManager.uploadMesh(mesh);
    for (const [index, poseCove] of chessSetCovePoses(shell.cove).entries()) {
      const side = chessSetViewSideFromZ(poseCove.z);
      nodes.push(
        solidNode(
          host,
          tagChessSetNodeName(index === 0 ? 'ChessSetCove' : 'ChessSetCoveMirror', side),
          mesh,
          {
            color: [0.55, 0.55, 0.52],
            roughness: 0.96,
            metallic: 0,
            doubleSided: true,
            shadow: false,
            position: [0, floorY, poseCove.z],
            yaw: poseCove.yaw,
          }
        )
      );
    }
  }

  if (shell.room) {
    const room = shell.room;
    nodes.push(solidNode(host, 'ChessSetRoom', PrimitiveFactory.createCube(1), {
      color: room.color,
      roughness: 0.92,
      metallic: 0,
      doubleSided: true,
      shadow: false,
      position: [0, floorY + room.height / 2, room.z],
      scale: [room.width, room.height, room.depth],
    }));
  }

  if (shell.glassTable) nodes.push(...glassTable(host));
  if (shell.pergola) nodes.push(...gardenStructure(host, floorY));
  nodes.push(...setLights(host, id, floorY));

  let copy = 0;
  for (const spec of placements) {
    const mesh = meshes.get(spec.file);
    const data = parsed.get(spec.file);
    if (!mesh || !data) continue;
    const material = await sharedMaterial(host, materials, spec, data);
    const side = chessSetPlacementViewSide(spec);
    const node = new SceneNode(
      tagChessSetNodeName(`ChessSet-${spec.file}-${copy}`, side),
      host.world,
      mesh,
      material
    );
    copy += 1;
    const placed = placeSetProp(
      [mesh.aabb.min[0], mesh.aabb.min[1], mesh.aabb.min[2]],
      [mesh.aabb.max[0], mesh.aabb.max[1], mesh.aabb.max[2]],
      spec,
      floorY
    );
    pose(host.world, node, placed.x, placed.y, placed.z, spec.yaw ?? 0, spec.roll ?? 0);
    const renderable = host.world.getComponent(node.entityId, RenderableComponent);
    if (renderable) renderable.castShadow = spec.cast !== false;
    nodes.push(node);
  }
  return nodes;
}

async function sharedMaterial(
  host: ChessSetHost,
  cache: Map<string, Material>,
  spec: ChessSetPlacement,
  data: SetGlbMesh
): Promise<Material> {
  const key = `${spec.file}|${spec.tint?.join(',') ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const color = await textureFrom(host, data.color, 'color');
  const normal = await textureFrom(host, data.normal, 'normal');
  const orm = await textureFrom(host, data.orm, 'orm');
  const emissiveMap = await textureFrom(host, data.emissive, 'emissive');
  const strength = data.emissiveStrength * (spec.emissiveScale ?? 1);
  const glow = spec.tint ?? data.emissiveFactor;
  const khr: PbrKhrExtensionCompileFlags = { ...CORE_PBR_KHR_FLAGS };
  const uvOs: [number, number, number, number] = [0, 0, 1, 1];
  const uvRs: [number, number, number, number] = [1, 0, 0, 0];
  const material = new Material({
    name: `ChessSet-${key}`,
    shadingModel: 'pbr',
    shaderGraph: host.pbrGraph,
    doubleSided: true,
    properties: {
      baseColor: [1, 1, 1],
      ...(color ? { baseColorTexture: color } : {}),
      ...(normal ? { normalTexture: normal } : {}),
      ...(orm ? { metallicRoughnessTexture: orm } : {}),
      roughness: 1,
      metallic: 1,
      normalScale: 1,
      emissiveColor: [glow[0] * strength, glow[1] * strength, glow[2] * strength, 1],
      ...(emissiveMap ? { emissiveTexture: emissiveMap } : {}),
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
  host.resourceManager.uploadMaterial(material);
  cache.set(key, material);
  return material;
}

async function textureFrom(
  host: ChessSetHost,
  image: SetGlbImage | null,
  kind: SetMapKind
): Promise<GPUTexture | null> {
  if (!image) return null;
  const copy = new ArrayBuffer(image.bytes.byteLength);
  new Uint8Array(copy).set(image.bytes);
  const blob = new Blob([copy], { type: image.mime });
  const bitmap = await createImageBitmap(blob);
  const mips = Math.floor(Math.log2(Math.max(bitmap.width, bitmap.height))) + 1;
  const texture = host.device.createTexture({
    label: `ChessSetMap-${kind}`,
    size: [bitmap.width, bitmap.height],
    format: setMapTextureFormat(kind),
    mipLevelCount: mips,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  host.device.queue.copyExternalImageToTexture(
    { source: bitmap, flipY: false },
    { texture },
    { width: bitmap.width, height: bitmap.height }
  );
  if (mips > 1) {
    TextureLoader.generateMipmaps(host.device, texture, 1, {
      renormalizeNormals: kind === 'normal',
    });
  }
  bitmap.close();
  return texture;
}

function setLights(host: ChessSetHost, id: ChessAmbianceId, floorY: number): SceneNode[] {
  return chessSetPunctualLights(id).map((light, index) => {
    const y = light.fromFloor === null ? light.position[1] : floorY + light.fromFloor;
    const position: [number, number, number] = [light.position[0], y, light.position[2]];
    const node = new SceneNode(`ChessSetLight${index}`, host.world);
    if (light.kind === 'point') {
      host.world.addComponent(
        node.entityId,
        new PointLightComponent({
          color: [...light.color],
          intensity: light.intensity,
          range: light.range,
          shadowsEnabled: false,
        })
      );
    } else {
      host.world.addComponent(
        node.entityId,
        new SpotLightComponent({
          color: [...light.color],
          intensity: light.intensity,
          range: light.range,
          innerAngle: light.innerAngle,
          outerAngle: light.outerAngle,
          shadowsEnabled: light.cast,
        })
      );
      aimSpot(host.world, node, position, light.target);
    }
    const transform = host.world.getComponent(node.entityId, TransformComponent);
    if (transform) {
      vec3.set(transform.position, position[0], position[1], position[2]);
      transform.updateLocalTransform();
    }
    return node;
  });
}

function aimSpot(
  world: World,
  node: SceneNode,
  position: readonly [number, number, number],
  target: ChessPunctualLight['target']
): void {
  const transform = world.getComponent(node.entityId, TransformComponent);
  if (!transform) return;
  const dx = target[0] - position[0];
  const dy = target[1] - position[1];
  const dz = target[2] - position[2];
  const length = Math.hypot(dx, dy, dz) || 1;
  const rotation = quat.create();
  quat.rotationTo(rotation, [0, 0, -1], [dx / length, dy / length, dz / length]);
  quat.copy(transform.rotation, rotation);
}

function glassTable(host: ChessSetHost): SceneNode[] {
  const metal: [number, number, number] = [0.02, 0.02, 0.02];
  const length = 1.6;
  const depth = 0.9;
  const frame = 0.018;
  const nodes: SceneNode[] = [];
  const bar = (name: string, scale: [number, number, number], position: [number, number, number]) => {
    nodes.push(solidNode(host, name, PrimitiveFactory.createCube(1), {
      color: metal,
      roughness: 0.32,
      metallic: 0.9,
      doubleSided: false,
      shadow: true,
      position,
      scale,
    }));
  };
  bar('ChessSetGlassFrameZ0', [length, 0.02, frame], [0, -0.01, depth / 2 - frame / 2]);
  bar('ChessSetGlassFrameZ1', [length, 0.02, frame], [0, -0.01, -depth / 2 + frame / 2]);
  bar('ChessSetGlassFrameX0', [frame, 0.02, depth - frame * 2], [length / 2 - frame / 2, -0.01, 0]);
  bar('ChessSetGlassFrameX1', [frame, 0.02, depth - frame * 2], [-length / 2 + frame / 2, -0.01, 0]);
  nodes.push(glassTopNode(host, [length - frame * 2, 0.012, depth - frame * 2]));
  const legH = CLUB_TABLE_HEIGHT - 0.02;
  const legX = length / 2 - 0.03;
  const legZ = depth / 2 - 0.03;
  let leg = 0;
  for (const x of [-legX, legX]) {
    for (const z of [-legZ, legZ]) {
      const mesh = PrimitiveFactory.createCylinder(0.008, 0.006, legH, 12, 1);
      host.resourceManager.uploadMesh(mesh);
      nodes.push(solidNode(host, `ChessSetGlassLeg${leg}`, mesh, {
        color: metal,
        roughness: 0.32,
        metallic: 0.9,
        doubleSided: false,
        shadow: true,
        position: [x, -0.02 - legH / 2, z],
      }));
      leg += 1;
    }
  }
  return nodes;
}

function glassTopNode(host: ChessSetHost, scale: [number, number, number]): SceneNode {
  const glass = chessGlassTop();
  const mesh = PrimitiveFactory.createCube(1);
  host.resourceManager.uploadMesh(mesh);
  const material = new Material({
    name: 'ChessSetGlassTop',
    shadingModel: 'pbr',
    shaderGraph: host.pbrGraph,
    alphaMode: glass.alphaMode,
    doubleSided: true,
    properties: {
      baseColor: [...glass.color],
      roughness: glass.roughness,
      metallic: glass.metallic,
      transmissionFactor: glass.transmission,
      ior: glass.ior,
      thicknessFactor: glass.thickness,
      attenuationColor: [...glass.attenuationColor],
      attenuationDistance: glass.attenuationDistance,
      pbrKhrExtensionFlags: {
        ...CORE_PBR_KHR_FLAGS,
        khrMaterialsTransmission: glass.compile.khrMaterialsTransmission,
        khrMaterialsVolume: glass.compile.khrMaterialsVolume,
        khrMaterialsIor: glass.compile.khrMaterialsIor,
      },
    },
  });
  host.resourceManager.uploadMaterial(material);
  const node = new SceneNode('ChessSetGlassTop', host.world, mesh, material);
  pose(host.world, node, 0, -0.006, 0, 0, 0, scale);
  const renderable = host.world.getComponent(node.entityId, RenderableComponent);
  if (renderable) renderable.castShadow = false;
  return node;
}

function gardenStructure(host: ChessSetHost, floorY: number): SceneNode[] {
  // Whole pergola stays shared: culling half of it by Z left a broken frame.
  return gardenPergolaPieces().map((piece, index) =>
    solidNode(host, `ChessGarden-${piece.name}-${index}`, PrimitiveFactory.createCube(1), {
      color: piece.color,
      roughness: piece.roughness,
      metallic: piece.metal,
      doubleSided: false,
      shadow: piece.shadow,
      position: [piece.position[0], floorY + piece.position[1], piece.position[2]],
      scale: [piece.scale[0], piece.scale[1], piece.scale[2]],
    })
  );
}

function solidNode(
  host: ChessSetHost,
  name: string,
  mesh: Mesh,
  spec: {
    color: readonly [number, number, number];
    roughness: number;
    metallic: number;
    doubleSided: boolean;
    shadow: boolean;
    position: [number, number, number];
    scale?: [number, number, number];
    yaw?: number;
  }
): SceneNode {
  host.resourceManager.uploadMesh(mesh);
  const material = new Material({
    name,
    shadingModel: 'pbr',
    shaderGraph: host.pbrGraph,
    doubleSided: spec.doubleSided,
    properties: {
      baseColor: [...spec.color],
      roughness: spec.roughness,
      metallic: spec.metallic,
    },
  });
  host.resourceManager.uploadMaterial(material);
  const node = new SceneNode(name, host.world, mesh, material);
  pose(
    host.world,
    node,
    spec.position[0],
    spec.position[1],
    spec.position[2],
    spec.yaw ?? 0,
    0,
    spec.scale
  );
  const renderable = host.world.getComponent(node.entityId, RenderableComponent);
  if (renderable) renderable.castShadow = spec.shadow;
  return node;
}

function pose(
  world: World,
  node: SceneNode,
  x: number,
  y: number,
  z: number,
  yaw: number,
  roll: number,
  scale?: [number, number, number]
): void {
  const transform = world.getComponent(node.entityId, TransformComponent);
  if (!transform) return;
  vec3.set(transform.position, x, y, z);
  quat.copy(transform.rotation, setPropRotation(yaw, roll));
  if (scale) vec3.set(transform.scale, scale[0], scale[1], scale[2]);
  transform.updateLocalTransform();
}
