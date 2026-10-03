/**
 * @file ChessDemoProject.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Playable chess table: Staunton pieces, fingertip grab, CPU / P2P / ECO learn.
 */

import {
  CORE_PBR_KHR_FLAGS,
  CameraComponent,
  CameraControllerManager,
  DecalComponent,
  DirectionalLightComponent,
  Engine,
  isEditorPlaySimulationAllowed,
  LitAbstractProject,
  Material,
  NameComponent,
  OrbitalCameraController,
  getGameViewSurfacePixelSize,
  PrimitiveFactory,
  RenderableComponent,
  SceneNode,
  TransformComponent,
  createDecalSystem,
  type DecalSystemOutput,
  type Entity,
  type IEngineContext,
  type InputManager,
  type PbrKhrExtensionCompileFlags,
  type ProjectLoadParams,
  type ShaderGraph,
  type World,
} from '@naanouff/w3dts-core';
import { LogChannel } from '@naanouff/w3dts-logger';
import { WebAudioService } from '@naanouff/w3dts-audio';
import {
  ColliderComponent,
  RigidBodyComponent,
  createPhysicsSystem,
  raycast,
} from '@naanouff/w3dts-physics';
import {
  CHESS_BOARD_BODY_HEIGHT,
  CHESS_BOARD_MESH_EXTENT,
  CHESS_BOARD_SURFACE_Y,
  CHESS_GLYPH_TEXTURE_SIZE,
  CHESS_GRAB_LIFT_M,
  CHESS_GROUP_BOARD,
  CHESS_GROUP_PIECE,
  CHESS_HUD_COMMAND_EVENT,
  CHESS_HUD_STATE_EVENT,
  CHESS_MASK_BOARD,
  CHESS_SQUARE_SIZE,
  ChessMatch,
  HeuristicChessEngine,
  MouseGrabController,
  OpeningTrainer,
  ChessPieceComponent,
  applyCylindricalPieceUvs,
  assignCemeterySlot,
  boardColliderShape,
  buildChessBoardBodyMesh,
  buildStauntonPieceMesh,
  buildChessHudLearnPlies,
  chessBoardLabelPoses,
  chessBoardLabelQuat,
  chessBoardLabelSize,
  chessPlayP2pHint,
  chessTableSfxForPly,
  clientPointToNdc,
  decodeChessWire,
  decideChessFenSync,
  encodeChessWire,
  fillBoardAlbedo,
  fillChessGlyphAlbedo,
  intersectRayHorizontalPlane,
  normalizeChessHudP2pStatus,
  parseChessDemoQuery,
  parseChessHudCommand,
  pickRayFromViewProjection,
  replaceChessDemoQueryInLocation,
  sampleBookMoveSpline,
  samplePieceTravelWorld,
  seatChessPieceUpright,
  squareToWorld,
  stauntonPieceColliderShapes,
  stripChessSanSuffix,
  viewProjectionFromWorldTransform,
  worldToSquare,
  type ChessColor,
  type ChessDemoQuery,
  type ChessHudP2pStatus,
  type ChessPlayMode,
  type ChessPieceRole,
  type ChessSquareName,
  type ChessTableSfxId,
} from '../../chess';
import { BroadcastChannelTransport } from '@naanouff/w3dts-multiplayer-p2p';
import { mat4, quat, vec3 } from 'gl-matrix';
import { chessBus as uiBus } from '../bus';
import {
  arrayBufferLooksLikeGitLfsPointer,
  arrayBufferLooksLikeHtml,
  fetchPublicAssetPreferSameOrigin,
  fetchSceneDdGraphJson,
} from './assetFetch';
import {
  createBrushedSteelMaterial,
  createMarbleMaterial,
  CHESS_BOARD_CLEARCOAT_FACTOR,
  CHESS_BOARD_CLEARCOAT_ROUGHNESS,
  loadChessBoardPhotoMaterials,
  loadChessPhotoPbrMaterials,
  loadChessPieceShaderGraphs,
  loadChessMoveGlowTexture,
  createChessMoveGlowMaterial,
  patchChessPhotoMaterialsFromCache,
} from './chessLook';
import {
  remapChessOverlayMaterialsToGlow,
  remapChessSceneMaterialsToPhoto,
} from './chessSceneRuntime';
import { createWoodMaterial, loadWoodShaderGraph } from './woodLook';
import { CHESS_AMBIENCE_VOLUME, CHESS_SFX_VOLUME, installChessTableClips } from './chessTableAudio';

/** Neon first (local `public/hdri`); monochrome is the CDN / dim-studio fallback. */
const CHESS_HDR_CANDIDATES: { url: string; name: string; gain: number }[] = [
  { url: '/hdri/neon_photostudio_2k.hdr', name: 'neon_photostudio_2k', gain: 0.9 },
  { url: '/hdri/monochrome_studio_04_2k.hdr', name: 'monochrome_studio_04_2k', gain: 1.45 },
];
/** Tight CSM for a ~0.55 m table (engine default first split is 15 m → mushy contact). */
const CHESS_CSM_CASCADE_SPLITS: [number, number, number, number] = [1.2, 3.5, 9, 24];
/** Studio cloth plane size (must match the mesh in onInit). */
const CHESS_STUDIO_TABLE_EXTENT = 4.2;
/** Keep far pieces in every cascade so their shadows stay on the near floor when orbiting. */
const CHESS_CSM_INCLUDE_AABB = {
  min: [
    -CHESS_STUDIO_TABLE_EXTENT / 2,
    -CHESS_BOARD_BODY_HEIGHT - 0.02,
    -CHESS_STUDIO_TABLE_EXTENT / 2,
  ],
  max: [CHESS_STUDIO_TABLE_EXTENT / 2, 0.14, CHESS_STUDIO_TABLE_EXTENT / 2],
} as const;
/** Used when no HDR loads (procedural IBL). */
const CHESS_STUDIO_IBL_GAIN = 2;

const LEGAL_OVERLAY_Y = 0.0012;
const DROP_HOVER_Y = 0.0024;
const LEGAL_OVERLAY_COUNT = 32;
const SPLINE_OVERLAY_COUNT = 20;
const PIECE_TRAVEL_S = 0.42;
const CEMETERY_TRAVEL_S = 0.34;
const CAM_JUICE_S = 0.55;

type PieceFlight = {
  entity: Entity;
  from: [number, number, number];
  to: [number, number, number];
  elapsed: number;
  duration: number;
};
const BOARD_HALF_Y = CHESS_BOARD_BODY_HEIGHT / 2;

/** Clearcoat varnish on the checker; other KHR paths stay stripped (non-glTF material). */
const CHESS_BOARD_VARNISH_KHR: PbrKhrExtensionCompileFlags = {
  ...CORE_PBR_KHR_FLAGS,
  khrMaterialsClearcoat: true,
};

type EngineWithInput = IEngineContext & {
  inputManager?: InputManager;
  isGameViewInputActive?: () => boolean;
  getGameViewCanvas?: () => HTMLCanvasElement | null;
};

const GAME_CAM_EYE: [number, number, number] = [0, 0.55, -0.72];
const GAME_CAM_TARGET: [number, number, number] = [0, 0.02, 0];
const GAME_CAM_FOV = (38 * Math.PI) / 180;
/** Initial clip only; orbit `updateClipPlanes` owns near/far after RMB zoom. */
const GAME_CAM_NEAR = 0.002;
const GAME_CAM_FAR = 20;
const CHESS_CLOCK_START_S = 600;
const CHESS_P2P_CHANNEL = 'w3dts-chess-demo';

const CHESS_PIECE_NAME = /^Chess-(white|black)-(pawn|knight|bishop|rook|queen|king)-([a-h][1-8])$/;

function chessEntityStub(entity: Entity): SceneNode {
  return { entityId: entity } as SceneNode;
}

function uploadRgbaTexture(
  device: GPUDevice,
  label: string,
  data: Uint8ClampedArray,
  size: number
): GPUTexture {
  const texture = device.createTexture({
    label,
    size: [size, size],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture },
    new Uint8Array(data),
    { bytesPerRow: size * 4 },
    { width: size, height: size }
  );
  return texture;
}

export class ChessDemoProject extends LitAbstractProject {
  public readonly skipDefaultEditorLight = true;

  protected override getSceneRenderGraphPath(): string {
    return '/graphs/StandardLitGraphChess.json';
  }

  private world: World | null = null;
  private chessEngine: EngineWithInput | null = null;
  private match = ChessMatch.starting();
  private grab = new MouseGrabController();
  private grabFrom: ChessSquareName | null = null;
  private wasSelect = false;
  private entityBySquare = new Map<ChessSquareName, Entity>();
  private squareByEntity = new Map<Entity, ChessSquareName>();
  private nodeByEntity = new Map<Entity, SceneNode>();
  private pieceMeshes = new Map<ChessPieceRole, ReturnType<typeof buildStauntonPieceMesh>>();
  private marbleMat: Material | null = null;
  private steelMat: Material | null = null;
  private sceneRef: SceneNode | null = null;
  private overlayNodes: SceneNode[] = [];
  private hoverNode: SceneNode | null = null;
  private hoverLegalMat: Material | null = null;
  private hoverHomeMat: Material | null = null;
  private hoverIllegalMat: Material | null = null;
  private legalDropSquares = new Set<ChessSquareName>();
  private playMode: ChessPlayMode = 'cpu';
  private localColor: ChessColor = 'white';
  private cpu = new HeuristicChessEngine({ depth: 2, thinkMs: 280 });
  private cpuBusy = false;
  private cpuGen = 0;
  private clockWhite = CHESS_CLOCK_START_S;
  private clockBlack = CHESS_CLOCK_START_S;
  private hudClockWhite = CHESS_CLOCK_START_S;
  private hudClockBlack = CHESS_CLOCK_START_S;
  /** Side that ran out of time; independent of chessops (clocks are local). */
  private clockFlag: ChessColor | null = null;
  private p2p: BroadcastChannelTransport | null = null;
  private p2pStatus: ChessHudP2pStatus = 'waiting';
  private trainer: OpeningTrainer | null = null;
  private learnQuiz = false;
  private learnEco = 'C50';
  private learnMiss = false;
  private learnLastSan: string | null = null;
  private modePickerOpen = false;
  private cameraControllers: CameraControllerManager | null = null;
  private decalOutput: DecalSystemOutput | null = null;
  private labelNodes: SceneNode[] = [];
  private splineNodes: SceneNode[] = [];
  private splineHead: SceneNode | null = null;
  private colorByEntity = new Map<Entity, ChessColor>();
  private cemeteryEntities: Entity[] = [];
  private cemeteryCount: Record<ChessColor, number> = { white: 0, black: 0 };
  private flights: PieceFlight[] = [];
  private motionBusy = false;
  private pendingFen: string | null = null;
  private pendingSfx: ChessTableSfxId[] | null = null;
  private pendingPromotion: {
    square: ChessSquareName;
    role: ChessPieceRole;
    color: ChessColor;
  } | null = null;
  private camJuice: {
    restAz: number;
    restPol: number;
    dAz: number;
    dPol: number;
    elapsed: number;
  } | null = null;
  private audio: WebAudioService | null = null;
  private ambience: { stop(): void } | null = null;
  private audioArmed = false;
  private flagSfxPlayed = false;
  /** Pieces/meshes exist; P2P must not apply FEN until this is true. */
  private boardReady = false;
  private pendingP2pBytes: Uint8Array | null = null;
  private playSimWasAllowed = false;

  public getDecalOutput(): DecalSystemOutput | null {
    return this.decalOutput;
  }

  private readonly onHudCommand = (raw: unknown): void => {
    const cmd = parseChessHudCommand(raw);
    if (!cmd) return;
    if (cmd.type === 'mode-picker') {
      this.modePickerOpen = cmd.open;
      if (cmd.open && this.world && this.grab.grabbed) this.grab.end(this.world);
      return;
    }
    if (cmd.type === 'request-state') {
      this.emitHud();
      return;
    }
    this.modePickerOpen = false;
    this.applySession(cmd.session);
  };

  constructor() {
    super('ChessDemoProject');
  }

  public unload(): void {
    this.disposeChessRuntime();
  }

  /** Play Mode Stop / File→Load: photo textures, overlays, and a full procedural piece set. */
  public onSceneLoadedFromFile(): void {
    const world = this.world;
    const engine = this.chessEngine;
    if (!world || !engine) return;
    this.resetChessPlaySession(world, engine.resourceManager);
    void this.ensureBookSplineOverlaysAfterSceneLoad();
    this.ensureFileRankLabelsAfterSceneLoad();
  }

  /**
   * SceneDD chess.json may omit learn-mode book splines; spawn them after rebind so
   * {@link tickBookSpline} has nodes to animate.
   */
  private async ensureBookSplineOverlaysAfterSceneLoad(): Promise<void> {
    const world = this.world;
    const engine = this.chessEngine;
    const scene = this.sceneRef;
    if (!world || !engine || !scene) return;
    if (this.splineNodes.length >= SPLINE_OVERLAY_COUNT && this.splineHead) {
      remapChessOverlayMaterialsToGlow(engine);
      return;
    }
    try {
      const pbrGraph = (await fetchSceneDdGraphJson('/shader-graphs/PBRGraph.json')) as ShaderGraph;
      await this.spawnSplineOverlays(
        world,
        scene,
        engine.resourceManager,
        pbrGraph,
        engine.webGPUContext.device
      );
      remapChessOverlayMaterialsToGlow(engine);
      this.rebindChessMaterials(engine.resourceManager);
    } catch (e) {
      engine.logger?.warn(
        LogChannel.DataLifecycle,
        'ChessDemoProject: book-spline overlays missing after SceneDD load.',
        e as Error
      );
    }
  }

  /**
   * File/rank intaglio decals need GPU albedo textures (not in SceneDD). After a scene
   * clear+load, rebind finds nothing (or texture-less stubs) — bake and spawn again.
   */
  private ensureFileRankLabelsAfterSceneLoad(): void {
    const world = this.world;
    const engine = this.chessEngine;
    const scene = this.sceneRef;
    if (!world || !engine || !scene) return;

    const expected = chessBoardLabelPoses('white').length;
    const texturedOk =
      this.labelNodes.length >= expected &&
      this.labelNodes.every((node) => {
        const decal = world.getComponent(node.entityId, DecalComponent);
        return Boolean(decal?.albedoTexture);
      });
    if (texturedOk) {
      this.syncFileRankLabels(world);
      return;
    }

    for (const [entity, [nm]] of world.query<[NameComponent]>([NameComponent]).iter()) {
      if (nm.name.startsWith('ChessLabel-')) world.destroyEntity(entity);
    }
    this.labelNodes = [];
    this.ensureDecalSystem(engine);
    this.spawnFileRankLabels(world, scene, engine.webGPUContext.device);
    this.syncFileRankLabels(world);
  }

  private ensureDecalSystem(engine: EngineWithInput): void {
    if (this.decalOutput) return;
    this.decalOutput = {
      decals: [],
      buffer: null as unknown as GPUBuffer,
      data: new Float32Array(0),
      count: 0,
    };
    engine.scheduler.addSystem(createDecalSystem(this.decalOutput, engine.webGPUContext));
  }

  private resetChessPlaySession(
    world: World,
    resourceManager: ProjectLoadParams['resourceManager']
  ): void {
    if (this.grab.grabbed) this.grab.end(world);
    this.grabFrom = null;
    this.wasSelect = false;
    this.flights = [];
    this.motionBusy = false;
    this.pendingFen = null;
    this.pendingSfx = null;
    this.pendingPromotion = null;
    this.camJuice = null;
    this.cemeteryEntities = [];
    this.cemeteryCount = { white: 0, black: 0 };
    this.nodeByEntity.clear();

    patchChessPhotoMaterialsFromCache(resourceManager);
    this.rebindChessMaterials(resourceManager);
    this.destroyAllBoardPiecesInWorld(world);
    this.rebindChessFromWorld(world);

    this.match.reset();
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.resetClocks();
    this.learnMiss = false;
    this.learnLastSan = null;
    this.flagSfxPlayed = false;
    if (this.playMode === 'learn' && this.trainer) {
      if (this.trainer.isComplete()) this.trainer.nextOpening();
      else this.trainer.restart();
    }

    this.setLegalOverlays(world, []);
    this.setDropHover(world, null);
    this.hideBookSpline(world);
    if (this.chessEngine) {
      remapChessSceneMaterialsToPhoto(this.chessEngine);
      remapChessOverlayMaterialsToGlow(this.chessEngine);
      this.rebindChessMaterials(this.chessEngine.resourceManager);
      this.aimGameCamera(world, this.chessEngine);
      this.sceneRef = this.chessEngine.scene;
    }
    this.spawnMatchPieces(world);
    this.syncFileRankLabels(world);
    this.boardReady = true;
    this.emitHud();
  }

  /** Remove SceneDD / scenepak GProc pieces (partial load leaves orphans outside entity maps). */
  private destroyAllBoardPiecesInWorld(world: World): void {
    const ids = new Set<Entity>();
    for (const [entity] of world.query<[ChessPieceComponent]>([ChessPieceComponent]).iter()) {
      ids.add(entity);
    }
    for (const [entity, [nm]] of world.query<[NameComponent]>([NameComponent]).iter()) {
      if (CHESS_PIECE_NAME.test(nm.name)) ids.add(entity);
    }
    for (const entity of ids) {
      this.destroyPieceEntity(world, entity);
    }
    this.entityBySquare.clear();
    this.squareByEntity.clear();
    this.colorByEntity.clear();
    this.nodeByEntity.clear();
  }

  private rebindChessMaterials(resourceManager: ProjectLoadParams['resourceManager']): void {
    this.marbleMat =
      resourceManager.getMaterialByName('ChessMarblePhotoPBR') ??
      resourceManager.getMaterialByName('ChessMarblePBR') ??
      this.marbleMat;
    this.steelMat =
      resourceManager.getMaterialByName('ChessMetalPhotoPBR') ??
      resourceManager.getMaterialByName('ChessBrushedSteelPBR') ??
      this.steelMat;
    this.hoverLegalMat =
      resourceManager.getMaterialByName('ChessDropHoverLegal') ?? this.hoverLegalMat;
    this.hoverHomeMat =
      resourceManager.getMaterialByName('ChessDropHoverHome') ?? this.hoverHomeMat;
    this.hoverIllegalMat =
      resourceManager.getMaterialByName('ChessDropHoverIllegal') ?? this.hoverIllegalMat;
  }

  private rebindChessFromWorld(world: World): void {
    this.entityBySquare.clear();
    this.squareByEntity.clear();
    this.colorByEntity.clear();

    const overlayByIndex = new Map<number, SceneNode>();
    const splineByIndex = new Map<number, SceneNode>();
    const labels: SceneNode[] = [];

    for (const [entity, [piece]] of world
      .query<[ChessPieceComponent]>([ChessPieceComponent])
      .iter()) {
      const square = piece.square as ChessSquareName;
      if (!square || !/^[a-h][1-8]$/.test(square)) continue;
      this.entityBySquare.set(square, entity);
      this.squareByEntity.set(entity, square);
      this.colorByEntity.set(entity, piece.color);
    }

    for (const [entity, [nm]] of world.query<[NameComponent]>([NameComponent]).iter()) {
      const name = nm.name;
      if (!this.squareByEntity.has(entity)) {
        const piece = CHESS_PIECE_NAME.exec(name);
        if (piece) {
          const color = piece[1] as ChessColor;
          const square = piece[3] as ChessSquareName;
          this.entityBySquare.set(square, entity);
          this.squareByEntity.set(entity, square);
          this.colorByEntity.set(entity, color);
        }
      }

      const legal = /^ChessLegalOverlay-(\d+)$/.exec(name);
      if (legal) {
        overlayByIndex.set(Number(legal[1]), chessEntityStub(entity));
        continue;
      }
      const spline = /^ChessBookSpline-(\d+)$/.exec(name);
      if (spline) {
        splineByIndex.set(Number(spline[1]), chessEntityStub(entity));
        continue;
      }
      if (name === 'ChessDropHover') {
        this.hoverNode = chessEntityStub(entity);
        continue;
      }
      if (name === 'ChessBookSplineHead') {
        this.splineHead = chessEntityStub(entity);
        continue;
      }
      if (name.startsWith('ChessLabel-')) {
        labels.push(chessEntityStub(entity));
      }
    }

    this.overlayNodes = [];
    for (let i = 0; i < LEGAL_OVERLAY_COUNT; i++) {
      const node = overlayByIndex.get(i);
      if (node) this.overlayNodes.push(node);
    }
    this.splineNodes = [];
    for (let i = 0; i < SPLINE_OVERLAY_COUNT; i++) {
      const node = splineByIndex.get(i);
      if (node) this.splineNodes.push(node);
    }
    this.labelNodes = labels;
  }

  protected override async initializeScene(params: ProjectLoadParams): Promise<void> {
    await super.initializeScene(params);
    const { engine, scene, world, cameraControllerManager, logger, resourceManager } = params;
    this.world = world;
    this.chessEngine = engine as EngineWithInput;
    this.sceneRef = scene;
    this.cameraControllers = cameraControllerManager;
    this.match = ChessMatch.starting();
    const query = parseChessDemoQuery(typeof window !== 'undefined' ? window.location.search : '');
    this.playMode = query.mode;
    this.localColor = query.localColor;
    this.learnQuiz = query.quiz;
    this.learnEco = query.eco ?? 'C50';
    this.trainer = query.mode === 'learn' ? new OpeningTrainer(this.learnEco) : null;
    if (this.trainer) this.learnEco = this.trainer.opening().eco;
    this.modePickerOpen = false;
    this.clockWhite = CHESS_CLOCK_START_S;
    this.clockBlack = CHESS_CLOCK_START_S;
    this.clockFlag = null;
    this.boardReady = false;
    uiBus.off(CHESS_HUD_COMMAND_EVENT, this.onHudCommand);
    uiBus.on(CHESS_HUD_COMMAND_EVENT, this.onHudCommand);

    let pbrGraph: ShaderGraph;
    try {
      pbrGraph = (await fetchSceneDdGraphJson('/shader-graphs/PBRGraph.json')) as ShaderGraph;
    } catch (e) {
      logger.error(
        LogChannel.DataLifecycle,
        'ChessDemoProject: failed to load PBRGraph.json',
        e as Error
      );
      return;
    }

    const device = engine.webGPUContext.device;
    let photoPieces = false;
    try {
      const photo = await loadChessPhotoPbrMaterials(device, resourceManager, pbrGraph);
      this.marbleMat = photo.marble;
      this.steelMat = photo.metal;
      photoPieces = true;
    } catch (e) {
      logger.warn(
        LogChannel.DataLifecycle,
        'ChessDemoProject: photo marble/steel maps skipped; using procedural graphs.',
        e as Error
      );
      try {
        const pieceGraphs = await loadChessPieceShaderGraphs();
        this.marbleMat = createMarbleMaterial(resourceManager, pieceGraphs.marble);
        this.steelMat = createBrushedSteelMaterial(resourceManager, pieceGraphs.steel);
      } catch (graphErr) {
        logger.error(
          LogChannel.DataLifecycle,
          'ChessDemoProject: failed to load marble/steel shader graphs',
          graphErr as Error
        );
        return;
      }
    }

    let boardMat: Material;
    let edgeMat: Material;
    try {
      const photoBoard = await loadChessBoardPhotoMaterials(device, resourceManager, pbrGraph);
      boardMat = photoBoard.top;
      edgeMat = photoBoard.gold;
    } catch (e) {
      logger.warn(
        LogChannel.DataLifecycle,
        'ChessDemoProject: photo wood/gold board maps skipped; using canvas + wood graph.',
        e as Error
      );
      const boardPixels = new Uint8ClampedArray(1024 * 1024 * 4);
      fillBoardAlbedo(boardPixels, 1024);
      const boardTex = uploadRgbaTexture(device, 'chess-board-albedo', boardPixels, 1024);
      resourceManager.registerTexture('chess/board/canvas-albedo', boardTex);
      boardMat = new Material({
        name: 'ChessBoard',
        shadingModel: 'pbr',
        shaderGraph: pbrGraph,
        properties: {
          baseColor: [1, 1, 1],
          baseColorTexture: boardTex,
          roughness: 0.28,
          metallic: 0,
          clearcoatFactor: CHESS_BOARD_CLEARCOAT_FACTOR,
          clearcoatRoughnessFactor: CHESS_BOARD_CLEARCOAT_ROUGHNESS,
          pbrKhrExtensionFlags: CHESS_BOARD_VARNISH_KHR,
        },
      });
      resourceManager.uploadMaterial(boardMat);
      try {
        const woodGraph = await loadWoodShaderGraph();
        edgeMat = createWoodMaterial(resourceManager, woodGraph);
        edgeMat.properties.set('normalDetailScale', 0);
        edgeMat.properties.set('triplanarScale', 0.58);
        edgeMat.properties.set('knotAmount', 0);
        edgeMat.properties.set('anisotropy', 0);
        edgeMat.properties.set('cavityAmount', 0.15);
        edgeMat.properties.set('heightInfluence', 0);
        edgeMat.properties.set('roughness', 0.62);
        edgeMat.properties.set('woodColor', [0.24, 0.17, 0.14]);
        edgeMat.properties.set('grainColor', [0.15, 0.1, 0.08]);
      } catch {
        edgeMat = new Material({
          name: 'ChessBoardEdge',
          shadingModel: 'pbr',
          shaderGraph: pbrGraph,
          properties: {
            baseColor: [0.18, 0.12, 0.1],
            roughness: 0.78,
            metallic: 0,
          },
        });
        resourceManager.uploadMaterial(edgeMat);
      }
    }

    const roles: ChessPieceRole[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
    // Bake each GPROC graph once; the 32 board slots share these six meshes (CHESS-B4e).
    for (const role of roles) {
      let mesh = buildStauntonPieceMesh(role);
      if (photoPieces) mesh = applyCylindricalPieceUvs(mesh);
      resourceManager.uploadMesh(mesh);
      this.pieceMeshes.set(role, mesh);
    }

    const boardBodyMesh = buildChessBoardBodyMesh(CHESS_BOARD_MESH_EXTENT, BOARD_HALF_Y * 2);
    resourceManager.uploadMesh(boardBodyMesh);
    const board = new SceneNode('ChessBoard', world, boardBodyMesh, edgeMat);
    const boardT = world.getComponent(board.entityId, TransformComponent);
    if (boardT) {
      vec3.set(boardT.position, 0, -BOARD_HALF_Y, 0);
      boardT.updateLocalTransform();
    }
    world.addComponent(
      board.entityId,
      new RigidBodyComponent({ isKinematic: true, mass: 0, friction: 0.9, restitution: 0 })
    );
    world.addComponent(
      board.entityId,
      new ColliderComponent({
        ...boardColliderShape(BOARD_HALF_Y),
        collisionGroup: CHESS_GROUP_BOARD,
        collisionMask: CHESS_MASK_BOARD,
      })
    );
    scene.add(board);

    const tableMesh = PrimitiveFactory.createPlane(CHESS_STUDIO_TABLE_EXTENT);
    resourceManager.uploadMesh(tableMesh);
    const tableMat = new Material({
      name: 'ChessStudioCloth',
      shadingModel: 'pbr',
      shaderGraph: pbrGraph,
      properties: {
        baseColor: [0.93, 0.88, 0.78],
        roughness: 0.9,
        metallic: 0,
      },
    });
    resourceManager.uploadMaterial(tableMat);
    const table = new SceneNode('ChessStudioCloth', world, tableMesh, tableMat);
    const tableT = world.getComponent(table.entityId, TransformComponent);
    if (tableT) {
      vec3.set(tableT.position, 0, -CHESS_BOARD_BODY_HEIGHT - 0.001, 0);
      tableT.updateLocalTransform();
    }
    const tableRenderable = world.getComponent(table.entityId, RenderableComponent);
    if (tableRenderable) tableRenderable.castShadow = false;
    scene.add(table);

    const topMesh = PrimitiveFactory.createPlane(CHESS_BOARD_MESH_EXTENT);
    resourceManager.uploadMesh(topMesh);
    const top = new SceneNode('ChessBoardTop', world, topMesh, boardMat);
    const topT = world.getComponent(top.entityId, TransformComponent);
    if (topT) {
      vec3.set(topT.position, 0, 0.0004, 0);
      topT.updateLocalTransform();
    }
    const topRenderable = world.getComponent(top.entityId, RenderableComponent);
    if (topRenderable) topRenderable.castShadow = false;
    scene.add(top);

    for (const piece of this.match.pieces()) {
      this.spawnPiece(world, scene, piece.square, piece.role, piece.color);
    }

    await this.spawnLegalOverlays(world, scene, resourceManager, pbrGraph, device);
    await this.spawnSplineOverlays(world, scene, resourceManager, pbrGraph, device);
    this.spawnFileRankLabels(world, scene, device);
    this.decalOutput = {
      decals: [],
      buffer: null as unknown as GPUBuffer,
      data: new Float32Array(0),
      count: 0,
    };
    engine.scheduler.addSystem(createDecalSystem(this.decalOutput, engine.webGPUContext));
    this.syncFileRankLabels(world);

    this.audio = new WebAudioService();
    void installChessTableClips(this.audio).catch(() => {
      /* autoplay / missing context */
    });

    const sun = new SceneNode('ChessSun', world);
    const sunRot = quat.create();
    quat.fromEuler(sunRot, -58, -18, 0);
    const sunT = world.getComponent(sun.entityId, TransformComponent);
    if (sunT) {
      quat.copy(sunT.rotation, sunRot);
      sunT.updateLocalTransform();
    }
    world.addComponent(
      sun.entityId,
      new DirectionalLightComponent({
        color: [1, 0.97, 0.92],
        intensity: 2.65,
        shadowsEnabled: true,
      })
    );
    scene.add(sun);

    if (!engine.scheduler.hasSystemWithName('physicsSystem')) {
      engine.scheduler.prependSystem(
        createPhysicsSystem({ gravity: [0, -9.81, 0], skinWidth: 0.002 })
      );
    }

    const half = CHESS_SQUARE_SIZE * 4;
    cameraControllerManager.setController('orbital');
    const controller = cameraControllerManager.getActiveController();
    controller?.frameBoundingBox({ min: [-half, 0, -half], max: [half, 0.2, half] });
    this.aimGameCamera(world, engine);
    this.emitHud();
    this.boardReady = true;
    this.bindP2p();
    this.flushPendingP2p();

    logger.info(
      LogChannel.Gameplay,
      `ChessDemoProject: mode=${this.playMode} as ${this.localColor}. LMB grab, X reset.`
    );
  }

  protected override async initializeEnvironment(engine: Engine): Promise<void> {
    await super.initializeEnvironment(engine);
    const { logger, renderer } = engine;
    for (const hdr of CHESS_HDR_CANDIDATES) {
      try {
        const hdrRes = await fetchPublicAssetPreferSameOrigin(hdr.url);
        if (!hdrRes.ok) throw new Error(`HTTP ${hdrRes.status}`);
        const hdrBuffer = await hdrRes.arrayBuffer();
        if (arrayBufferLooksLikeGitLfsPointer(hdrBuffer)) {
          throw new Error('Git LFS pointer instead of HDR');
        }
        if (arrayBufferLooksLikeHtml(hdrBuffer)) {
          throw new Error('HTML instead of HDR');
        }
        await this.loadEnvironmentFromHdrBuffer(engine, hdrBuffer);
        renderer.iblIntensity = hdr.gain;
        renderer.csmCascadeSplits = CHESS_CSM_CASCADE_SPLITS;
        renderer.csmIncludeAabb = {
          min: [...CHESS_CSM_INCLUDE_AABB.min],
          max: [...CHESS_CSM_INCLUDE_AABB.max],
        };
        logger.info(
          LogChannel.EngineLifecycle,
          `ChessDemoProject studio HDR (${hdr.name}) applied, ibl×${hdr.gain}.`
        );
        return;
      } catch (e) {
        logger.warn(
          LogChannel.DataLifecycle,
          `ChessDemoProject: skip HDR ${hdr.name}.`,
          e as Error
        );
      }
    }
    renderer.iblIntensity = CHESS_STUDIO_IBL_GAIN;
    renderer.csmCascadeSplits = CHESS_CSM_CASCADE_SPLITS;
    renderer.csmIncludeAabb = {
      min: [...CHESS_CSM_INCLUDE_AABB.min],
      max: [...CHESS_CSM_INCLUDE_AABB.max],
    };
    logger.error(
      LogChannel.DataLifecycle,
      'ChessDemoProject: failed to load studio HDR; keeping procedural IBL.'
    );
  }

  public override updateTime(_h: number): void {
    // Keep ChessSun + HDR cubemap; Lit ToD would overwrite both.
  }

  public override update(_deltaTime: number, _totalTime: number): void {
    const world = this.world;
    const engine = this.chessEngine;
    if (!world || !engine) return;
    this.tuneGameCamera(world, engine);

    if (!isEditorPlaySimulationAllowed()) {
      this.cancelActiveGrab(world);
      this.modePickerOpen = false;
      this.playSimWasAllowed = false;
      return;
    }
    if (!this.playSimWasAllowed) {
      this.emitHud();
    }
    this.playSimWasAllowed = true;

    this.keepPiecesUpright(world);
    this.stepFlights(world, _deltaTime);
    this.tickBookSpline(world, _totalTime);
    this.tickCameraJuice(_deltaTime, engine);
    this.tickClocks(_deltaTime);
    if (this.modePickerOpen) return;
    this.pumpCpu();
    this.pumpLearnCoach();

    const input = engine.inputManager;
    if (!input) return;
    const overGame = this.isPointerOverGame(input);
    const gameFocus = engine.isGameViewInputActive?.() ?? false;
    if (!overGame && !gameFocus && !this.grab.grabbed) return;

    if (input.isActionJustPressed('resetKart')) this.resetMatch(world, true);

    const select = input.isActionPressed('select');
    const just = select && !this.wasSelect;
    const released = !select && this.wasSelect;
    this.wasSelect = select;

    if (just) this.onSelectDown(world, engine, input);
    if (select && this.grab.grabbed) this.onSelectHold(world, engine, input, _deltaTime);
    else if (released && this.grab.grabbed) this.onSelectUp(world);
  }

  /** Keep Game main flags and FOV; sync aspect to Game panel (see pickViewProjection). */
  private tuneGameCamera(world: World, engine: IEngineContext): void {
    const id = engine.getGameCameraEntityId();
    if (id === null) return;
    const camera = world.getComponent(id, CameraComponent);
    if (!camera) return;
    camera.isActive = true;
    camera.isMain = true;
    camera.firstPersonEyeOffsetY = 0;
    camera.fov = GAME_CAM_FOV;
    const surface = getGameViewSurfacePixelSize();
    if (surface.width > 0 && surface.height > 0) {
      camera.aspect = surface.width / surface.height;
    }
  }

  private aimGameCamera(world: World, engine: IEngineContext): void {
    const id = engine.getGameCameraEntityId();
    if (id === null) return;
    const transform = world.getComponent(id, TransformComponent);
    const camera = world.getComponent(id, CameraComponent);
    if (!transform || !camera) return;
    camera.isActive = true;
    camera.isMain = true;
    camera.firstPersonEyeOffsetY = 0;
    camera.near = GAME_CAM_NEAR;
    camera.far = GAME_CAM_FAR;
    camera.fov = GAME_CAM_FOV;
    const surface = getGameViewSurfacePixelSize();
    if (surface.width > 0 && surface.height > 0) {
      camera.aspect = surface.width / surface.height;
    }
    const view = mat4.create();
    const worldMat = mat4.create();
    mat4.lookAt(view, GAME_CAM_EYE, GAME_CAM_TARGET, [0, 1, 0]);
    mat4.invert(worldMat, view);
    vec3.copy(transform.position, GAME_CAM_EYE);
    mat4.getRotation(transform.rotation, worldMat);
    transform.updateLocalTransform();
    mat4.copy(transform.worldTransform, transform.localTransform);
    mat4.copy(camera.viewMatrix, view);
  }

  private spawnPiece(
    world: World,
    scene: SceneNode,
    square: ChessSquareName,
    role: ChessPieceRole,
    color: ChessColor
  ): Entity | null {
    const mesh = this.pieceMeshes.get(role);
    const mat = color === 'white' ? this.marbleMat : this.steelMat;
    if (!mesh || !mat) return null;
    const node = new SceneNode(`Chess-${color}-${role}-${square}`, world, mesh, mat);
    const pos = squareToWorld(square, CHESS_BOARD_SURFACE_Y);
    const t = world.getComponent(node.entityId, TransformComponent);
    if (t) {
      vec3.copy(t.position, pos);
      quat.identity(t.rotation);
      t.updateLocalTransform();
    }
    world.addComponent(
      node.entityId,
      new RigidBodyComponent({
        mass: 0.04,
        isKinematic: true,
        friction: 0.95,
        restitution: 0,
        drag: 0.4,
        angularDrag: 4,
      })
    );
    world.addComponent(
      node.entityId,
      new ColliderComponent({
        shapes: stauntonPieceColliderShapes(role),
        collisionGroup: CHESS_GROUP_PIECE,
      })
    );
    world.addComponent(node.entityId, new ChessPieceComponent(color, role, square));
    scene.add(node);
    this.entityBySquare.set(square, node.entityId);
    this.squareByEntity.set(node.entityId, square);
    this.nodeByEntity.set(node.entityId, node);
    this.colorByEntity.set(node.entityId, color);
    return node.entityId;
  }

  private async spawnLegalOverlays(
    world: World,
    scene: SceneNode,
    resourceManager: ProjectLoadParams['resourceManager'],
    pbrGraph: ShaderGraph,
    device: GPUDevice
  ): Promise<void> {
    const neon = await loadChessMoveGlowTexture(device, resourceManager);
    const mesh = PrimitiveFactory.createPlane(CHESS_SQUARE_SIZE * 1.02);
    resourceManager.uploadMesh(mesh);
    const mat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      'ChessLegalSquare',
      [0.28, 1, 0.42],
      [2.2, 22, 4]
    );
    this.overlayNodes = [];
    for (let i = 0; i < LEGAL_OVERLAY_COUNT; i++) {
      const node = new SceneNode(`ChessLegalOverlay-${i}`, world, mesh, mat);
      const renderable = world.getComponent(node.entityId, RenderableComponent);
      if (renderable) {
        renderable.visible = false;
        renderable.castShadow = false;
      }
      scene.add(node);
      this.overlayNodes.push(node);
    }

    const hoverMesh = PrimitiveFactory.createPlane(CHESS_SQUARE_SIZE * 1.02);
    resourceManager.uploadMesh(hoverMesh);
    this.hoverLegalMat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      'ChessDropHoverLegal',
      [1, 0.86, 0.22],
      [18, 14, 1.8]
    );
    this.hoverHomeMat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      'ChessDropHoverHome',
      [0.72, 0.88, 1],
      [5, 10, 24]
    );
    this.hoverIllegalMat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      'ChessDropHoverIllegal',
      [1, 0.22, 0.18],
      [32, 4.5, 2]
    );
    this.hoverNode = new SceneNode('ChessDropHover', world, hoverMesh, this.hoverLegalMat);
    const hoverRenderable = world.getComponent(this.hoverNode.entityId, RenderableComponent);
    if (hoverRenderable) {
      hoverRenderable.visible = false;
      hoverRenderable.castShadow = false;
    }
    scene.add(this.hoverNode);
  }

  private spawnSplineOverlays(
    world: World,
    scene: SceneNode,
    resourceManager: ProjectLoadParams['resourceManager'],
    pbrGraph: ShaderGraph,
    device: GPUDevice
  ): Promise<void> {
    return (async () => {
      const neon = await loadChessMoveGlowTexture(device, resourceManager);
      const mesh = PrimitiveFactory.createPlane(CHESS_SQUARE_SIZE * 0.28);
      resourceManager.uploadMesh(mesh);
      const mat = createChessMoveGlowMaterial(
        resourceManager,
        pbrGraph,
        neon,
        'ChessBookSpline',
        [0.35, 0.92, 1],
        [4, 16, 22]
      );
      this.splineNodes = [];
      for (let i = 0; i < SPLINE_OVERLAY_COUNT; i++) {
        const node = new SceneNode(`ChessBookSpline-${i}`, world, mesh, mat);
        const renderable = world.getComponent(node.entityId, RenderableComponent);
        if (renderable) {
          renderable.visible = false;
          renderable.castShadow = false;
        }
        scene.add(node);
        this.splineNodes.push(node);
      }
      const headMesh = PrimitiveFactory.createPlane(CHESS_SQUARE_SIZE * 0.38);
      resourceManager.uploadMesh(headMesh);
      const headMat = createChessMoveGlowMaterial(
        resourceManager,
        pbrGraph,
        neon,
        'ChessBookSplineHead',
        [1, 0.95, 0.55],
        [22, 18, 4]
      );
      this.splineHead = new SceneNode('ChessBookSplineHead', world, headMesh, headMat);
      const headR = world.getComponent(this.splineHead.entityId, RenderableComponent);
      if (headR) {
        headR.visible = false;
        headR.castShadow = false;
      }
      scene.add(this.splineHead);
    })();
  }

  private spawnFileRankLabels(world: World, scene: SceneNode, device: GPUDevice): void {
    const size = chessBoardLabelSize();
    const depth = CHESS_BOARD_BODY_HEIGHT * 0.85;
    const textures = new Map<string, GPUTexture>();
    for (const glyph of [...'abcdefgh', ...'12345678']) {
      const pixels = fillChessGlyphAlbedo(glyph, CHESS_GLYPH_TEXTURE_SIZE);
      textures.set(
        glyph,
        uploadRgbaTexture(device, `ChessGlyph-${glyph}`, pixels, CHESS_GLYPH_TEXTURE_SIZE)
      );
    }
    this.labelNodes = [];
    const slots = chessBoardLabelPoses('white');
    for (let i = 0; i < slots.length; i++) {
      const glyph = slots[i]!.glyph;
      const node = new SceneNode(`ChessLabel-${glyph}-${i}`, world);
      const decal = new DecalComponent(textures.get(glyph)!);
      decal.blendMode = 'alpha';
      decal.opacity = 1;
      decal.size = vec3.fromValues(size, size, depth);
      decal.normalFadeStart = 70;
      decal.normalFadeEnd = 88;
      world.addComponent(node.entityId, decal);
      scene.add(node);
      this.labelNodes.push(node);
    }
  }

  private syncFileRankLabels(world: World): void {
    const visible = this.playMode === 'learn';
    const poses = chessBoardLabelPoses(this.localColor);
    for (let i = 0; i < this.labelNodes.length; i++) {
      const node = this.labelNodes[i]!;
      const pose = poses[i];
      const t = world.getComponent(node.entityId, TransformComponent);
      const decal = world.getComponent(node.entityId, DecalComponent);
      if (!t || !decal || !pose) continue;
      vec3.set(t.position, pose.x, pose.y, pose.z);
      chessBoardLabelQuat(pose, t.rotation);
      t.updateLocalTransform();
      mat4.copy(t.worldTransform, t.localTransform);
      decal.opacity = visible ? 1 : 0;
      decal.dirty = true;
    }
  }

  private bakeOverlayTransform(t: TransformComponent): void {
    t.updateLocalTransform();
    mat4.copy(t.worldTransform, t.localTransform);
  }

  private setLegalOverlays(world: World, squares: readonly ChessSquareName[]): void {
    this.legalDropSquares = new Set(squares);
    const shown: ChessSquareName[] =
      this.grabFrom && !squares.includes(this.grabFrom)
        ? [this.grabFrom, ...squares]
        : [...squares];
    for (let i = 0; i < this.overlayNodes.length; i++) {
      const node = this.overlayNodes[i]!;
      const renderable = world.getComponent(node.entityId, RenderableComponent);
      const t = world.getComponent(node.entityId, TransformComponent);
      const square = shown[i];
      if (!renderable || !t) continue;
      if (!square) {
        renderable.visible = false;
        continue;
      }
      const p = squareToWorld(square, LEGAL_OVERLAY_Y);
      vec3.copy(t.position, p);
      this.bakeOverlayTransform(t);
      renderable.visible = true;
    }
  }

  private setDropHover(world: World, square: ChessSquareName | null): void {
    const node = this.hoverNode;
    if (!node) return;
    const renderable = world.getComponent(node.entityId, RenderableComponent);
    const t = world.getComponent(node.entityId, TransformComponent);
    if (!renderable || !t) return;
    if (!square) {
      renderable.visible = false;
      return;
    }
    if (square === this.grabFrom) {
      if (this.hoverHomeMat) renderable.material = this.hoverHomeMat;
    } else if (this.legalDropSquares.has(square)) {
      if (this.hoverLegalMat) renderable.material = this.hoverLegalMat;
    } else if (this.hoverIllegalMat) {
      renderable.material = this.hoverIllegalMat;
    }
    const p = squareToWorld(square, DROP_HOVER_Y);
    vec3.copy(t.position, p);
    this.bakeOverlayTransform(t);
    renderable.visible = true;
  }

  private gameOver(): boolean {
    if (this.playMode === 'learn') return Boolean(this.trainer?.isComplete());
    return this.match.isEnd() || this.clockFlag !== null;
  }

  private emitHud(): void {
    if (!isEditorPlaySimulationAllowed()) return;
    if (this.playMode === 'learn') {
      this.emitLearnHud();
      return;
    }
    const mode = this.playMode;
    const side = this.match.sideToMove();
    const sideLabel = side === 'white' ? 'White' : 'Black';
    let title = `${sideLabel} to move`;
    let description =
      this.playMode === 'cpu'
        ? `You are ${this.localColor}. CPU replies automatically.`
        : this.playMode === 'p2p'
          ? chessPlayP2pHint(this.localColor)
          : 'Hot-seat: grab the side to move.';
    if (this.clockFlag) {
      const flagged = this.clockFlag === 'white' ? 'White' : 'Black';
      title = `${flagged} flagged`;
      description = `${flagged} ran out of time.`;
    } else if (this.match.isCheckmate()) {
      title = 'Checkmate';
      description = `${sideLabel} is checkmated.`;
    } else if (this.match.isStalemate()) {
      title = 'Stalemate';
      description = 'Draw — no legal moves.';
    } else if (this.match.isCheck()) {
      title = `${sideLabel} in check`;
    }
    uiBus.emit(CHESS_HUD_STATE_EVENT, {
      kind: 'play',
      mode,
      label: 'Status',
      title,
      description,
      localColor: this.localColor,
      sideToMove: side,
      cpuThinking: mode === 'cpu' && this.cpuBusy,
      p2pStatus: mode === 'p2p' ? this.p2pStatus : null,
      clocks: { whiteSeconds: this.clockWhite, blackSeconds: this.clockBlack },
      flag: this.clockFlag,
      session: this.currentSession(),
    });
  }

  private emitLearnHud(): void {
    if (!isEditorPlaySimulationAllowed()) return;
    const trainer = this.trainer;
    if (!trainer) return;
    const opening = trainer.opening();
    const expected = trainer.expected();
    const expectedSan = expected ? stripChessSanSuffix(expected.san) : null;
    let title = `${opening.name} (${opening.eco})`;
    let description = this.learnQuiz
      ? 'SAN quiz: play the book move.'
      : expectedSan
        ? `Play ${expectedSan}.`
        : 'Line complete.';
    if (this.learnMiss) {
      description = this.learnQuiz
        ? 'Not the book move — try again.'
        : `Not the book move. Play ${expectedSan ?? 'the line'}.`;
    } else if (this.learnLastSan && !trainer.isComplete()) {
      description = this.learnQuiz ? `Correct: ${this.learnLastSan}. Next book move.` : description;
    }
    if (this.cpuBusy && !trainer.isComplete()) {
      description = 'Coach playing the book reply…';
    }
    if (trainer.isComplete()) {
      title = 'Opening complete';
      description = `${opening.name} (${opening.eco}).`;
    }
    uiBus.emit(CHESS_HUD_STATE_EVENT, {
      kind: 'learn',
      label: 'Opening',
      title,
      description,
      eco: opening.eco,
      openingName: opening.name,
      plyIndex: trainer.plyIndex(),
      plyCount: trainer.plyCount(),
      quiz: this.learnQuiz,
      miss: this.learnMiss,
      complete: trainer.isComplete(),
      coachBusy: this.cpuBusy,
      plies: buildChessHudLearnPlies(opening.sans, trainer.plyIndex(), this.learnQuiz),
      session: this.currentSession(),
    });
  }

  private clearBoardVisuals(world: World): void {
    if (this.grab.grabbed) this.grab.end(world);
    this.grabFrom = null;
    this.wasSelect = false;
    this.flights = [];
    this.motionBusy = false;
    this.pendingFen = null;
    this.pendingSfx = null;
    this.pendingPromotion = null;
    this.camJuice = null;
    this.setLegalOverlays(world, []);
    this.setDropHover(world, null);
    this.hideBookSpline(world);
    for (const square of [...this.entityBySquare.keys()]) {
      this.removePieceAt(world, square);
    }
    for (const entity of this.cemeteryEntities.splice(0)) {
      this.destroyPieceEntity(world, entity);
    }
    this.cemeteryCount = { white: 0, black: 0 };
  }

  private spawnMatchPieces(world: World): void {
    if (!this.sceneRef) return;
    for (const piece of this.match.pieces()) {
      this.spawnPiece(world, this.sceneRef, piece.square, piece.role, piece.color);
    }
  }

  private currentSession(): ChessDemoQuery {
    return {
      mode: this.playMode,
      localColor: this.localColor,
      eco: this.learnEco,
      quiz: this.learnQuiz,
    };
  }

  private applySession(query: ChessDemoQuery): void {
    const world = this.world;
    if (!world) return;
    this.playMode = query.mode;
    this.localColor = query.localColor;
    this.learnQuiz = query.quiz;
    if (query.eco) this.learnEco = query.eco;
    this.trainer = query.mode === 'learn' ? new OpeningTrainer(this.learnEco) : null;
    if (this.trainer) this.learnEco = this.trainer.opening().eco;
    this.pendingP2pBytes = null;
    this.boardReady = false;
    this.clearBoardVisuals(world);
    this.match.reset();
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.resetClocks();
    this.learnMiss = false;
    this.learnLastSan = null;
    this.flagSfxPlayed = false;
    this.spawnMatchPieces(world);
    this.syncFileRankLabels(world);
    this.boardReady = true;
    this.bindP2p();
    this.pendingP2pBytes = null;
    this.emitHud();
    if (this.playMode === 'p2p') {
      this.broadcastWire({ v: 1, t: 'reset', fen: this.match.fen() });
    }
    replaceChessDemoQueryInLocation(this.currentSession());
  }

  private resetClocks(): void {
    this.clockWhite = CHESS_CLOCK_START_S;
    this.clockBlack = CHESS_CLOCK_START_S;
    this.hudClockWhite = CHESS_CLOCK_START_S;
    this.hudClockBlack = CHESS_CLOCK_START_S;
    this.clockFlag = null;
  }

  private resetMatch(world: World, broadcast: boolean): void {
    this.clearBoardVisuals(world);
    this.match.reset();
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.resetClocks();
    this.learnMiss = false;
    this.learnLastSan = null;
    if (this.playMode === 'learn' && this.trainer) {
      if (this.trainer.isComplete()) this.trainer.nextOpening();
      else this.trainer.restart();
    }
    this.spawnMatchPieces(world);
    this.syncFileRankLabels(world);
    this.emitHud();
    if (broadcast && this.playMode === 'p2p') {
      this.broadcastWire({ v: 1, t: 'reset', fen: this.match.fen() });
    }
  }

  private rebuildFromFen(world: World, fen: string): void {
    this.clearBoardVisuals(world);
    if (!this.match.loadFen(fen)) this.match.reset();
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.flagSfxPlayed = false;
    this.spawnMatchPieces(world);
    this.emitHud();
  }

  private gameCanvasRect(): DOMRect | null {
    const el =
      document.querySelector('[data-testid="game-view-canvas"]') ??
      this.chessEngine?.getGameViewCanvas?.() ??
      null;
    return el instanceof HTMLCanvasElement ? el.getBoundingClientRect() : null;
  }

  private isPointerOverGame(input: InputManager): boolean {
    const rect = this.gameCanvasRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    return (
      input.pointer.x >= rect.left &&
      input.pointer.x <= rect.right &&
      input.pointer.y >= rect.top &&
      input.pointer.y <= rect.bottom
    );
  }

  /**
   * Game-pass projection uses the Game canvas aspect, not ECS `camera.aspect`.
   * Build the pick VP from the aimed Game camera after {@link aimGameCamera}.
   */
  private pickViewProjection(world: World, engine: IEngineContext, rect: DOMRect): mat4 | null {
    const id = engine.getGameCameraEntityId();
    if (id === null) return null;
    const camera = world.getComponent(id, CameraComponent);
    const transform = world.getComponent(id, TransformComponent);
    if (!camera || !transform) return null;
    return viewProjectionFromWorldTransform(
      transform.worldTransform,
      camera.fov,
      rect.width / Math.max(1e-6, rect.height),
      camera.near,
      camera.far
    );
  }

  private worldFromPointer(
    world: World,
    engine: EngineWithInput,
    input: InputManager,
    planeY: number = CHESS_BOARD_SURFACE_Y + CHESS_GRAB_LIFT_M
  ): vec3 | null {
    const rect = this.gameCanvasRect();
    if (!rect) return null;
    const vp = this.pickViewProjection(world, engine, rect);
    if (!vp) return null;
    const ndc = clientPointToNdc(input.pointer.x, input.pointer.y, rect);
    if (!ndc) return null;
    const ray = pickRayFromViewProjection(vp, ndc.ndcX, ndc.ndcY);
    if (!ray) return null;
    return intersectRayHorizontalPlane(ray.origin, ray.direction, planeY);
  }

  /** Pause / Stop: abort in-flight grab without applying a move. */
  private cancelActiveGrab(world: World): void {
    if (!this.grab.grabbed) return;
    const entity = this.grab.end(world);
    const from = this.grabFrom;
    this.grabFrom = null;
    this.wasSelect = false;
    this.setLegalOverlays(world, []);
    this.setDropHover(world, null);
    if (entity !== null && from) {
      this.snapEntityToSquare(world, entity, from);
    }
  }

  private onSelectDown(world: World, engine: EngineWithInput, input: InputManager): void {
    if (this.gameOver()) return;
    const rect = this.gameCanvasRect();
    if (!rect) return;
    const vp = this.pickViewProjection(world, engine, rect);
    if (!vp) return;
    const ndc = clientPointToNdc(input.pointer.x, input.pointer.y, rect);
    if (!ndc) return;
    const ray = pickRayFromViewProjection(vp, ndc.ndcX, ndc.ndcY);
    if (!ray) return;
    const hit = raycast(world, ray.origin, ray.direction, 8, { collisionMask: CHESS_GROUP_PIECE });
    if (!hit) return;
    const from = this.squareByEntity.get(hit.entity);
    if (!from) return;
    const piece = this.match.pieceAt(from);
    if (!piece || piece.color !== this.match.sideToMove()) return;
    if (this.cpuBusy || this.motionBusy) return;
    if (this.playMode !== 'hotseat' && piece.color !== this.localColor) return;
    const grabY = CHESS_BOARD_SURFACE_Y + CHESS_GRAB_LIFT_M + 0.04;
    if (!this.grab.begin(world, hit.entity, hit.point, grabY)) return;
    this.grabFrom = from;
    void this.armAudio();
    this.setLegalOverlays(world, this.match.legalSquares(from));
    this.setDropHover(world, from);
  }

  private onSelectHold(
    world: World,
    engine: EngineWithInput,
    input: InputManager,
    dt: number
  ): void {
    const p = this.worldFromPointer(
      world,
      engine,
      input,
      this.grab.grabbed?.grabHeightY ?? CHESS_BOARD_SURFACE_Y + CHESS_GRAB_LIFT_M
    );
    if (!p) return;
    this.grab.updateWorldAnchor(world, p[0]!, p[2]!, dt);
    this.setDropHover(world, worldToSquare(p[0]!, p[2]!));
  }

  private onSelectUp(world: World): void {
    const drop = this.grab.dropXZ();
    const entity = this.grab.end(world);
    const from = this.grabFrom;
    this.grabFrom = null;
    this.setLegalOverlays(world, []);
    this.setDropHover(world, null);
    if (entity === null || !from) return;
    const dest = drop ? worldToSquare(drop[0], drop[1]) : null;
    if (this.playMode === 'learn' && this.trainer) {
      if (!dest || !this.trainer.isBookMove(from, dest)) {
        this.learnMiss = true;
        this.snapEntityToSquare(world, entity, from);
        this.emitHud();
        return;
      }
    }
    const result = dest
      ? this.match.tryMove(from, dest)
      : { ok: false as const, reason: 'illegal' as const };
    if (result.ok) {
      if (this.playMode === 'learn' && this.trainer) {
        this.trainer.accept(from, result.to);
        this.learnMiss = false;
        this.learnLastSan = result.san.replace(/[+#]$/, '');
      }
      this.applySuccessfulMove(
        world,
        entity,
        from,
        result.to,
        result.capturedSquare,
        result.castle,
        result.promotion,
        true,
        false
      );
    } else {
      this.snapEntityToSquare(world, entity, from);
    }
  }

  private applySuccessfulMove(
    world: World,
    entity: Entity,
    from: ChessSquareName,
    to: ChessSquareName,
    capturedSquare: ChessSquareName | null,
    castle: { rookFrom: ChessSquareName; rookTo: ChessSquareName } | null,
    promotion: ChessPieceRole | null,
    broadcast: boolean,
    animateMover: boolean
  ): void {
    const capturedEntity = capturedSquare ? this.entityBySquare.get(capturedSquare) : undefined;
    const capturedColor =
      capturedEntity !== undefined ? this.colorByEntity.get(capturedEntity) : undefined;
    if (capturedEntity !== undefined && capturedSquare && capturedColor) {
      this.entityBySquare.delete(capturedSquare);
      this.squareByEntity.delete(capturedEntity);
      this.cemeteryEntities.push(capturedEntity);
      const slot = assignCemeterySlot(capturedColor, this.cemeteryCount[capturedColor]++);
      const fromPos = this.entityWorldPos(world, capturedEntity);
      this.disablePieceGrab(world, capturedEntity);
      this.queueFlight(capturedEntity, fromPos, [slot.x, slot.y, slot.z], 0.16, CEMETERY_TRAVEL_S);
    } else if (capturedSquare) {
      this.removePieceAt(world, capturedSquare);
    }
    this.entityBySquare.delete(from);
    this.entityBySquare.set(to, entity);
    this.squareByEntity.set(entity, to);
    if (animateMover) {
      const fromPos = this.entityWorldPos(world, entity);
      const dest = squareToWorld(to, CHESS_BOARD_SURFACE_Y);
      this.queueFlight(entity, fromPos, [dest[0]!, dest[1]!, dest[2]!], 0, PIECE_TRAVEL_S);
    } else {
      this.snapEntityToSquare(world, entity, to);
    }
    if (castle) {
      const rook = this.entityBySquare.get(castle.rookFrom);
      if (rook !== undefined) {
        this.entityBySquare.delete(castle.rookFrom);
        this.entityBySquare.set(castle.rookTo, rook);
        this.squareByEntity.set(rook, castle.rookTo);
        if (animateMover) {
          const fromPos = this.entityWorldPos(world, rook);
          const dest = squareToWorld(castle.rookTo, CHESS_BOARD_SURFACE_Y);
          this.queueFlight(rook, fromPos, [dest[0]!, dest[1]!, dest[2]!], 0, PIECE_TRAVEL_S);
        } else {
          this.snapEntityToSquare(world, rook, castle.rookTo);
        }
      }
    }
    if (promotion) {
      const color = this.match.pieceAt(to)?.color ?? 'white';
      if (animateMover) {
        this.pendingPromotion = { square: to, role: promotion, color };
      } else {
        this.removePieceAt(world, to);
        if (this.sceneRef) this.spawnPiece(world, this.sceneRef, to, promotion, color);
      }
    }
    if (broadcast && this.playMode === 'p2p') {
      this.broadcastWire({ v: 1, t: 'move', from, to, fen: this.match.fen() });
    }
    const cue = chessTableSfxForPly({
      captured: Boolean(capturedSquare),
      check: this.match.isCheck() && !this.match.isCheckmate(),
      mate: this.match.isCheckmate(),
      localWon: this.match.isCheckmate() && this.match.sideToMove() !== this.localColor,
    });
    const clips =
      this.playMode === 'learn' && this.trainer?.isComplete() ? [...cue, 'win' as const] : cue;
    if (animateMover) this.pendingSfx = clips;
    else this.playSfx(clips);
    this.startCameraJuice(from, to);
    this.emitHud();
  }

  private snapEntityToSquare(world: World, entity: Entity, square: ChessSquareName): void {
    const t = world.getComponent(entity, TransformComponent);
    const body = world.getComponent(entity, RigidBodyComponent);
    const piece = world.getComponent(entity, ChessPieceComponent);
    if (!t) return;
    const p = squareToWorld(square, CHESS_BOARD_SURFACE_Y);
    vec3.copy(t.position, p);
    quat.identity(t.rotation);
    t.updateLocalTransform();
    if (piece) piece.square = square;
    if (body) {
      vec3.set(body.velocity, 0, 0, 0);
      seatChessPieceUpright(t, body);
      body.isKinematic = true;
      body.isSleeping = true;
    }
  }

  private keepPiecesUpright(world: World): void {
    const flying = new Set(this.flights.map((f) => f.entity));
    const held = this.grab.grabbed?.entity ?? null;
    for (const entity of this.squareByEntity.keys()) {
      if (entity === held || flying.has(entity)) continue;
      const t = world.getComponent(entity, TransformComponent);
      const body = world.getComponent(entity, RigidBodyComponent);
      if (!t) continue;
      seatChessPieceUpright(t, body);
      if (body) {
        body.isKinematic = true;
        vec3.set(body.velocity, 0, 0, 0);
      }
    }
  }

  private removePieceAt(world: World, square: ChessSquareName): void {
    const entity = this.entityBySquare.get(square);
    if (entity === undefined) return;
    const node = this.nodeByEntity.get(entity);
    if (node?.parent) node.parent.detach(node);
    world.destroyEntity(entity);
    this.entityBySquare.delete(square);
    this.squareByEntity.delete(entity);
    this.nodeByEntity.delete(entity);
    this.colorByEntity.delete(entity);
  }

  private tickClocks(dt: number): void {
    if (this.playMode === 'learn' || this.gameOver() || dt <= 0) return;
    const before = this.clockFlag;
    if (this.match.sideToMove() === 'white') {
      this.clockWhite = Math.max(0, this.clockWhite - dt);
      if (this.clockWhite <= 0) this.clockFlag = 'white';
    } else {
      this.clockBlack = Math.max(0, this.clockBlack - dt);
      if (this.clockBlack <= 0) this.clockFlag = 'black';
    }
    const w = Math.ceil(this.clockWhite);
    const b = Math.ceil(this.clockBlack);
    if (w !== this.hudClockWhite || b !== this.hudClockBlack || this.clockFlag) {
      this.hudClockWhite = w;
      this.hudClockBlack = b;
      this.emitHud();
    }
    if (this.clockFlag && !before && !this.flagSfxPlayed) {
      this.flagSfxPlayed = true;
      this.playSfx([this.clockFlag === this.localColor ? 'lose' : 'win']);
    }
  }

  private pumpCpu(): void {
    if (this.playMode !== 'cpu' || this.cpuBusy || this.motionBusy || this.gameOver()) return;
    if (this.match.sideToMove() === this.localColor) return;
    this.queueCpuMove();
  }

  private pumpLearnCoach(): void {
    if (this.playMode !== 'learn' || !this.trainer || this.cpuBusy || this.motionBusy) return;
    if (this.trainer.isComplete()) return;
    const expected = this.trainer.expected();
    if (!expected) return;
    if (this.match.sideToMove() === this.localColor) return;
    this.queueLearnCoachMove(expected.from, expected.to, expected.san);
  }

  private queueLearnCoachMove(from: ChessSquareName, to: ChessSquareName, san: string): void {
    const world = this.world;
    if (!world) return;
    const gen = ++this.cpuGen;
    this.cpuBusy = true;
    this.emitHud();
    globalThis.setTimeout(() => {
      if (gen !== this.cpuGen || !this.world || !this.trainer) {
        this.cpuBusy = false;
        this.emitHud();
        return;
      }
      if (this.playProgrammaticMove(this.world, from, to)) {
        this.trainer.accept(from, to);
        this.learnLastSan = san.replace(/[+#]$/, '');
        this.learnMiss = false;
      }
      this.cpuBusy = false;
      this.emitHud();
    }, 280);
  }

  private queueCpuMove(): void {
    const world = this.world;
    if (!world) return;
    const gen = ++this.cpuGen;
    this.cpuBusy = true;
    this.emitHud();
    const fen = this.match.fen();
    void this.cpu.chooseMove(fen).then((move) => {
      if (gen !== this.cpuGen || !this.world || !move) {
        this.cpuBusy = false;
        this.emitHud();
        return;
      }
      this.playProgrammaticMove(this.world, move.from, move.to);
      this.cpuBusy = false;
      this.emitHud();
    });
  }

  private playProgrammaticMove(world: World, from: ChessSquareName, to: ChessSquareName): boolean {
    const entity = this.entityBySquare.get(from);
    if (entity === undefined) return false;
    const result = this.match.tryMove(from, to);
    if (!result.ok) return false;
    this.applySuccessfulMove(
      world,
      entity,
      from,
      result.to,
      result.capturedSquare,
      result.castle,
      result.promotion,
      false,
      true
    );
    return true;
  }

  private bindP2p(): void {
    this.p2p?.closeAll();
    this.p2p = null;
    this.p2pStatus = 'waiting';
    if (this.playMode !== 'p2p' || typeof BroadcastChannel === 'undefined') return;
    const localPeerId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `chess-${Math.random().toString(36).slice(2, 10)}`;
    const transport = new BroadcastChannelTransport({
      localPeerId,
      channelName: CHESS_P2P_CHANNEL,
    });
    transport.setStateHandler((_peer, state) => {
      this.p2pStatus = normalizeChessHudP2pStatus(state);
      if (state === 'connected' && this.boardReady) {
        this.broadcastWire({ v: 1, t: 'sync', fen: this.match.fen() });
      }
      this.emitHud();
    });
    transport.setMessageHandler((_peer, bytes) => this.onP2pBytes(bytes));
    this.p2p = transport;
  }

  private broadcastWire(message: Parameters<typeof encodeChessWire>[0]): void {
    if (this.playMode !== 'p2p' || !this.p2p) return;
    try {
      this.p2p.broadcast(encodeChessWire(message));
    } catch {
      // No peer yet — BroadcastChannelTransport throws only on directed send.
    }
  }

  private flushPendingP2p(): void {
    const bytes = this.pendingP2pBytes;
    this.pendingP2pBytes = null;
    if (bytes) this.onP2pBytes(bytes);
  }

  private onP2pBytes(bytes: Uint8Array): void {
    const world = this.world;
    if (!world) return;
    const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!this.boardReady) {
      this.pendingP2pBytes = new Uint8Array(raw);
      return;
    }
    const msg = decodeChessWire(raw);
    if (!msg) return;
    if (msg.t === 'reset') {
      this.resetClocks();
      this.rebuildFromFen(world, msg.fen);
      return;
    }
    if (msg.t === 'sync') {
      const decision = decideChessFenSync(this.match.fen(), msg.fen);
      if (decision === 'ignore') return;
      if (decision === 'reply') {
        this.broadcastWire({ v: 1, t: 'sync', fen: this.match.fen() });
        return;
      }
      if (this.motionBusy) this.pendingFen = msg.fen;
      else this.rebuildFromFen(world, msg.fen);
      return;
    }
    this.playProgrammaticMove(world, msg.from, msg.to);
    if (this.match.fen() !== msg.fen) {
      if (this.motionBusy) this.pendingFen = msg.fen;
      else this.rebuildFromFen(world, msg.fen);
    }
  }

  private entityWorldPos(world: World, entity: Entity): [number, number, number] {
    const t = world.getComponent(entity, TransformComponent);
    if (!t) return [0, CHESS_BOARD_SURFACE_Y, 0];
    return [t.position[0]!, t.position[1]!, t.position[2]!];
  }

  private queueFlight(
    entity: Entity,
    from: [number, number, number],
    to: [number, number, number],
    delay: number,
    duration: number
  ): void {
    this.flights.push({ entity, from, to, elapsed: -delay, duration });
    this.motionBusy = true;
  }

  private disablePieceGrab(world: World, entity: Entity): void {
    const collider = world.getComponent(entity, ColliderComponent);
    if (collider) {
      collider.collisionGroup = 0;
      collider.collisionMask = 0;
    }
  }

  private destroyPieceEntity(world: World, entity: Entity): void {
    const node = this.nodeByEntity.get(entity);
    if (node?.parent) node.parent.detach(node);
    world.destroyEntity(entity);
    this.nodeByEntity.delete(entity);
    this.colorByEntity.delete(entity);
    this.squareByEntity.delete(entity);
  }

  private stepFlights(world: World, dt: number): void {
    if (this.flights.length === 0) return;
    const still: PieceFlight[] = [];
    for (const flight of this.flights) {
      flight.elapsed += dt;
      const t = flight.elapsed / flight.duration;
      const pose =
        t <= 0
          ? flight.from
          : t >= 1
            ? flight.to
            : samplePieceTravelWorld(flight.from, flight.to, t);
      const tr = world.getComponent(flight.entity, TransformComponent);
      if (tr) {
        vec3.set(tr.position, pose[0], pose[1], pose[2]);
        tr.updateLocalTransform();
      }
      if (t < 1) still.push(flight);
    }
    this.flights = still;
    if (this.flights.length > 0) return;
    this.motionBusy = false;
    if (this.pendingPromotion && this.sceneRef) {
      const promo = this.pendingPromotion;
      this.pendingPromotion = null;
      this.removePieceAt(world, promo.square);
      this.spawnPiece(world, this.sceneRef, promo.square, promo.role, promo.color);
    }
    if (this.pendingSfx) {
      this.playSfx(this.pendingSfx);
      this.pendingSfx = null;
    }
    if (this.pendingFen) {
      const fen = this.pendingFen;
      this.pendingFen = null;
      this.rebuildFromFen(world, fen);
    }
  }

  private hideBookSpline(world: World): void {
    for (const node of this.splineNodes) {
      const r = world.getComponent(node.entityId, RenderableComponent);
      if (r) r.visible = false;
    }
    if (this.splineHead) {
      const r = world.getComponent(this.splineHead.entityId, RenderableComponent);
      if (r) r.visible = false;
    }
  }

  private tickBookSpline(world: World, totalTime: number): void {
    const expected = this.playMode === 'learn' ? this.trainer?.expected() : null;
    if (
      !expected ||
      this.cpuBusy ||
      this.motionBusy ||
      Boolean(this.grab.grabbed) ||
      Boolean(this.trainer?.isComplete())
    ) {
      this.hideBookSpline(world);
      return;
    }
    const knight = this.match.pieceAt(expected.from)?.role === 'knight';
    const pts = sampleBookMoveSpline(expected.from, expected.to, {
      knight,
      samples: SPLINE_OVERLAY_COUNT,
      liftY: 0.04,
    });
    for (let i = 0; i < this.splineNodes.length; i++) {
      const node = this.splineNodes[i]!;
      const p = pts[i];
      const r = world.getComponent(node.entityId, RenderableComponent);
      const t = world.getComponent(node.entityId, TransformComponent);
      if (!r || !t) continue;
      if (!p) {
        r.visible = false;
        continue;
      }
      vec3.set(t.position, p[0], p[1], p[2]);
      this.bakeOverlayTransform(t);
      r.visible = true;
    }
    const head = this.splineHead;
    if (!head || pts.length < 2) return;
    const u = (totalTime * 0.55) % 1;
    const idx = Math.min(pts.length - 1, Math.floor(u * (pts.length - 1)));
    const a = pts[idx]!;
    const b = pts[Math.min(pts.length - 1, idx + 1)]!;
    const frac = u * (pts.length - 1) - idx;
    const hx = a[0] + (b[0] - a[0]) * frac;
    const hy = a[1] + (b[1] - a[1]) * frac;
    const hz = a[2] + (b[2] - a[2]) * frac;
    const ht = world.getComponent(head.entityId, TransformComponent);
    const hr = world.getComponent(head.entityId, RenderableComponent);
    if (ht && hr) {
      vec3.set(ht.position, hx, hy + 0.001, hz);
      this.bakeOverlayTransform(ht);
      hr.visible = true;
    }
  }

  private startCameraJuice(from: ChessSquareName, to: ChessSquareName): void {
    const orb = this.cameraControllers?.getActiveController();
    if (!(orb instanceof OrbitalCameraController)) return;
    const a = squareToWorld(from);
    const b = squareToWorld(to);
    const dAz = Math.max(-0.07, Math.min(0.07, (b[0]! - a[0]!) * 0.9));
    const dPol = Math.max(-0.035, Math.min(0.02, (b[2]! - a[2]!) * 0.25));
    this.camJuice = {
      restAz: orb.azimuth,
      restPol: orb.polar,
      dAz,
      dPol,
      elapsed: 0,
    };
  }

  private tickCameraJuice(dt: number, engine: EngineWithInput): void {
    const juice = this.camJuice;
    if (!juice) return;
    const input = engine.inputManager;
    if (
      input?.isActionPressed('cameraRotate') ||
      input?.isActionPressed('cameraPan') ||
      (input?.getAxis('cameraZoom') ?? 0) !== 0
    ) {
      this.camJuice = null;
      return;
    }
    const orb = this.cameraControllers?.getActiveController();
    if (!(orb instanceof OrbitalCameraController)) {
      this.camJuice = null;
      return;
    }
    juice.elapsed += dt;
    const u = Math.min(1, juice.elapsed / CAM_JUICE_S);
    const envelope = Math.sin(Math.PI * u);
    orb.setOrbitAngles(juice.restAz + juice.dAz * envelope, juice.restPol + juice.dPol * envelope);
    if (u >= 1) this.camJuice = null;
  }

  private async armAudio(): Promise<void> {
    if (this.audioArmed || !this.audio) return;
    this.audioArmed = true;
    try {
      await this.audio.resume();
      await installChessTableClips(this.audio);
      if (!this.ambience && this.audio.getClip('ambience')) {
        this.ambience = this.audio.playOneShot('ambience', {
          loop: true,
          volume: CHESS_AMBIENCE_VOLUME,
        });
      }
    } catch {
      this.audioArmed = false;
    }
  }

  private disposeChessRuntime(): void {
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.boardReady = false;
    this.pendingP2pBytes = null;
    this.world = null;
    this.ambience?.stop();
    this.ambience = null;
    this.audio?.dispose();
    this.audio = null;
    this.audioArmed = false;
    this.p2p?.closeAll();
    this.p2p = null;
    this.p2pStatus = 'waiting';
    this.camJuice = null;
    uiBus.off(CHESS_HUD_COMMAND_EVENT, this.onHudCommand);
  }

  private playSfx(ids: readonly ChessTableSfxId[]): void {
    const audio = this.audio;
    if (!audio || !this.audioArmed) return;
    for (const id of ids) {
      try {
        if (!audio.getClip(id)) continue;
        audio.playOneShot(id, { volume: CHESS_SFX_VOLUME[id] });
      } catch {
        /* clip missing */
      }
    }
  }
}
