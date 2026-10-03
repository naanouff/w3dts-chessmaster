/**
 * @file chessSceneRuntime.ts
 * @description Post-load helpers for Chess SceneDD (`public/scenes/chess.json`).
 */

import {
  NameComponent,
  RenderableComponent,
  type Engine,
  type IEngineContext,
  type Material,
  type ShaderGraph,
} from '@naanouff/w3dts-core';
import { GProcComponent } from '@naanouff/w3dts-gproc';
import { LogChannel } from '@naanouff/w3dts-logger';
import { fetchSceneDdGraphJson } from './assetFetch';
import {
  ensureChessMoveGlowMaterials,
  loadChessBoardPhotoMaterials,
  loadChessPhotoPbrMaterials,
  patchChessPhotoMaterialsFromCache,
} from './chessLook';

/** True when SceneDD metadata targets the chess demo / package. */
export function isChessSceneProjectName(name: string | undefined | null): boolean {
  return name === 'ChessDemoProject' || name === 'Chess' || name === 'ChessDemo';
}

/** SceneDD placeholder names → photo PBR materials created by {@link loadChessPhotoPbrMaterials}. */
const SCENE_TO_PHOTO_MATERIAL: ReadonlyArray<readonly [string, string]> = [
  ['ChessMarblePBR', 'ChessMarblePhotoPBR'],
  ['ChessBrushedSteelPBR', 'ChessMetalPhotoPBR'],
  ['ChessBoard', 'ChessBoardWoodPhotoPBR'],
  ['ChessBoardEdge', 'ChessBoardGoldPhotoPBR'],
];

/**
 * Swap SceneDD / procedural materials on loaded entities for photo marble / steel / wood / gold.
 */
export function remapChessSceneMaterialsToPhoto(engine: IEngineContext): void {
  const rm = engine.resourceManager;
  const replace = new Map<string, Material>();
  for (const [from, to] of SCENE_TO_PHOTO_MATERIAL) {
    const photo = rm.getMaterialByName(to);
    if (photo) replace.set(from, photo);
  }
  if (replace.size === 0) return;

  const world = engine.ecsWorld;
  for (const [, [gproc]] of world.query<[GProcComponent]>([GProcComponent]).iter()) {
    let dirty = false;
    for (let i = 0; i < gproc.materials.length; i++) {
      const current = gproc.materials[i];
      const next = current?.name ? replace.get(current.name) : undefined;
      if (next && next !== current) {
        gproc.materials[i] = next;
        dirty = true;
      }
    }
    if (dirty) gproc.isDirty = true;
  }

  for (const [, [renderable]] of world.query<[RenderableComponent]>([RenderableComponent]).iter()) {
    const next = renderable.material?.name ? replace.get(renderable.material.name) : undefined;
    if (next) renderable.material = next;
  }
}

/**
 * Point legal / hover / spline overlay renderables at the neon glow materials in the cache.
 * Required after SceneDD load because descriptors hold the pre-upgrade material instances.
 */
export function remapChessOverlayMaterialsToGlow(engine: IEngineContext): void {
  const rm = engine.resourceManager;
  const legal = rm.getMaterialByName('ChessLegalSquare');
  const hoverLegal = rm.getMaterialByName('ChessDropHoverLegal');
  const spline = rm.getMaterialByName('ChessBookSpline');
  const splineHead = rm.getMaterialByName('ChessBookSplineHead');
  if (!legal && !hoverLegal && !spline && !splineHead) return;

  const world = engine.ecsWorld;
  for (const [, [nameComp, renderable]] of world
    .query<[NameComponent, RenderableComponent]>([NameComponent, RenderableComponent])
    .iter()) {
    const name = nameComp.name;
    if (legal && /^ChessLegalOverlay-\d+$/.test(name)) {
      renderable.material = legal;
      renderable.castShadow = false;
      continue;
    }
    if (hoverLegal && name === 'ChessDropHover') {
      renderable.material = hoverLegal;
      renderable.castShadow = false;
      continue;
    }
    if (spline && /^ChessBookSpline-\d+$/.test(name)) {
      renderable.material = spline;
      renderable.castShadow = false;
      continue;
    }
    if (splineHead && name === 'ChessBookSplineHead') {
      renderable.material = splineHead;
      renderable.castShadow = false;
    }
  }
}

async function loadPbrGraph(): Promise<ShaderGraph> {
  return (await fetchSceneDdGraphJson('/shader-graphs/PBRGraph.json')) as ShaderGraph;
}

async function ensureChessPhotoMaterials(engine: Engine, pbrGraph: ShaderGraph): Promise<void> {
  const rm = engine.resourceManager;
  const device = engine.webGPUContext.device;

  const hasPieces =
    Boolean(rm.getMaterialByName('ChessMarblePhotoPBR')) &&
    Boolean(rm.getMaterialByName('ChessMetalPhotoPBR'));
  if (!hasPieces) {
    await loadChessPhotoPbrMaterials(device, rm, pbrGraph);
  }

  const hasBoard =
    Boolean(rm.getMaterialByName('ChessBoardWoodPhotoPBR')) &&
    Boolean(rm.getMaterialByName('ChessBoardGoldPhotoPBR'));
  if (!hasBoard) {
    await loadChessBoardPhotoMaterials(device, rm, pbrGraph);
  }
}

/**
 * Load CDN/same-origin photo maps + neon move-glow, then bind them on the scene.
 * Full hotseat grab still needs ChessDemoProject (or a future ChessMatchSystem).
 */
export async function applyChessSceneRuntime(engine: IEngineContext): Promise<void> {
  const eng = engine as Engine;
  let pbrGraph: ShaderGraph | null = null;
  try {
    pbrGraph = await loadPbrGraph();
    await ensureChessPhotoMaterials(eng, pbrGraph);
  } catch (e) {
    eng.logger.warn(
      LogChannel.DataLifecycle,
      'ChessSceneRuntime: photo materials skipped (procedural placeholders kept).',
      e as Error
    );
  }
  try {
    const graph = pbrGraph ?? (await loadPbrGraph());
    await ensureChessMoveGlowMaterials(eng.webGPUContext.device, eng.resourceManager, graph);
  } catch (e) {
    eng.logger.warn(
      LogChannel.DataLifecycle,
      'ChessSceneRuntime: move-glow materials skipped.',
      e as Error
    );
  }
  patchChessPhotoMaterialsFromCache(eng.resourceManager);
  remapChessSceneMaterialsToPhoto(eng);
  remapChessOverlayMaterialsToGlow(eng);
  eng.renderer.iblIntensity = Math.max(eng.renderer.iblIntensity, 2);
}
