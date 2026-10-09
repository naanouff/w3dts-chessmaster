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
  PointLightComponent,
  PrimitiveFactory,
  RenderGraph,
  RenderableComponent,
  ReflectionProbeComponent,
  SceneNode,
  TransformComponent,
  createDecalSystem,
  type DecalSystemOutput,
  type Entity,
  type FullscreenPassConfig,
  type IEngineContext,
  type InputManager,
  type PbrKhrExtensionCompileFlags,
  type ProjectLoadParams,
  type ShaderGraph,
  type World,
  scheduleReflectionProbeRebake,
} from '@naanouff/w3dts-core';
import { LogChannel } from '@naanouff/w3dts-logger';
import {
  disposeParticleEmitterGpu,
  initializeParticleEmitters,
  ParticleEmitterComponent,
} from '@naanouff/w3dts-particles';
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
  CHESS_COACH_CONTEXT_EVENT,
  CHESS_COACH_OBJECT_EVENT,
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
  splitChessBoardPlayingSurface,
  buildStauntonPieceMesh,
  stauntonPieceHeight,
  buildChessHudLearnPlies,
  chessBoardLabelPoses,
  chessBoardLabelQuat,
  chessBoardLabelSize,
  chessPlayP2pHint,
  chessTableSfxForPly,
  chessScoreForLocal,
  coachMaterial,
  clientPointToNdc,
  CHESS_CLOCK_START_S,
  ONLINE_GUEST_WAIT_MS,
  guestWaitExpired,
  CHESS_SAVES_EVENT,
  SAVED_GAMES_KEY,
  acceptSavedGame,
  clocksFromWire,
  cpuAcceptsDrawOffer,
  cpuSearchDepth,
  decodeChessWire,
  dropInterrupt,
  dropVoluntary,
  emptySaveCabinet,
  noteInterrupt,
  parseSaveCabinet,
  putVoluntary,
  chessRelayUrl,
  decideChessFenSync,
  decideOnlineHello,
  encodeChessWire,
  fillBoardAlbedo,
  fillChessGlyphAlbedo,
  intersectRayHorizontalPlane,
  normalizeChessHudP2pStatus,
  parseChessDemoQuery,
  parseChessHudCommand,
  pieceHoverSquare,
  pickRayFromViewProjection,
  replaceChessDemoQueryInLocation,
  sampleBookMoveSpline,
  samplePieceTravelWorld,
  seatChessPieceUpright,
  peerClockWaiting,
  stepChessClock,
  squareToWorld,
  stauntonPieceColliderShapes,
  stripChessSanSuffix,
  viewProjectionFromWorldTransform,
  worldToSquare,
  type ChessColor,
  type ChessDemoQuery,
  type ChessHudP2pStatus,
  type ChessPlayMode,
  type SaveCabinet,
  type SavedGame,
  type SavedShellMode,
  type ChessPieceRole,
  type ChessSquareName,
  type ChessTableSfxId,
  type CoachGhostStep,
  type TrainingPly,
  COACH_MASK_SCALE,
  coachErrorColor,
  coachGhostColor,
  coachMaskPosition,
  coachPinnedSquares,
  coachStableMarks,
  lastUserPly,
  recordPly,
  reviewPlayedMove,
  shouldCpuReply,
  undoMyMove,
} from '../../chess';
import {
  BroadcastChannelTransport,
  WebSocketRelayTransport,
  type ITransport,
} from '@naanouff/w3dts-multiplayer-p2p';
import { mat4, quat, vec3 } from 'gl-matrix';
import { chessBus as uiBus } from '../bus';
import { fetchSceneDdGraphJson } from './assetFetch';
import {
  createBrushedSteelMaterial,
  createMarbleMaterial,
  CHESS_BOARD_CLEARCOAT_FACTOR,
  CHESS_BOARD_CLEARCOAT_ROUGHNESS,
  chessBoardCheckerPlacement,
  chessBoardSurfaceMaterials,
  loadChessBoardPhotoMaterials,
  loadChessPhotoPbrMaterials,
  loadChessPieceShaderGraphs,
  loadChessMoveGlowTexture,
  createChessCutoutMaterial,
  createChessGhostMaterial,
  CHESS_PIECE_HOVER_GLOW,
  chessMoveGlowRecipe,
  createChessMoveGlowMaterial,
  patchChessPhotoMaterialsFromCache,
} from './chessLook';
import { hdPieceCollider, hdPieceKey, loadHdChessPieces, type HdChessPiece } from './hdChessPieces';
import {
  remapChessOverlayMaterialsToGlow,
  remapChessSceneMaterialsToPhoto,
} from './chessSceneRuntime';
import { createWoodMaterial, loadWoodShaderGraph } from './woodLook';
import {
  bindChessAmbienceBeds,
  ChessAmbienceBeds,
  chessSfxGain,
  installChessTableClips,
} from './chessTableAudio';
import { getGraphicsBenchMotion, noteGraphicsBenchPose } from '../graphics/graphicsBenchMotion';
import { isGraphicsBenchSearch } from '../graphics/graphicsBench';
import {
  CHESS_STUDIO_SUN_COLOR,
  chessSetAmbient,
  chessSetBoardY,
  chessSetLook,
  chessSetReflectionProbe,
  chessSetSunIntensity,
  getChessAmbiance,
  subscribeChessAmbiance,
  type ChessAmbianceId,
} from './chessAmbiance';
import { applyReviewFog, applyRoomSky, gardenShadowBox } from './gardenStage';
import { terraceShadowBox } from './terraceStage';
import {
  applyReviewDof,
  applyReviewGrade,
  chessReviewFrame,
  isChessSetReview,
  setChessReviewFrame,
  subscribeChessCameraArrival,
  subscribeChessReviewFrame,
  subscribeReviewGrade,
  type ChessReviewFrame,
} from './chessSetReview';
import {
  chessReviewColor,
  chessReviewPiece,
  reviewPieceCamera,
  reviewPieceVisible,
  subscribeChessReviewColor,
  subscribeChessReviewPiece,
} from './chessPieceReview';
import { chessCameraArrival, chessCameraArrivalPose } from './chessCameraArrival';
import { chessGameCameraPose } from './chessGameCamera';
import {
  applyChessShadowMode,
  getChessGraphicsSettings,
  subscribeChessGraphics,
  scaleChessGraphResources,
  shadowMapSize,
  upscaleRenderScale,
  upscaleSharpness,
} from '../graphics/chessGraphicsSettings';
import {
  cigarTip,
  hearthFlicker,
  sceneLifeEnabled,
  sceneLifeForRoom,
  sceneLifeWanted,
  subscribeSceneLife,
} from './chessSceneLife';
import { loadChessSet } from './spawnChessSet';
import { sceneLifeFloorY, spawnSceneLife } from './spawnSceneLife';

/** Studio cloth plane size (must match the mesh in onInit). */
const CHESS_STUDIO_TABLE_EXTENT = 4.2;
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

/** Clearcoat varnish on the painted checker, used only when the photo maps fail. */
const CHESS_BOARD_VARNISH_KHR: PbrKhrExtensionCompileFlags = {
  ...CORE_PBR_KHR_FLAGS,
  khrMaterialsClearcoat: true,
};

type EngineWithInput = IEngineContext & {
  inputManager?: InputManager;
  isGameViewInputActive?: () => boolean;
  getGameViewCanvas?: () => HTMLCanvasElement | null;
};

const GAME_CAM_FOV = (38 * Math.PI) / 180;
/** Initial clip only; orbit `updateClipPlanes` owns near/far after RMB zoom. */
const GAME_CAM_NEAR = 0.002;
const GAME_CAM_FAR = 20;
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

  public override async configureRenderGraph(
    graph: RenderGraph,
    engine: Engine,
    view: 'scene' | 'game'
  ): Promise<void> {
    engine.renderer.setShadowMapSize(shadowMapSize(getChessGraphicsSettings().shadowMode));
    await super.configureRenderGraph(graph, engine, view);
    if (view !== 'game') return;
    const mode = getChessGraphicsSettings().upscale;
    const scale = upscaleRenderScale(mode);
    if (scale !== 1) {
      const response = await fetch('/graphs/StandardLitGraphChess.json');
      const definition = (await response.json()) as {
        resources: {
          name: string;
          format: GPUTextureFormat;
          sizeType: 'absolute' | 'relative';
          width: number;
          height: number;
          usage: GPUTextureUsageFlags;
        }[];
      };
      for (const resource of scaleChessGraphResources(definition.resources, scale)) {
        if (resource.sizeType !== 'relative') continue;
        graph.registerResource({
          type: 'texture',
          name: resource.name,
          format: resource.format,
          sizeType: 'relative',
          width: resource.width,
          height: resource.height,
          usage: resource.usage,
        });
      }
    }
    const upscale = graph.getPasses().find((pass) => pass.name === '08_Upscale');
    if (upscale?.type === 'fullscreen') {
      const sharpness = (upscale as FullscreenPassConfig).uniforms?.sharpness;
      if (sharpness) sharpness.value = upscaleSharpness(mode);
    }
  }

  /** Board footprint in XZ, piece height in Y, including the salon lift. */
  private chessShadowAabb(): { min: [number, number, number]; max: [number, number, number] } {
    if (getChessAmbiance() === 'jardin') return gardenShadowBox();
    if (getChessAmbiance() === 'terrasse') return terraceShadowBox();
    const half = CHESS_BOARD_MESH_EXTENT / 2;
    const lift = this.boardLift;
    return {
      min: [-half, -CHESS_BOARD_BODY_HEIGHT - 0.02 + lift, -half],
      max: [half, stauntonPieceHeight('king') + CHESS_GRAB_LIFT_M + lift, half],
    };
  }

  private applyChessShadow(renderer: Engine['renderer']): void {
    renderer.csmIncludeAabb = this.chessShadowAabb();
    applyChessShadowMode(renderer, getChessGraphicsSettings());
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
  private hdPieces: Map<string, HdChessPiece> | null = null;
  private marbleMat: Material | null = null;
  private steelMat: Material | null = null;
  private sceneRef: SceneNode | null = null;
  private overlayNodes: SceneNode[] = [];
  private hoverNode: SceneNode | null = null;
  private hoverLegalMat: Material | null = null;
  private hoverHomeMat: Material | null = null;
  private hoverIllegalMat: Material | null = null;
  private hoverPieceMat: Material | null = null;
  private legalDropSquares = new Set<ChessSquareName>();
  private playMode: ChessPlayMode = 'cpu';
  private localColor: ChessColor = 'white';
  private tableKind: SavedShellMode = 'cpu';
  /** Online restore waits in the lobby, then sends `restore` when the guest connects. */
  private holdForLobby = false;
  private pendingRestore = false;
  /** The invited window reads the cabinet and does not overwrite the interruption. */
  private peerWindow = false;
  private cpu = new HeuristicChessEngine({ depth: 2, thinkMs: 280 });
  private cpuBusy = false;
  private cpuGen = 0;
  private clockWhite = CHESS_CLOCK_START_S;
  private clockBlack = CHESS_CLOCK_START_S;
  private hudClockWhite = CHESS_CLOCK_START_S;
  private hudClockBlack = CHESS_CLOCK_START_S;
  /** Side that ran out of time; independent of chessops (clocks are local). */
  private clockFlag: ChessColor | null = null;
  /** Side that resigned; null while the game continues. */
  private resignLoser: ChessColor | null = null;
  private agreedDraw = false;
  private drawOffer: 'none' | 'incoming' | 'refused' = 'none';
  private cpuDepth = 2;
  private p2p: ITransport | null = null;
  private p2pStatus: ChessHudP2pStatus = 'waiting';
  private roomId = '';
  private onlineSeat: 'host' | 'guest' | null = null;
  private onlineReady = false;
  private onlineRefused = false;
  private guestTimer: ReturnType<typeof setTimeout> | null = null;
  private trainer: OpeningTrainer | null = null;
  private learnQuiz = false;
  private learnEco = 'C50';
  private learnMiss = false;
  private learnLastSan: string | null = null;
  private trainingLog: TrainingPly[] = [];
  private coachHistory: string[] = [];
  private trainingHeld = false;
  /** Ten-minute clocks stay off until the student asks for them. */
  private trainingClock = false;
  private ghostMats: Material[] = [];
  private ghostNodes = new Map<string, SceneNode>();
  private ghostSteps: CoachGhostStep[] = [];
  /** Depth of the line drawn for the student. The objection uses the same depth. */
  private coachHorizon = 3;
  /** Source squares accepted when the current line was drawn. */
  private pinnedCutouts = new Set<string>();
  private cutoutMats: Material[] = [];
  private errorCutoutMat: Material | null = null;
  private cutoutNodes = new Map<string, SceneNode>();
  /** Square of the piece that just played a weak move. */
  private mistakeSquare: ChessSquareName | null = null;
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
  private readonly graphicsBench = isGraphicsBenchSearch(
    typeof location === 'undefined' ? '' : location.search
  );
  private benchPawn: Entity | null = null;
  private benchTowardE4 = true;
  private benchMoved = false;
  private benchDrag = 0;
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
  /** Opening fly-in. Null once the game camera is reached, and never set in the review. */
  private cameraArrival: { elapsed: number } | null = null;
  private audio: WebAudioService | null = null;
  private ambienceBeds = new ChessAmbienceBeds();
  private audioArmed = false;
  private flagSfxPlayed = false;
  /** Pieces/meshes exist; P2P must not apply FEN until this is true. */
  private boardReady = false;
  private stopAmbiance: (() => void) | null = null;
  private stopGrade: (() => void) | null = null;
  private stopReview: (() => void) | null = null;
  private stopLife: (() => void) | null = null;
  private lifeNodes: SceneNode[] = [];
  private lifeFloorY = 0;
  private lifeLock: Promise<void> = Promise.resolve();
  private hearthRest = new Map<number, number>();
  private readonly reviewing = isChessSetReview(
    typeof location === 'undefined' ? '' : location.search
  );
  private sunEntity: number | null = null;
  private clothNode: SceneNode | null = null;
  private boardBody: SceneNode | null = null;
  private boardTop: SceneNode | null = null;
  /** Salon review puts the board on the cloth. Atelier and Club stay at 0. */
  private boardLift = 0;
  private setNodes: SceneNode[] = [];
  private probeNode: SceneNode | null = null;
  private setGen = 0;
  private setDevice: GPUDevice | null = null;
  private setResources: ProjectLoadParams['resourceManager'] | null = null;
  private setGraph: ShaderGraph | null = null;
  private setLogger: ProjectLoadParams['logger'] | null = null;
  private pendingP2pBytes: Uint8Array | null = null;
  private playSimWasAllowed = false;

  public getDecalOutput(): DecalSystemOutput | null {
    return this.decalOutput;
  }

  private readonly onPageHide = (): void => {
    this.rememberInterrupt(true);
  };

  private readonly onHudCommand = (raw: unknown): void => {
    const cmd = parseChessHudCommand(raw);
    if (!cmd) return;
    if (cmd.type === 'mode-picker') {
      this.modePickerOpen = cmd.open;
      if (cmd.open) this.rememberInterrupt(true);
      if (cmd.open && this.world && this.grab.grabbed) this.grab.end(this.world);
      if (!cmd.open && this.drawOffer === 'refused') {
        this.drawOffer = 'none';
        this.emitHud();
      }
      return;
    }
    if (cmd.type === 'request-state') {
      this.emitHud();
      return;
    }
    if (cmd.type === 'reset-match') {
      if (this.world) this.resetMatch(this.world, true);
      return;
    }
    if (cmd.type === 'close-table') {
      this.closeOnlineTable();
      return;
    }
    if (cmd.type === 'save-voluntary') {
      this.saveVoluntary();
      return;
    }
    if (cmd.type === 'discard-interrupt') {
      this.storeCabinet(dropInterrupt(this.readCabinet()));
      return;
    }
    if (cmd.type === 'delete-voluntary') {
      this.storeCabinet(dropVoluntary(this.readCabinet(), cmd.id));
      return;
    }
    if (cmd.type === 'resume-saved') {
      this.modePickerOpen = false;
      this.restoreGame(cmd.game, undefined, cmd.cpuDepth);
      return;
    }
    if (cmd.type === 'training-stop') {
      this.holdTraining();
      return;
    }
    if (cmd.type === 'training-resume') {
      this.resumeTraining();
      return;
    }
    if (cmd.type === 'training-undo') {
      this.undoTrainingMove();
      return;
    }
    if (cmd.type === 'training-clock') {
      if (this.playMode === 'training') {
        this.trainingClock = cmd.on;
        this.emitHud();
      }
      return;
    }
    if (cmd.type === 'coach-ghosts') {
      this.coachHorizon = cmd.horizon;
      if (this.world) this.showCoachGhosts(this.world, cmd.steps);
      return;
    }
    if (cmd.type === 'resign') {
      this.applyResign(this.playMode === 'hotseat' ? this.match.sideToMove() : this.localColor);
      return;
    }
    if (cmd.type === 'offer-draw') {
      this.offerDraw();
      return;
    }
    if (cmd.type === 'accept-draw') {
      this.acceptDraw(true);
      return;
    }
    if (cmd.type === 'refuse-draw') {
      this.refuseDraw(true);
      return;
    }
    const waitingOnline = cmd.table === 'online';
    if (!waitingOnline) this.modePickerOpen = false;
    this.applySession(cmd.session, cmd.table);
    if (waitingOnline) this.modePickerOpen = true;
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
    this.cameraArrival = null;
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
    this.clearTraining();
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
      this.aimActiveCamera(world, this.chessEngine);
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
    this.hoverPieceMat =
      resourceManager.getMaterialByName(CHESS_PIECE_HOVER_GLOW.name) ?? this.hoverPieceMat;
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
    this.clearManualEnd();
    this.boardReady = false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      this.peerWindow = params.get('chessPeer') === '1';
      const shell = params.get('chessShell');
      if (shell === 'local' || shell === 'online') this.tableKind = shell;
      window.removeEventListener('beforeunload', this.onPageHide);
      window.addEventListener('beforeunload', this.onPageHide);
    }
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
    this.setDevice = device;
    this.setResources = resourceManager;
    this.setGraph = pbrGraph;
    this.setLogger = logger;
    let photoPieces = false;
    try {
      this.hdPieces = await loadHdChessPieces(device, resourceManager, pbrGraph);
      if (this.hdPieces) {
        logger.info(LogChannel.DataLifecycle, 'ChessDemoProject: HD Staunton GLBs loaded.');
      }
    } catch (e) {
      this.hdPieces = null;
      logger.warn(
        LogChannel.DataLifecycle,
        'ChessDemoProject: HD piece GLBs skipped.',
        e as Error
      );
    }
    if (!this.hdPieces) {
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
    }

    let photoBoard: { top: Material; gold: Material } | null = null;
    try {
      photoBoard = await loadChessBoardPhotoMaterials(device, resourceManager, pbrGraph);
    } catch (e) {
      logger.warn(
        LogChannel.DataLifecycle,
        'ChessDemoProject: photo wood/gold board maps skipped; using canvas + wood graph.',
        e as Error
      );
    }

    let fallbackTop: Material | null = null;
    let fallbackRim: Material | null = null;
    if (!photoBoard) {
      const boardPixels = new Uint8ClampedArray(1024 * 1024 * 4);
      fillBoardAlbedo(boardPixels, 1024);
      const boardTex = uploadRgbaTexture(device, 'chess-board-albedo', boardPixels, 1024);
      resourceManager.registerTexture('chess/board/canvas-albedo', boardTex);
      fallbackTop = new Material({
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
      resourceManager.uploadMaterial(fallbackTop);
      try {
        const woodGraph = await loadWoodShaderGraph();
        fallbackRim = createWoodMaterial(resourceManager, woodGraph);
        fallbackRim.properties.set('normalDetailScale', 0);
        fallbackRim.properties.set('triplanarScale', 0.58);
        fallbackRim.properties.set('knotAmount', 0);
        fallbackRim.properties.set('anisotropy', 0);
        fallbackRim.properties.set('cavityAmount', 0.15);
        fallbackRim.properties.set('heightInfluence', 0);
        fallbackRim.properties.set('roughness', 0.62);
        fallbackRim.properties.set('woodColor', [0.24, 0.17, 0.14]);
        fallbackRim.properties.set('grainColor', [0.15, 0.1, 0.08]);
      } catch {
        fallbackRim = new Material({
          name: 'ChessBoardEdge',
          shadingModel: 'pbr',
          shaderGraph: pbrGraph,
          properties: {
            baseColor: [0.18, 0.12, 0.1],
            roughness: 0.78,
            metallic: 0,
          },
        });
        resourceManager.uploadMaterial(fallbackRim);
      }
    }

    const surfaces = chessBoardSurfaceMaterials(
      photoBoard,
      { top: fallbackTop!, rim: fallbackRim! }
    );
    const boardMat = surfaces.top;
    const edgeMat = surfaces.rim;

    if (!this.hdPieces) {
      const roles: ChessPieceRole[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
      // Bake each GPROC graph once; the 32 board slots share these six meshes (CHESS-B4e).
      for (const role of roles) {
        let mesh = buildStauntonPieceMesh(role);
        if (photoPieces) mesh = applyCylindricalPieceUvs(mesh);
        resourceManager.uploadMesh(mesh);
        this.pieceMeshes.set(role, mesh);
      }
    }

    const boardSlab = buildChessBoardBodyMesh(CHESS_BOARD_MESH_EXTENT, BOARD_HALF_Y * 2);
    const { rim: boardBodyMesh } = splitChessBoardPlayingSurface(
      boardSlab,
      CHESS_BOARD_MESH_EXTENT
    );
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
    this.boardBody = board;

    this.showStudioCloth(world, scene, resourceManager, pbrGraph);

    const checker = chessBoardCheckerPlacement();
    boardMat.doubleSided = checker.doubleSided;
    const topMesh = PrimitiveFactory.createPlane(CHESS_BOARD_MESH_EXTENT);
    topMesh.name = 'ChessBoardChecker';
    resourceManager.uploadMesh(topMesh);
    const top = new SceneNode('ChessBoardTop', world, topMesh, boardMat);
    const topT = world.getComponent(top.entityId, TransformComponent);
    if (topT) {
      vec3.set(topT.position, 0, checker.y, 0);
      topT.updateLocalTransform();
    }
    const topRenderable = world.getComponent(top.entityId, RenderableComponent);
    if (topRenderable) topRenderable.castShadow = checker.castShadow;
    scene.add(top);
    this.boardTop = top;

    for (const piece of this.match.pieces()) {
      this.spawnPiece(world, scene, piece.square, piece.role, piece.color);
    }
    this.applyReviewPiece(world);

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
    void installChessTableClips(this.audio, getChessAmbiance()).catch(() => {
      /* autoplay / missing context */
    });

    const sun = new SceneNode('ChessSun', world);
    this.sunEntity = sun.entityId;
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
    await this.replaceChessSet();

    if (!engine.scheduler.hasSystemWithName('physicsSystem')) {
      engine.scheduler.prependSystem(
        createPhysicsSystem({ gravity: [0, -9.81, 0], skinWidth: 0.002 })
      );
    }

    const half = CHESS_SQUARE_SIZE * 4;
    cameraControllerManager.setController('orbital');
    const controller = cameraControllerManager.getActiveController();
    controller?.frameBoundingBox({ min: [-half, 0, -half], max: [half, 0.2, half] });
    this.stopReview?.();
    this.stopReview = null;
    this.aimActiveCamera(world, engine);
    if (this.reviewing) {
      const stopFrame = subscribeChessReviewFrame(() => {
        this.cameraArrival = null;
        const live = this.world;
        if (!live) return;
        this.aimActiveCamera(live, engine);
      });
      const onPiece = (): void => {
        this.cameraArrival = null;
        const live = this.world;
        if (!live) return;
        this.applyReviewPiece(live);
        this.aimActiveCamera(live, engine);
      };
      const stopPiece = subscribeChessReviewPiece(onPiece);
      const stopColor = subscribeChessReviewColor(onPiece);
      const stopArrival = subscribeChessCameraArrival(() => {
        this.beginCameraArrival(true);
      });
      this.stopReview = () => {
        stopFrame();
        stopPiece();
        stopColor();
        stopArrival();
      };
    }
    this.emitHud();
    this.boardReady = true;
    if (!this.tryResumeFromLocation(query)) {
      this.bindP2p();
      this.flushPendingP2p();
    }

    logger.info(
      LogChannel.Gameplay,
      `ChessDemoProject: mode=${this.playMode} as ${this.localColor}. LMB grab, X reset.`
    );
  }

  protected override async initializeEnvironment(engine: Engine): Promise<void> {
    await super.initializeEnvironment(engine);
    this.stopAmbiance?.();
    this.stopAmbiance = subscribeChessAmbiance(() => {
      void this.applyAmbianceEnvironment(engine);
      void this.replaceChessSet();
      void this.refreshAmbianceAudio();
    });
    this.stopGrade?.();
    this.stopGrade = subscribeReviewGrade(() => {
      const id = getChessAmbiance();
      applyReviewGrade(engine.renderGraph.getPasses(), id);
      applyReviewGrade(engine.gameRenderGraph.getPasses(), id);
    });
    this.stopLife?.();
    const stopVie = subscribeSceneLife(() => this.enqueueSceneLife());
    let textureQuality = getChessGraphicsSettings().textureQuality;
    const stopGraphics = subscribeChessGraphics((value) => {
      this.enqueueSceneLife();
      if (value.textureQuality === textureQuality) return;
      textureQuality = value.textureQuality;
      void this.replaceChessSet();
    });
    this.stopLife = () => {
      stopVie();
      stopGraphics();
    };
    await this.applyAmbianceEnvironment(engine);
  }

  /**
   * Keeps the room lights and its environment fill. The match does not load an HDRI.
   * @param engine - Running engine.
   */
  private async applyAmbianceEnvironment(engine: Engine): Promise<void> {
    const { renderer } = engine;
    // The procedural sky is a daylight gradient, and its irradiance feeds the diffuse IBL
    // at full energy, outside iblIntensity. Dropping the maps is the only way a night room
    // reads as night; the fill then comes from the shader's flat ambient, which iblIntensity scales.
    renderer.setIBLMaps(null);
    renderer.iblIntensity = chessSetAmbient(getChessAmbiance());
    const id = getChessAmbiance();
    applyRoomSky(engine.renderGraph.getPasses(), id);
    applyRoomSky(engine.gameRenderGraph.getPasses(), id);
    applyReviewFog(engine.renderGraph.getPasses(), id);
    applyReviewFog(engine.gameRenderGraph.getPasses(), id);
    applyReviewDof(engine.renderGraph.getPasses(), id);
    applyReviewDof(engine.gameRenderGraph.getPasses(), id);
    applyReviewGrade(engine.renderGraph.getPasses(), id);
    applyReviewGrade(engine.gameRenderGraph.getPasses(), id);
    this.applyChessShadow(renderer);
    this.applyAmbianceSun();
  }

  /** Studio sun while the cloth is the floor. A loaded set uses the review intensity and direction. */
  private applyAmbianceSun(): void {
    const world = this.world;
    if (!world || this.sunEntity === null) return;
    const light = world.getComponent(this.sunEntity, DirectionalLightComponent);
    const transform = world.getComponent(this.sunEntity, TransformComponent);
    if (!light || !transform) return;
    const cloth = this.setNodes.length === 0;
    const id = getChessAmbiance();
    const color = cloth ? CHESS_STUDIO_SUN_COLOR : (chessSetLook(id).sunColor ?? CHESS_STUDIO_SUN_COLOR);
    light.color[0] = color[0];
    light.color[1] = color[1];
    light.color[2] = color[2];
    light.intensity = chessSetSunIntensity(id, cloth);
    if (cloth) {
      quat.fromEuler(transform.rotation, -58, -18, 0);
    } else {
      const pos = chessSetLook(id).sunPos;
      if (pos) {
        const dx = -pos[0];
        const dy = -pos[1];
        const dz = -pos[2];
        const length = Math.hypot(dx, dy, dz) || 1;
        quat.rotationTo(transform.rotation, [0, -1, 0], [dx / length, dy / length, dz / length]);
      }
    }
    transform.updateLocalTransform();
  }

  /** Playing-surface height, including the salon cloth lift. */
  private playingY(y: number): number {
    return y + this.boardLift;
  }

  /**
   * Moves the board and the pieces that stand on it. Captured pieces stay on the table.
   * @param next - Metres above the default surface. Zero while the studio cloth is the floor.
   */
  private setBoardLift(next: number): void {
    const delta = next - this.boardLift;
    if (Math.abs(delta) < 1e-6) return;
    this.boardLift = next;
    const world = this.world;
    if (!world) return;
    this.shiftEntityY(world, this.boardBody?.entityId, delta);
    this.shiftEntityY(world, this.boardTop?.entityId, delta);
    const onBoard = new Set(this.entityBySquare.values());
    for (const entity of onBoard) this.shiftEntityY(world, entity, delta);
    for (const flight of this.flights) {
      if (!onBoard.has(flight.entity)) continue;
      flight.from[1] += delta;
      flight.to[1] += delta;
    }
    this.syncFileRankLabels(world);
    if (this.chessEngine) this.applyChessShadow(this.chessEngine.renderer);
  }

  private shiftEntityY(world: World, entity: Entity | undefined, delta: number): void {
    if (entity === undefined) return;
    const transform = world.getComponent(entity, TransformComponent);
    if (!transform) return;
    transform.position[1] += delta;
    transform.updateLocalTransform();
  }

  /**
   * Replaces the room around the board. A missing GLB puts the cloth back and leaves the stored choice.
   */
  private async replaceChessSet(): Promise<void> {
    const scene = this.sceneRef;
    const world = this.world;
    const device = this.setDevice;
    const resourceManager = this.setResources;
    const pbrGraph = this.setGraph;
    if (!scene || !world || !device || !resourceManager || !pbrGraph) return;
    const gen = ++this.setGen;
    await this.lifeLock;
    if (gen !== this.setGen) return;
    this.dropSceneLife();
    this.restoreHearth(world);
    const id = getChessAmbiance();
    let nodes: SceneNode[] | null = null;
    try {
      nodes = await loadChessSet(
        { device, world, resourceManager, pbrGraph },
        id,
        getChessGraphicsSettings().textureQuality
      );
    } catch (e) {
      nodes = null;
      this.setLogger?.warn(LogChannel.DataLifecycle, 'ChessDemoProject: set props skipped.', e as Error);
    }
    if (gen !== this.setGen) return;
    this.clearSetNodes();
    if (!nodes) {
      this.showStudioCloth(world, scene, resourceManager, pbrGraph);
      this.setBoardLift(0);
      this.applyAmbianceSun();
      this.placeReflectionProbe(id);
      return;
    }
    this.hideStudioCloth();
    for (const node of nodes) scene.add(node);
    this.setNodes = nodes;
    this.setBoardLift(chessSetBoardY(id));
    this.applyAmbianceSun();
    this.placeReflectionProbe(id);
    this.setLogger?.info(
      LogChannel.EngineLifecycle,
      `ChessDemoProject: ${id} set applied (${nodes.length} nodes).`
    );
    this.enqueueSceneLife();
  }

  /**
   * GPU init after the project load. Room changes call the same spawn again.
   * @param _params - Load params. The stored engine is enough.
   */
  public async postLoadGpuInit(_params: ProjectLoadParams): Promise<void> {
    this.enqueueSceneLife();
  }

  /** Queues a respawn so a room change cannot dispose emitters mid-init. */
  private enqueueSceneLife(): void {
    const job = this.lifeLock.then(() => this.syncSceneLife());
    this.lifeLock = job.catch((err) => {
      this.setLogger?.warn(LogChannel.DataLifecycle, 'ChessDemoProject: scene life skipped.', err as Error);
    });
  }

  /** Drops the previous emitters, then spawns the room's list when the review allows it. */
  private async syncSceneLife(): Promise<void> {
    const world = this.world;
    const scene = this.sceneRef;
    const device = this.setDevice;
    const resourceManager = this.setResources;
    const pbrGraph = this.setGraph;
    const engine = this.chessEngine;
    const logger = this.setLogger;
    if (!world || !scene || !device || !resourceManager || !pbrGraph || !engine || !logger) return;
    this.dropSceneLife();
    if (!this.lifeWanted()) {
      this.restoreHearth(world);
      return;
    }
    const room = getChessAmbiance();
    const specs = sceneLifeForRoom(true, true, room);
    this.lifeFloorY = sceneLifeFloorY(world, this.setNodes);
    const nodes = await spawnSceneLife(
      { device, world, resourceManager, pbrGraph, logger },
      specs,
      this.lifeFloorY,
      scene
    );
    this.lifeNodes = nodes;
    if (!this.lifeWanted() || getChessAmbiance() !== room) {
      this.dropSceneLife();
      return;
    }
    await initializeParticleEmitters(world, engine.webGPUContext, resourceManager, logger);
    if (!this.lifeWanted() || getChessAmbiance() !== room) this.dropSceneLife();
  }

  /** Frees GPU buffers, then destroys the life entities. */
  private dropSceneLife(): void {
    const world = this.world;
    const scene = this.sceneRef;
    if (!world || !scene) {
      this.lifeNodes = [];
      return;
    }
    for (const node of this.lifeNodes) {
      const emitter = world.getComponent(node.entityId, ParticleEmitterComponent);
      if (emitter) disposeParticleEmitterGpu(emitter, world);
      scene.remove(node);
    }
    this.lifeNodes = [];
  }

  /** Puts the hearth point back to the intensity written on the room. */
  private restoreHearth(world: World): void {
    this.applyHearth(world, null);
    this.hearthRest.clear();
  }

  /**
   * Scales the salon hearth. Other rooms have no light in this range.
   * @param world - World that owns the set lights.
   * @param factor - Multiplier, or null to restore the authored intensity.
   */
  private applyHearth(world: World, factor: number | null): void {
    for (const node of this.setNodes) {
      const light = world.getComponent(node.entityId, PointLightComponent);
      if (!light || Math.abs(light.range - 2.2) > 0.05) continue;
      if (!this.hearthRest.has(node.entityId)) this.hearthRest.set(node.entityId, light.intensity);
      const rest = this.hearthRest.get(node.entityId) ?? light.intensity;
      light.intensity = factor === null ? rest : rest * factor;
    }
  }

  /** Review Vie, or the match preset. */
  private lifeWanted(): boolean {
    return sceneLifeWanted(this.reviewing, sceneLifeEnabled(), getChessGraphicsSettings().sceneLife);
  }

  /**
   * Flickers the hearth and walks the cigar.
   * @param world - World that owns the lights and the tip.
   * @param time - Seconds since the engine started.
   */
  private tickSceneLife(world: World, time: number): void {
    if (!this.lifeWanted()) {
      if (this.hearthRest.size > 0) this.restoreHearth(world);
      return;
    }
    const flicker = getChessAmbiance() === 'salon';
    if (flicker) this.applyHearth(world, hearthFlicker(time));
    else if (this.hearthRest.size > 0) this.restoreHearth(world);
    const tip = cigarTip(time);
    for (const node of this.lifeNodes) {
      if (!node.name.startsWith('ChessLife-cigar-')) continue;
      const transform = world.getComponent(node.entityId, TransformComponent);
      if (!transform) continue;
      vec3.set(transform.position, tip.ember[0], this.lifeFloorY + tip.ember[1], tip.ember[2]);
      transform.updateLocalTransform();
    }
  }

  /**
   * One cubemap at the room centre. The floor SSR pass is left as it is.
   * @param id - Room just applied.
   */
  private placeReflectionProbe(id: ChessAmbianceId): void {
    const world = this.world;
    const scene = this.sceneRef;
    if (!world || !scene) return;
    if (!getChessGraphicsSettings().reflectionProbes) {
      if (this.probeNode) scene.remove(this.probeNode);
      this.probeNode = null;
      return;
    }
    const spec = chessSetReflectionProbe(id);
    if (!this.probeNode) {
      const node = new SceneNode('ChessReflectionProbe', world);
      this.probeNode = node;
      scene.add(node);
      world.addComponent(
        node.entityId,
        new ReflectionProbeComponent({
          radius: spec.radius,
          boxHalfExtents: vec3.fromValues(spec.boxHalf[0], spec.boxHalf[1], spec.boxHalf[2]),
        })
      );
    }
    const transform = world.getComponent(this.probeNode.entityId, TransformComponent);
    if (transform) {
      vec3.set(transform.position, spec.center[0], spec.center[1], spec.center[2]);
      transform.updateLocalTransform();
    }
    const probe = world.getComponent(this.probeNode.entityId, ReflectionProbeComponent);
    if (probe) {
      probe.radius = spec.radius;
      vec3.set(probe.boxHalfExtents, spec.boxHalf[0], spec.boxHalf[1], spec.boxHalf[2]);
    }
    const engine = this.chessEngine;
    if (engine) scheduleReflectionProbeRebake(engine as Engine);
  }

  private clearSetNodes(): void {
    const scene = this.sceneRef;
    if (!scene) return;
    for (const node of this.setNodes) scene.remove(node);
    this.setNodes = [];
  }

  private showStudioCloth(
    world: World,
    scene: SceneNode,
    resourceManager: ProjectLoadParams['resourceManager'],
    pbrGraph: ShaderGraph
  ): void {
    if (this.clothNode) return;
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
    this.clothNode = table;
  }

  private hideStudioCloth(): void {
    const scene = this.sceneRef;
    if (!scene || !this.clothNode) return;
    scene.remove(this.clothNode);
    this.clothNode = null;
  }

  public override updateTime(_h: number): void {
    // Keep ChessSun. Lit ToD would overwrite it.
  }

  public override update(_deltaTime: number, _totalTime: number): void {
    const world = this.world;
    const engine = this.chessEngine;
    if (!world || !engine) return;
    this.tickSceneLife(world, _totalTime);
    this.tuneGameCamera(world, engine);
    this.syncCoachCutouts(world);

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
    if (this.graphicsBench) this.tickGraphicsBench(world, _deltaTime);
    this.tickBookSpline(world, _totalTime);
    this.tickCameraJuice(_deltaTime, engine);
    this.tickCameraArrival(_deltaTime, engine);
    this.tickClocks(_deltaTime);
    if (this.modePickerOpen) return;
    this.pumpCpu();
    this.pumpLearnCoach();

    const input = engine.inputManager;
    if (!input) return;
    const overGame = this.isPointerOverGame(input);
    const gameFocus = engine.isGameViewInputActive?.() ?? false;
    if (!overGame && !gameFocus && !this.grab.grabbed) {
      this.setDropHover(world, null);
      return;
    }

    if (input.isActionJustPressed('resetKart')) this.resetMatch(world, true);

    const select = input.isActionPressed('select');
    const just = select && !this.wasSelect;
    const released = !select && this.wasSelect;
    this.wasSelect = select;

    if (just) this.onSelectDown(world, engine, input);
    if (select && this.grab.grabbed) this.onSelectHold(world, engine, input, _deltaTime);
    else if (released && this.grab.grabbed) this.onSelectUp(world);
    else if (!this.grab.grabbed) this.updatePieceHover(world, engine, input, overGame);
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

 /** Game camera during a match. A reviewed piece gets a close frame; otherwise the bar's room frame. */
  private aimActiveCamera(world: World, engine: IEngineContext): void {
    const role = this.reviewing ? chessReviewPiece() : null;
    if (role) {
      const pose = reviewPieceCamera(chessSetBoardY(getChessAmbiance()), role, chessReviewColor());
      this.placeChessCamera(world, engine, pose.eye, pose.target);
      return;
    }
    this.aimChessCamera(world, engine, this.reviewing ? chessReviewFrame() : 'game');
  }

  /** Hides every piece except the white one under review. The set returns when none is chosen. */
  private applyReviewPiece(world: World): void {
    if (!this.reviewing) return;
    const selected = chessReviewPiece();
    for (const [entity] of world.query<[ChessPieceComponent]>([ChessPieceComponent]).iter()) {
      const piece = world.getComponent(entity, ChessPieceComponent);
      const renderable = world.getComponent(entity, RenderableComponent);
      if (!piece || !renderable) continue;
      renderable.visible = reviewPieceVisible(selected, piece, chessReviewColor());
    }
  }

  /**
   * Places the game camera on a review pose and keeps the orbit controller there.
   * Match view follows {@link localColor}; authoring review stays white-side.
   * @param frame - Game camera or the wider room frame.
   */
  private aimChessCamera(world: World, engine: IEngineContext, frame: ChessReviewFrame): void {
    const side = this.reviewing ? 'white' : this.localColor;
    const pose = chessGameCameraPose(frame, side);
    this.placeChessCamera(world, engine, pose.eye, pose.target);
  }

  /** Side used for match fly-ins and game framing. Review stays white. */
  private matchCameraColor(): ChessColor {
    return this.reviewing ? 'white' : this.localColor;
  }

  /**
   * Puts the orbit camera on an eye and a look-at.
   * @param eye - Camera position in metres.
   * @param look - Point the camera looks at, in metres.
   */
  private placeChessCamera(
    world: World,
    engine: IEngineContext,
    eye: readonly [number, number, number],
    look: readonly [number, number, number]
  ): void {
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
    const eyeVec = vec3.fromValues(eye[0], eye[1], eye[2]);
    const target = vec3.fromValues(look[0], look[1], look[2]);
    const view = mat4.create();
    const worldMat = mat4.create();
    mat4.lookAt(view, eyeVec, target, [0, 1, 0]);
    mat4.invert(worldMat, view);
    vec3.copy(transform.position, eyeVec);
    mat4.getRotation(transform.rotation, worldMat);
    transform.updateLocalTransform();
    mat4.copy(transform.worldTransform, transform.localTransform);
    mat4.copy(camera.viewMatrix, view);
    const orbit = this.cameraControllers?.getActiveController();
    if (orbit instanceof OrbitalCameraController) {
      orbit.setTarget(target);
      orbit.setPosition(eyeVec);
    }
  }

  /**
   * Starts the room's fly-in.
   * @param fromReview - True when the review bar asks to replay it. A match start stays put in the review.
   */
  private beginCameraArrival(fromReview = false): void {
    if (this.reviewing && (!fromReview || chessReviewPiece())) return;
    const world = this.world;
    const engine = this.chessEngine;
    if (!world || !engine) return;
    this.cameraArrival = { elapsed: 0 };
    this.camJuice = null;
    const pose = chessCameraArrivalPose(getChessAmbiance(), 0, this.matchCameraColor());
    this.placeChessCamera(world, engine, pose.eye, pose.look);
  }

  private tickCameraArrival(dt: number, engine: EngineWithInput): void {
    const arrival = this.cameraArrival;
    const world = this.world;
    if (!arrival || !world) return;
    const input = engine.inputManager;
    const skipped =
      input?.isActionPressed('cameraRotate') ||
      input?.isActionPressed('cameraPan') ||
      (input?.getAxis('cameraZoom') ?? 0) !== 0 ||
      input?.isActionJustPressed('select');
    if (skipped) {
      this.cameraArrival = null;
      this.aimChessCamera(world, engine, 'game');
      return;
    }
    const move = chessCameraArrival(getChessAmbiance());
    arrival.elapsed += dt;
    const unit = Math.min(1, arrival.elapsed / move.duration);
    const pose = chessCameraArrivalPose(getChessAmbiance(), unit, this.matchCameraColor());
    this.placeChessCamera(world, engine, pose.eye, pose.look);
    if (unit >= 1) {
      this.cameraArrival = null;
      if (this.reviewing) setChessReviewFrame('game');
    }
  }

  private spawnPiece(
    world: World,
    scene: SceneNode,
    square: ChessSquareName,
    role: ChessPieceRole,
    color: ChessColor
  ): Entity | null {
    const hd = this.hdPieces?.get(hdPieceKey(color, role));
    const mesh = hd?.mesh ?? this.pieceMeshes.get(role);
    const mat = hd?.material ?? (color === 'white' ? this.marbleMat : this.steelMat);
    if (!mesh || !mat) return null;
    const node = new SceneNode(`Chess-${color}-${role}-${square}`, world, mesh, mat);
    const pos = squareToWorld(square, this.playingY(CHESS_BOARD_SURFACE_Y));
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
        shapes: hd ? [hdPieceCollider(mesh)] : stauntonPieceColliderShapes(role),
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
    this.ghostMats = [0, 1, 2, 3, 4].map((index) =>
      createChessGhostMaterial(resourceManager, `ChessGhost-${index}`, coachGhostColor(index))
    );
    this.cutoutMats = [0, 1, 2, 3, 4].map((index) =>
      createChessCutoutMaterial(resourceManager, `ChessCutout-${index}`, coachGhostColor(index))
    );
    this.errorCutoutMat = createChessCutoutMaterial(resourceManager, 'ChessCutout-error', coachErrorColor());
    const mesh = PrimitiveFactory.createPlane(CHESS_SQUARE_SIZE * 1.02);
    resourceManager.uploadMesh(mesh);
    const legalGlow = chessMoveGlowRecipe('ChessLegalSquare');
    const mat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      legalGlow.name,
      legalGlow.tint,
      legalGlow.emissive
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
    const hoverLegal = chessMoveGlowRecipe('ChessDropHoverLegal');
    this.hoverLegalMat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      hoverLegal.name,
      hoverLegal.tint,
      hoverLegal.emissive
    );
    const hoverHome = chessMoveGlowRecipe('ChessDropHoverHome');
    this.hoverHomeMat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      hoverHome.name,
      hoverHome.tint,
      hoverHome.emissive
    );
    const hoverIllegal = chessMoveGlowRecipe('ChessDropHoverIllegal');
    this.hoverIllegalMat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      hoverIllegal.name,
      hoverIllegal.tint,
      hoverIllegal.emissive
    );
    this.hoverPieceMat = createChessMoveGlowMaterial(
      resourceManager,
      pbrGraph,
      neon,
      CHESS_PIECE_HOVER_GLOW.name,
      CHESS_PIECE_HOVER_GLOW.tint,
      CHESS_PIECE_HOVER_GLOW.emissive
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
      const splineGlow = chessMoveGlowRecipe('ChessBookSpline');
      const mat = createChessMoveGlowMaterial(
        resourceManager,
        pbrGraph,
        neon,
        splineGlow.name,
        splineGlow.tint,
        splineGlow.emissive
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
      const headGlow = chessMoveGlowRecipe('ChessBookSplineHead');
      const headMat = createChessMoveGlowMaterial(
        resourceManager,
        pbrGraph,
        neon,
        headGlow.name,
        headGlow.tint,
        headGlow.emissive
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
      vec3.set(t.position, pose.x, pose.y + this.boardLift, pose.z);
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
      const p = squareToWorld(square, this.playingY(LEGAL_OVERLAY_Y));
      vec3.copy(t.position, p);
      this.bakeOverlayTransform(t);
      renderable.visible = true;
    }
  }

  private setDropHover(
    world: World,
    square: ChessSquareName | null,
    kind: 'drop' | 'piece' = 'drop'
  ): void {
    const node = this.hoverNode;
    if (!node) return;
    const renderable = world.getComponent(node.entityId, RenderableComponent);
    const t = world.getComponent(node.entityId, TransformComponent);
    if (!renderable || !t) return;
    if (!square) {
      renderable.visible = false;
      return;
    }
    if (kind === 'piece') {
      if (this.hoverPieceMat) renderable.material = this.hoverPieceMat;
    } else if (square === this.grabFrom) {
      if (this.hoverHomeMat) renderable.material = this.hoverHomeMat;
    } else if (this.legalDropSquares.has(square)) {
      if (this.hoverLegalMat) renderable.material = this.hoverLegalMat;
    } else if (this.hoverIllegalMat) {
      renderable.material = this.hoverIllegalMat;
    }
    const p = squareToWorld(square, this.playingY(DROP_HOVER_Y));
    vec3.copy(t.position, p);
    this.bakeOverlayTransform(t);
    renderable.visible = true;
  }

  /** Ivory square under the piece the ray would grab, before the click. */
  private updatePieceHover(
    world: World,
    engine: EngineWithInput,
    input: InputManager,
    overGame: boolean
  ): void {
    if (!overGame) {
      this.setDropHover(world, null);
      return;
    }
    const rect = this.gameCanvasRect();
    if (!rect) {
      this.setDropHover(world, null);
      return;
    }
    const vp = this.pickViewProjection(world, engine, rect);
    if (!vp) {
      this.setDropHover(world, null);
      return;
    }
    const ndc = clientPointToNdc(input.pointer.x, input.pointer.y, rect);
    if (!ndc) {
      this.setDropHover(world, null);
      return;
    }
    const ray = pickRayFromViewProjection(vp, ndc.ndcX, ndc.ndcY);
    if (!ray) {
      this.setDropHover(world, null);
      return;
    }
    const hit = raycast(world, ray.origin, ray.direction, 8, { collisionMask: CHESS_GROUP_PIECE });
    const square = hit ? this.squareByEntity.get(hit.entity) ?? null : null;
    const piece = square ? this.match.pieceAt(square) : null;
    const hovered = pieceHoverSquare({
      square,
      pieceColor: piece?.color ?? null,
      sideToMove: this.match.sideToMove(),
      localColor: this.localColor,
      playMode: this.playMode,
      gameOver: this.gameOver(),
      cpuBusy: this.cpuBusy,
      motionBusy: this.motionBusy,
    });
    this.setDropHover(world, hovered, 'piece');
  }

  private gameOver(): boolean {
    if (this.playMode === 'learn') return Boolean(this.trainer?.isComplete());
    return (
      this.match.isEnd() ||
      this.clockFlag !== null ||
      this.resignLoser !== null ||
      this.agreedDraw
    );
  }

  private clearManualEnd(): void {
    this.resignLoser = null;
    this.agreedDraw = false;
    this.drawOffer = 'none';
  }

  private applyResign(loser: ChessColor, fromWire = false): void {
    if (this.playMode === 'learn' || this.gameOver()) return;
    this.resignLoser = loser;
    this.drawOffer = 'none';
    if (!fromWire) this.broadcastWire({ v: 1, t: 'resign', loser });
    this.emitHud();
  }

  private offerDraw(): void {
    if (this.playMode === 'learn' || this.gameOver()) return;
    if (this.playMode === 'cpu' || this.playMode === 'training') {
      const accept = cpuAcceptsDrawOffer(this.match.fen(), this.cpuDepth);
      if (accept) {
        this.agreedDraw = true;
        this.drawOffer = 'none';
      } else {
        this.drawOffer = 'refused';
      }
      this.emitHud();
      return;
    }
    if (this.playMode === 'hotseat') {
      this.drawOffer = 'incoming';
      this.emitHud();
      return;
    }
    if (this.playMode === 'p2p') {
      this.broadcastWire({ v: 1, t: 'draw-offer' });
      this.drawOffer = 'none';
      this.emitHud();
    }
  }

  private acceptDraw(fromLocal: boolean): void {
    if (this.playMode === 'learn' || this.gameOver()) return;
    this.agreedDraw = true;
    this.drawOffer = 'none';
    if (fromLocal && this.playMode === 'p2p') this.broadcastWire({ v: 1, t: 'draw-accept' });
    this.emitHud();
  }

  private refuseDraw(fromLocal: boolean): void {
    if (this.playMode === 'learn' || this.gameOver()) return;
    this.drawOffer = 'none';
    if (fromLocal && this.playMode === 'p2p') this.broadcastWire({ v: 1, t: 'draw-refuse' });
    this.emitHud();
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
        : this.playMode === 'training'
          ? this.trainingHeld
            ? 'Training is paused.'
            : `You are ${this.localColor}. The computer replies until you stop.`
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
    } else if (this.resignLoser) {
      title = 'Resignation';
      description = `${this.resignLoser === 'white' ? 'White' : 'Black'} resigned.`;
    } else if (this.agreedDraw) {
      title = 'Draw';
      description = 'Draw agreed.';
    } else if (this.match.isInsufficientMaterial()) {
      title = 'Draw';
      description = 'Insufficient material.';
    } else if (this.match.isCheck()) {
      title = `${sideLabel} in check`;
    }
    const outcome = this.clockFlag
      ? null
      : this.resignLoser
        ? 'resign'
        : this.agreedDraw
          ? 'agreed'
          : this.match.isCheckmate()
            ? 'mate'
            : this.match.isStalemate()
              ? 'stalemate'
              : this.match.isInsufficientMaterial()
                ? 'insufficient'
                : null;
    uiBus.emit(CHESS_HUD_STATE_EVENT, {
      kind: 'play',
      mode,
      label: 'Status',
      title,
      description,
      localColor: this.localColor,
      sideToMove: side,
      cpuThinking: (mode === 'cpu' || mode === 'training') && this.cpuBusy,
      p2pStatus: mode === 'p2p' ? this.p2pStatus : null,
      onlineReady: this.onlineReady,
      onlineRefused: this.onlineRefused,
      clocks: { whiteSeconds: this.clockWhite, blackSeconds: this.clockBlack },
      flag: this.clockFlag,
      outcome,
      resignLoser: this.resignLoser,
      drawOffer: this.drawOffer,
      session: this.currentSession(),
    });
    this.emitCoachContext();
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
    this.emitCoachContext();
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
    this.cameraArrival = null;
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
    this.applyReviewPiece(world);
  }

  private readCabinet(): SaveCabinet {
    try {
      return parseSaveCabinet(globalThis.localStorage?.getItem(SAVED_GAMES_KEY) ?? null);
    } catch {
      return emptySaveCabinet();
    }
  }

  private storeCabinet(cabinet: SaveCabinet): void {
    try {
      globalThis.localStorage?.setItem(SAVED_GAMES_KEY, JSON.stringify(cabinet));
    } catch {
      /* private mode */
    }
    uiBus.emit(CHESS_SAVES_EVENT, cabinet);
  }

  private liveDraft(kind: 'interrupt' | 'voluntary'): Record<string, unknown> {
    return {
      id: kind === 'interrupt' ? 'interrupt' : `v-${Date.now().toString(36)}`,
      kind,
      savedAt: Date.now(),
      shellMode: this.tableKind,
      fen: this.match.fen(),
      whiteSeconds: this.clockWhite,
      blackSeconds: this.clockBlack,
      localColor: this.localColor,
      eco: this.learnEco,
      plyIndex: this.trainer?.plyIndex(),
      flag: this.clockFlag,
    };
  }

  /**
   * Stores the live table as the interruption.
   * The invited window does not write, so the two windows do not overwrite each other.
   * @param force - True on close or when a full screen covers the table.
   */
  private rememberInterrupt(force: boolean): void {
    if (this.peerWindow) return;
    if (!force && this.modePickerOpen) return;
    this.storeCabinet(noteInterrupt(this.readCabinet(), this.liveDraft('interrupt'), this.gameOver()));
  }

  private saveVoluntary(): void {
    const game = acceptSavedGame(this.liveDraft('voluntary'));
    if (!game) return;
    this.storeCabinet(putVoluntary(this.readCabinet(), game));
  }

  private tryResumeFromLocation(query: ChessDemoQuery): boolean {
    if (typeof window === 'undefined') return false;
    const id = new URLSearchParams(window.location.search).get('chessResume');
    if (!id) return false;
    const cabinet = this.readCabinet();
    const game =
      cabinet.interrupt?.id === id
        ? cabinet.interrupt
        : (cabinet.voluntary.find((item) => item.id === id) ?? null);
    if (!game) return false;
    this.restoreGame(game, query.localColor);
    return true;
  }

  /**
   * Loads a fiche onto the table. An online game waits in the lobby.
   * A lesson is replayed so the book cursor matches the position.
   * @param game - Fiche already accepted.
   * @param colorOverride - Guest color from the peer window.
   * @param cpuDepth - Search depth when the fiche is against the computer.
   */
  private restoreGame(game: SavedGame, colorOverride?: ChessColor, cpuDepth?: number): void {
    const world = this.world;
    if (!world) return;
    const mode: ChessPlayMode =
      game.shellMode === 'local' || game.shellMode === 'online' ? 'p2p' : game.shellMode;
    this.tableKind = game.shellMode;
    this.playMode = mode;
    this.localColor = colorOverride ?? game.localColor;
    this.learnQuiz = game.shellMode === 'learn';
    if (game.eco) this.learnEco = game.eco;
    this.trainer = mode === 'learn' ? new OpeningTrainer(this.learnEco) : null;
    if (this.trainer) this.learnEco = this.trainer.opening().eco;
    if (mode === 'cpu' || mode === 'training') {
      this.cpuDepth = cpuSearchDepth(cpuDepth ?? 2);
      this.cpu = new HeuristicChessEngine({ depth: this.cpuDepth, thinkMs: 280 });
    }
    this.clearTraining();
    this.clearManualEnd();
    this.holdForLobby = game.shellMode === 'online';
    this.pendingRestore = game.shellMode === 'local' || game.shellMode === 'online';
    this.pendingP2pBytes = null;
    this.clearBoardVisuals(world);
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.learnMiss = false;
    this.learnLastSan = null;
    this.flagSfxPlayed = false;
    if (mode === 'learn' && this.trainer) {
      this.match.reset();
      const target = game.plyIndex ?? 0;
      for (let i = 0; i < target; i += 1) {
        const ply = this.trainer.expected();
        if (!ply) break;
        const result = this.match.tryMove(ply.from, ply.to);
        if (!result.ok) break;
        this.trainer.accept(ply.from, ply.to);
      }
    } else if (!this.match.loadFen(game.fen)) {
      this.match.reset();
    }
    this.applyClockState(
      clocksFromWire('restore', { whiteSeconds: game.whiteSeconds, blackSeconds: game.blackSeconds })
    );
    this.spawnMatchPieces(world);
    this.syncFileRankLabels(world);
    this.boardReady = true;
    if (game.shellMode === 'online') {
      this.modePickerOpen = true;
      this.p2p?.closeAll();
      this.p2p = null;
      this.p2pStatus = 'waiting';
      this.emitHud();
      replaceChessDemoQueryInLocation(this.currentSession());
      return;
    }
    this.bindP2p();
    this.flushPendingP2p();
    this.emitHud();
    replaceChessDemoQueryInLocation(this.currentSession());
  }

  private currentSession(): ChessDemoQuery {
    return {
      mode: this.playMode,
      localColor: this.localColor,
      eco: this.learnEco,
      quiz: this.learnQuiz,
      ...(this.roomId ? { room: this.roomId } : {}),
      ...(this.onlineSeat ? { seat: this.onlineSeat } : {}),
    };
  }

  private applySession(query: ChessDemoQuery, table?: SavedShellMode): void {
    const world = this.world;
    if (!world) return;
    this.roomId = query.room ?? '';
    this.onlineSeat = query.seat ?? null;
    this.onlineReady = false;
    this.onlineRefused = false;
    if (table) this.tableKind = table;
    else if (query.mode === 'cpu' || query.mode === 'hotseat' || query.mode === 'learn') {
      this.tableKind = query.mode;
    }
    if (this.holdForLobby && query.mode === 'p2p') {
      this.holdForLobby = false;
      this.pendingRestore = true;
      this.playMode = 'p2p';
      this.localColor = query.localColor;
      this.boardReady = true;
      this.bindP2p();
      this.emitHud();
      replaceChessDemoQueryInLocation(this.currentSession());
      return;
    }
    this.holdForLobby = false;
    this.pendingRestore = false;
    if (!this.peerWindow) this.storeCabinet(dropInterrupt(this.readCabinet()));
    this.playMode = query.mode;
    this.localColor = query.localColor;
    this.learnQuiz = query.quiz;
    if (query.mode === 'cpu' || query.mode === 'training') {
      this.cpuDepth = query.cpuDepth ?? 2;
      this.cpu = new HeuristicChessEngine({ depth: this.cpuDepth, thinkMs: 280 });
    }
    if (query.mode === 'training') this.trainingClock = false;
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
    this.clearManualEnd();
    this.learnMiss = false;
    this.learnLastSan = null;
    this.clearTraining();
    this.flagSfxPlayed = false;
    this.spawnMatchPieces(world);
    this.syncFileRankLabels(world);
    this.boardReady = true;
    this.beginCameraArrival();
    this.bindP2p();
    this.pendingP2pBytes = null;
    this.emitHud();
    if (this.playMode === 'p2p') {
      this.broadcastWire({ v: 1, t: 'reset', fen: this.match.fen() });
    }
    replaceChessDemoQueryInLocation(this.currentSession());
  }

  private resetClocks(): void {
    this.applyClockState(clocksFromWire('reset'));
  }

  private applyClockState(clocks: { whiteSeconds: number; blackSeconds: number; flag: ChessColor | null }): void {
    this.clockWhite = clocks.whiteSeconds;
    this.clockBlack = clocks.blackSeconds;
    this.hudClockWhite = Math.ceil(clocks.whiteSeconds);
    this.hudClockBlack = Math.ceil(clocks.blackSeconds);
    this.clockFlag = clocks.flag;
  }

  private resetMatch(world: World, broadcast: boolean): void {
    this.clearBoardVisuals(world);
    this.match.reset();
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.resetClocks();
    this.clearManualEnd();
    this.learnMiss = false;
    this.learnLastSan = null;
    this.clearTraining();
    if (this.playMode === 'learn' && this.trainer) {
      if (this.trainer.isComplete()) this.trainer.nextOpening();
      else this.trainer.restart();
    }
    this.spawnMatchPieces(world);
    this.syncFileRankLabels(world);
    this.beginCameraArrival();
    this.emitHud();
    if (broadcast && this.playMode === 'p2p') {
      this.broadcastWire({ v: 1, t: 'reset', fen: this.match.fen() });
    }
  }

  private clearTraining(): void {
    this.trainingLog = [];
    this.coachHistory = [];
    this.trainingHeld = false;
    this.mistakeSquare = null;
    if (this.world) this.showCoachGhosts(this.world, []);
  }

  private emitCoachContext(): void {
    const last = lastUserPly(this.trainingLog, this.localColor);
    uiBus.emit(CHESS_COACH_CONTEXT_EVENT, {
      fen: this.match.fen(),
      history: this.coachHistory,
      sideToMove: this.match.sideToMove(),
      training:
        this.playMode === 'training'
          ? {
              held: this.trainingHeld,
              localColor: this.localColor,
              lastUserSan: last?.san ?? null,
              lastUserFen: last?.fenBefore ?? null,
              clock: this.trainingClock,
            }
          : null,
    });
  }

  private noteTrainingPly(fenBefore: string, san: string, color: ChessColor, to: ChessSquareName): void {
    this.coachHistory = [...this.coachHistory, san].slice(-24);
    if (this.playMode !== 'training') {
      this.emitCoachContext();
      return;
    }
    this.trainingLog = recordPly(this.trainingLog, { fenBefore, san, color });
    if (color === this.localColor && !this.trainingHeld) {
      const review = reviewPlayedMove(fenBefore, san, this.coachHorizon, this.ghostSteps);
      if (review?.kind === 'mistake') {
        this.mistakeSquare = to;
        this.trainingHeld = true;
        this.cpuGen += 1;
        this.cpuBusy = false;
        if (this.world) this.syncCoachCutouts(this.world);
        uiBus.emit(CHESS_COACH_OBJECT_EVENT, {});
        this.emitHud();
        return;
      }
      this.mistakeSquare = null;
    }
    if (this.world) this.syncCoachCutouts(this.world);
    this.emitCoachContext();
  }

  private holdTraining(): void {
    if (this.playMode !== 'training') return;
    this.trainingHeld = true;
    this.cpuGen += 1;
    this.cpuBusy = false;
    if (this.world) this.cancelActiveGrab(this.world);
    this.emitHud();
  }

  private resumeTraining(): void {
    if (this.playMode !== 'training') return;
    this.trainingHeld = false;
    this.mistakeSquare = null;
    if (this.world) this.syncCoachCutouts(this.world);
    this.emitHud();
    this.pumpCpu();
  }

  private undoTrainingMove(): void {
    if (this.playMode !== 'training' || !this.world) return;
    const undone = undoMyMove(this.trainingLog, this.localColor);
    if (!undone) return;
    const log = undone.log;
    this.trainingHeld = true;
    this.cpuGen += 1;
    this.rebuildFromFen(this.world, undone.fen);
    this.trainingLog = log;
    this.coachHistory = log.map((ply) => ply.san);
    this.trainingHeld = true;
    this.emitHud();
  }

  private showCoachGhosts(world: World, steps: readonly CoachGhostStep[]): void {
    const scene = this.sceneRef;
    const keep = new Set<string>();
    this.ghostSteps = steps.slice(0, 5);
    this.pinnedCutouts = new Set(coachPinnedSquares(this.ghostSteps, this.mistakeSquare, (square) => this.pieceOn(square)));
    if (scene && this.ghostMats.length > 0) {
      this.ghostSteps.forEach((step, index) => {
        const key = `${index}:${step.color}:${step.role}`;
        keep.add(key);
        let node = this.ghostNodes.get(key);
        if (!node) {
          const hd = this.hdPieces?.get(hdPieceKey(step.color, step.role));
          const mesh = hd?.mesh ?? this.pieceMeshes.get(step.role);
          const mat = this.ghostMats[index];
          if (!mesh || !mat) return;
          node = new SceneNode(`CoachGhost-${key}`, world, mesh, mat);
          const created = world.getComponent(node.entityId, RenderableComponent);
          if (created) created.castShadow = false;
          scene.add(node);
          this.ghostNodes.set(key, node);
        }
        const transform = world.getComponent(node.entityId, TransformComponent);
        if (transform) {
          const pos = squareToWorld(step.to, this.playingY(CHESS_BOARD_SURFACE_Y + 0.012));
          vec3.copy(transform.position, pos);
          quat.identity(transform.rotation);
          vec3.set(transform.scale, 1, 1, 1);
          transform.updateLocalTransform();
          mat4.copy(transform.worldTransform, transform.localTransform);
        }
        const renderable = world.getComponent(node.entityId, RenderableComponent);
        if (renderable) renderable.visible = true;
      });
    }
    for (const [key, node] of this.ghostNodes) {
      if (keep.has(key)) continue;
      const renderable = world.getComponent(node.entityId, RenderableComponent);
      if (renderable) renderable.visible = false;
    }
    this.syncCoachCutouts(world);
  }

  private syncCoachCutouts(world: World): void {
    const scene = this.sceneRef;
    const keep = new Set<string>();
    if (scene) {
      for (const mark of coachStableMarks(this.ghostSteps, this.mistakeSquare, this.pinnedCutouts, (square) =>
        this.pieceOn(square)
      )) {
        const mat = this.cutoutMats[mark.index];
        if (!mat) continue;
        this.placeCoachCutout(world, scene, `src-${mark.index}`, mark.square, mat, keep);
      }
      if (this.mistakeSquare && this.errorCutoutMat) {
        this.placeCoachCutout(world, scene, 'err', this.mistakeSquare, this.errorCutoutMat, keep);
      }
    }
    for (const [key, node] of this.cutoutNodes) {
      if (keep.has(key)) continue;
      const renderable = world.getComponent(node.entityId, RenderableComponent);
      if (renderable) renderable.visible = false;
    }
  }

  /**
   * Eye of the camera that is looking. The orbit writes it on the camera entity.
   * Falls back to the game pose before that entity exists.
   */
  private coachViewEye(world: World): readonly [number, number, number] {
    const fallback = chessGameCameraPose('game', this.matchCameraColor()).eye;
    const id = this.chessEngine?.getGameCameraEntityId() ?? null;
    if (id === null) return fallback;
    const transform = world.getComponent(id, TransformComponent);
    if (!transform) return fallback;
    const eye = transform.position;
    if (eye[0] === 0 && eye[1] === 0 && eye[2] === 0) return fallback;
    return [eye[0], eye[1], eye[2]];
  }

  private placeCoachCutout(
    world: World,
    scene: SceneNode,
    key: string,
    square: string,
    mat: Material,
    keep: Set<string>
  ): void {
    const entity = this.entityBySquare.get(square as ChessSquareName);
    const host = entity !== undefined ? this.nodeByEntity.get(entity) : undefined;
    if (!host) return;
    const hostRenderable = world.getComponent(host.entityId, RenderableComponent);
    const hostTransform = world.getComponent(host.entityId, TransformComponent);
    if (!hostRenderable?.mesh || !hostTransform || !hostRenderable.visible) return;
    const mesh = hostRenderable.mesh;
    keep.add(key);
    let node = this.cutoutNodes.get(key);
    if (!node) {
      node = new SceneNode(`CoachCutout-${key}`, world, mesh, mat);
      const created = world.getComponent(node.entityId, RenderableComponent);
      if (created) created.castShadow = false;
      scene.add(node);
      this.cutoutNodes.set(key, node);
    }
    const renderable = world.getComponent(node.entityId, RenderableComponent);
    if (renderable) {
      renderable.mesh = mesh;
      renderable.material = mat;
      renderable.visible = true;
      renderable.castShadow = false;
    }
    const transform = world.getComponent(node.entityId, TransformComponent);
    if (!transform) return;
    const biased = coachMaskPosition(
      [hostTransform.position[0], hostTransform.position[1], hostTransform.position[2]],
      this.coachViewEye(world)
    );
    vec3.set(transform.position, biased[0], biased[1], biased[2]);
    quat.copy(transform.rotation, hostTransform.rotation);
    vec3.set(transform.scale, COACH_MASK_SCALE, COACH_MASK_SCALE, COACH_MASK_SCALE);
    transform.updateLocalTransform();
    mat4.copy(transform.worldTransform, transform.localTransform);
  }

  private pieceOn(square: string): { role: string; color: string } | null {
    const name = square as ChessSquareName;
    if (!this.entityBySquare.has(name)) return null;
    const piece = this.match.pieceAt(name);
    if (!piece) return null;
    return { role: piece.role, color: piece.color };
  }

  private rebuildFromFen(world: World, fen: string): void {
    this.clearTraining();
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
    const grabY = this.playingY(CHESS_BOARD_SURFACE_Y + CHESS_GRAB_LIFT_M + 0.04);
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
      this.grab.grabbed?.grabHeightY ?? this.playingY(CHESS_BOARD_SURFACE_Y + CHESS_GRAB_LIFT_M)
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
    const fenBefore = this.match.fen();
    const mover = this.match.sideToMove();
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
      this.noteTrainingPly(fenBefore, result.san, mover, result.to);
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
      this.queueFlight(
        capturedEntity,
        fromPos,
        [slot.x, this.playingY(slot.y), slot.z],
        0.16,
        CEMETERY_TRAVEL_S
      );
    } else if (capturedSquare) {
      this.removePieceAt(world, capturedSquare);
    }
    this.entityBySquare.delete(from);
    this.entityBySquare.set(to, entity);
    this.squareByEntity.set(entity, to);
    if (animateMover) {
      const fromPos = this.entityWorldPos(world, entity);
      const dest = squareToWorld(to, this.playingY(CHESS_BOARD_SURFACE_Y));
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
          const dest = squareToWorld(castle.rookTo, this.playingY(CHESS_BOARD_SURFACE_Y));
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
      this.broadcastWire({
        v: 1,
        t: 'move',
        from,
        to,
        fen: this.match.fen(),
        whiteSeconds: this.clockWhite,
        blackSeconds: this.clockBlack,
      });
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
    this.updateAmbienceTension();
    this.startCameraJuice(from, to);
    this.emitHud();
    this.rememberInterrupt(false);
  }

  private snapEntityToSquare(world: World, entity: Entity, square: ChessSquareName): void {
    const t = world.getComponent(entity, TransformComponent);
    const body = world.getComponent(entity, RigidBodyComponent);
    const piece = world.getComponent(entity, ChessPieceComponent);
    if (!t) return;
    const p = squareToWorld(square, this.playingY(CHESS_BOARD_SURFACE_Y));
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
    const before = this.clockFlag;
    const next = stepChessClock(
      { whiteSeconds: this.clockWhite, blackSeconds: this.clockBlack, flag: this.clockFlag },
      this.match.sideToMove(),
      dt,
      {
        covered: this.modePickerOpen || this.playMode === 'learn' || this.trainingHeld || this.gameOver(),
        awaitingPeer: peerClockWaiting({
          peerGame: this.playMode === 'p2p',
          online: this.tableKind === 'online',
          seatsReady: this.onlineReady,
          linkConnected: this.p2pStatus === 'connected',
        }),
        clockOff: this.playMode === 'training' && !this.trainingClock,
      }
    );
    this.clockWhite = next.whiteSeconds;
    this.clockBlack = next.blackSeconds;
    this.clockFlag = next.flag;
    const w = Math.ceil(this.clockWhite);
    const b = Math.ceil(this.clockBlack);
    if (w !== this.hudClockWhite || b !== this.hudClockBlack || this.clockFlag) {
      this.hudClockWhite = w;
      this.hudClockBlack = b;
      this.emitHud();
      this.rememberInterrupt(false);
    }
    if (this.clockFlag && !before && !this.flagSfxPlayed) {
      this.flagSfxPlayed = true;
      this.playSfx([this.clockFlag === this.localColor ? 'lose' : 'win']);
      this.ambienceBeds.resetTension();
    }
  }

  private pumpCpu(): void {
    if (
      !shouldCpuReply({
        mode: this.playMode,
        held: this.trainingHeld,
        busy: this.cpuBusy,
        motion: this.motionBusy,
        gameOver: this.gameOver(),
        side: this.match.sideToMove(),
        local: this.localColor,
      })
    ) {
      return;
    }
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
    const fenBefore = this.match.fen();
    const mover = this.match.sideToMove();
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
    this.noteTrainingPly(fenBefore, result.san, mover, result.to);
    return true;
  }

  private bindP2p(): void {
    this.clearGuestWait();
    this.p2p?.closeAll();
    this.p2p = null;
    this.p2pStatus = 'waiting';
    if (this.playMode !== 'p2p') return;
    const localPeerId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `chess-${Math.random().toString(36).slice(2, 10)}`;
    const online = this.tableKind === 'online';
    if (online && !this.roomId) return;
    if (!online && typeof BroadcastChannel === 'undefined') return;
    const transport = online
      ? new WebSocketRelayTransport({
          localPeerId,
          serverUrl: chessRelayUrl(import.meta.env.VITE_CHESS_RELAY_URL),
          roomId: this.roomId,
        })
      : new BroadcastChannelTransport({
          localPeerId,
          channelName: CHESS_P2P_CHANNEL,
        });
    transport.setStateHandler((_peer, state) => {
      this.p2pStatus = normalizeChessHudP2pStatus(state);
      if (state === 'disconnected') this.onlineReady = false;
      if (state === 'connected' && this.boardReady) {
        if (online) this.sendOnlineHello();
        if (this.pendingRestore) {
          this.broadcastWire({
            v: 1,
            t: 'restore',
            fen: this.match.fen(),
            whiteSeconds: this.clockWhite,
            blackSeconds: this.clockBlack,
          });
        } else if (!online) {
          this.broadcastWire({
            v: 1,
            t: 'sync',
            fen: this.match.fen(),
            whiteSeconds: this.clockWhite,
            blackSeconds: this.clockBlack,
          });
        }
      }
      this.emitHud();
    });
    transport.setMessageHandler((_peer, bytes) => this.onP2pBytes(bytes));
    this.p2p = transport;
    if (online && this.onlineSeat === 'guest') this.armGuestWait();
  }

  private sendOnlineHello(): void {
    if (this.onlineSeat !== 'host' && this.onlineSeat !== 'guest') return;
    this.broadcastWire({
      v: 1,
      t: 'hello',
      host: this.onlineSeat === 'host',
      color: this.localColor,
      fen: this.match.fen(),
      whiteSeconds: this.clockWhite,
      blackSeconds: this.clockBlack,
    });
  }

  private armGuestWait(): void {
    this.clearGuestWait();
    const started = Date.now();
    this.guestTimer = setTimeout(() => {
      this.guestTimer = null;
      if (this.onlineReady || this.onlineRefused) return;
      if (!guestWaitExpired(started, Date.now())) return;
      this.refuseOnlineTable();
    }, ONLINE_GUEST_WAIT_MS);
  }

  private clearGuestWait(): void {
    if (this.guestTimer === null) return;
    clearTimeout(this.guestTimer);
    this.guestTimer = null;
  }

  private refuseOnlineTable(): void {
    this.clearGuestWait();
    this.onlineReady = false;
    this.onlineRefused = true;
    this.p2p?.closeAll();
    this.p2p = null;
    this.p2pStatus = 'disconnected';
    this.emitHud();
  }

  private closeOnlineTable(): void {
    this.clearGuestWait();
    this.onlineReady = false;
    this.onlineRefused = false;
    this.roomId = '';
    this.onlineSeat = null;
    this.p2p?.closeAll();
    this.p2p = null;
    this.p2pStatus = 'waiting';
    this.emitHud();
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
    if (msg.t === 'restore') {
      this.applyClockState(
        clocksFromWire('restore', { whiteSeconds: msg.whiteSeconds, blackSeconds: msg.blackSeconds })
      );
      this.flagSfxPlayed = false;
      this.rebuildFromFen(world, msg.fen);
      return;
    }
    if (msg.t === 'hello') {
      this.onOnlineHello(world, msg);
      return;
    }
    if (msg.t === 'sync') {
      const decision = decideChessFenSync(this.match.fen(), msg.fen);
      if (decision === 'ignore') return;
      if (decision === 'reply') {
        this.broadcastWire({
          v: 1,
          t: 'sync',
          fen: this.match.fen(),
          whiteSeconds: this.clockWhite,
          blackSeconds: this.clockBlack,
        });
        return;
      }
      this.applyWireClocks(msg);
      if (this.motionBusy) this.pendingFen = msg.fen;
      else this.rebuildFromFen(world, msg.fen);
      return;
    }
    if (msg.t === 'resign') {
      this.applyResign(msg.loser, true);
      return;
    }
    if (msg.t === 'draw-offer') {
      this.drawOffer = 'incoming';
      this.emitHud();
      return;
    }
    if (msg.t === 'draw-accept') {
      this.acceptDraw(false);
      return;
    }
    if (msg.t === 'draw-refuse') {
      this.refuseDraw(false);
      return;
    }
    if (msg.t !== 'move') return;
    this.playProgrammaticMove(world, msg.from, msg.to);
    this.applyWireClocks(msg);
    if (this.match.fen() !== msg.fen) {
      if (this.motionBusy) this.pendingFen = msg.fen;
      else this.rebuildFromFen(world, msg.fen);
    }
    this.emitHud();
  }

  private onOnlineHello(
    world: World,
    msg: { host: boolean; color: ChessColor; fen: string; whiteSeconds: number; blackSeconds: number }
  ): void {
    if (this.tableKind !== 'online' || !this.onlineSeat) return;
    const decision = decideOnlineHello(this.onlineSeat, msg.host, msg.color);
    if (decision.kind === 'ignore') return;
    if (decision.kind === 'refuse') {
      this.refuseOnlineTable();
      return;
    }
    if (decision.kind === 'adopt') {
      this.localColor = decision.localColor;
      this.applyClockState(
        clocksFromWire('restore', { whiteSeconds: msg.whiteSeconds, blackSeconds: msg.blackSeconds })
      );
      if (this.match.fen() !== msg.fen) this.rebuildFromFen(world, msg.fen);
      this.syncFileRankLabels(world);
      if (this.chessEngine) this.aimChessCamera(world, this.chessEngine, 'game');
    }
    this.clearGuestWait();
    this.onlineReady = true;
    this.onlineRefused = false;
    this.emitHud();
  }

  private applyWireClocks(msg: { whiteSeconds?: number; blackSeconds?: number }): void {
    if (typeof msg.whiteSeconds !== 'number' || typeof msg.blackSeconds !== 'number') return;
    this.applyClockState(
      clocksFromWire('restore', { whiteSeconds: msg.whiteSeconds, blackSeconds: msg.blackSeconds })
    );
  }

  private entityWorldPos(world: World, entity: Entity): [number, number, number] {
    const t = world.getComponent(entity, TransformComponent);
    if (!t) return [0, CHESS_BOARD_SURFACE_Y, 0];
    return [t.position[0]!, t.position[1]!, t.position[2]!];
  }

  /** Loops a pawn on e2–e4, or holds it, while the graphics bench samples. */
  private tickGraphicsBench(world: World, dt: number): void {
    const mode = getGraphicsBenchMotion();
    if (mode === 'idle') {
      if (!this.benchMoved) return;
      if (this.grab.grabbed) this.grab.end(world);
      this.flights = [];
      this.motionBusy = false;
      if (this.benchPawn !== null) this.snapEntityToSquare(world, this.benchPawn, 'e2');
      this.benchMoved = false;
      this.benchTowardE4 = true;
      this.benchDrag = 0;
      return;
    }
    this.benchMoved = true;
    if (this.benchPawn === null) this.benchPawn = this.entityBySquare.get('e2') ?? null;
    const entity = this.benchPawn;
    if (entity === null) return;
    if (mode === 'flight') {
      if (this.grab.grabbed) this.grab.end(world);
      if (this.flights.length === 0) {
        const to = this.benchTowardE4 ? 'e4' : 'e2';
        this.benchTowardE4 = !this.benchTowardE4;
        const dest = squareToWorld(to, this.playingY(CHESS_BOARD_SURFACE_Y));
        this.queueFlight(
          entity,
          this.entityWorldPos(world, entity),
          [dest[0]!, dest[1]!, dest[2]!],
          0,
          PIECE_TRAVEL_S
        );
      }
      this.noteBenchPose(world, entity);
      return;
    }
    this.flights = [];
    this.motionBusy = false;
    const y = this.playingY(CHESS_BOARD_SURFACE_Y) + CHESS_GRAB_LIFT_M;
    if (!this.grab.grabbed) {
      this.grab.begin(world, entity, this.entityWorldPos(world, entity), y);
    }
    this.benchDrag += dt;
    this.grab.updateWorldAnchor(world, Math.sin(this.benchDrag * 0.7) * 0.18, 0, dt);
    this.noteBenchPose(world, entity);
  }

  private noteBenchPose(world: World, entity: Entity): void {
    const transform = world.getComponent(entity, TransformComponent);
    if (!transform) return;
    noteGraphicsBenchPose(
      [transform.position[0]!, transform.position[1]!, transform.position[2]!],
      [transform.rotation[0]!, transform.rotation[1]!, transform.rotation[2]!, transform.rotation[3]!]
    );
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
      vec3.set(t.position, p[0], p[1] + this.boardLift, p[2]);
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
      vec3.set(ht.position, hx, hy + this.boardLift + 0.001, hz);
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
      await installChessTableClips(this.audio, getChessAmbiance());
      bindChessAmbienceBeds(this.ambienceBeds);
      this.ambienceBeds.start(this.audio);
      this.updateAmbienceTension();
    } catch {
      this.audioArmed = false;
    }
  }

  private async refreshAmbianceAudio(): Promise<void> {
    if (!this.audio || !this.audioArmed) return;
    try {
      await this.ambienceBeds.applyAmbiance(this.audio, getChessAmbiance());
      this.updateAmbienceTension();
    } catch {
      /* keep previous clips */
    }
  }

  private updateAmbienceTension(): void {
    if (this.match.isCheckmate() || this.clockFlag) {
      this.ambienceBeds.resetTension();
      return;
    }
    const local = chessScoreForLocal(coachMaterial(this.match), this.localColor);
    this.ambienceBeds.setTension(local);
  }

  private disposeChessRuntime(): void {
    this.cpuGen += 1;
    this.cpuBusy = false;
    this.boardReady = false;
    this.pendingP2pBytes = null;
    this.world = null;
    this.stopReview?.();
    this.stopReview = null;
    this.ambienceBeds.stop();
    bindChessAmbienceBeds(null);
    this.audio?.dispose();
    this.audio = null;
    this.audioArmed = false;
    this.p2p?.closeAll();
    this.p2p = null;
    this.p2pStatus = 'waiting';
    this.camJuice = null;
    this.cameraArrival = null;
    uiBus.off(CHESS_HUD_COMMAND_EVENT, this.onHudCommand);
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.onPageHide);
  }

  private playSfx(ids: readonly ChessTableSfxId[]): void {
    const audio = this.audio;
    if (!audio || !this.audioArmed) return;
    for (const id of ids) {
      try {
        if (!audio.getClip(id)) continue;
        audio.playOneShot(id, { volume: chessSfxGain(id) });
      } catch {
        /* clip missing */
      }
    }
  }
}
