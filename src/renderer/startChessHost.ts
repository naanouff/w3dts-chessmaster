import {
  EngineBuilder,
  GPUManager,
  setMsaaSampleCount,
  type Engine,
  type IModelLoaderService,
} from '@naanouff/w3dts-core';
import { Logger } from '@naanouff/w3dts-logger';
import { chessBus } from './bus';
import { ChessDemoProject } from './host/ChessDemoProject';
import { applyChessGraphics, attachChessGraphics, getChessGraphicsSettings } from './graphics/chessGraphicsSettings';

const emptyLoader: IModelLoaderService = {
  async load() {
    return null;
  },
};

/**
 * Boots the published engine on a hidden canvas and presents the chess table
 * on the visible Game surface.
 *
 * One engine per renderer: `GPUManager.initialize` publishes its singleton
 * before `requestDevice` resolves. React StrictMode also swaps the canvas
 * node before that boot finishes, so the surface must follow the latest node.
 */
let chessHostBoot: Promise<Engine> | null = null;
let latestGameCanvas: HTMLCanvasElement | null = null;
let boundGameCanvas: HTMLCanvasElement | null = null;
let gameSurfaceObserver: ResizeObserver | null = null;

export function startChessHost(gameCanvas: HTMLCanvasElement): Promise<Engine> {
  latestGameCanvas = gameCanvas;
  if (!chessHostBoot) {
    chessHostBoot = bootChessHost().catch((err: unknown) => {
      chessHostBoot = null;
      throw err;
    });
  }
  return chessHostBoot.then((engine) => {
    const canvas = latestGameCanvas;
    if (canvas) bindGameSurface(engine, canvas);
    return engine;
  });
}

function bindGameSurface(engine: Engine, canvas: HTMLCanvasElement): void {
  if (boundGameCanvas === canvas) return;
  gameSurfaceObserver?.disconnect();
  canvas.dataset.testid = 'game-view-canvas';
  engine.setGameViewSurface(canvas);
  engine.setInputTarget(canvas);
  const syncGameSurface = (): void => {
    applyChessGraphics(engine, canvas, getChessGraphicsSettings());
  };
  attachChessGraphics(engine, canvas);
  gameSurfaceObserver = new ResizeObserver(syncGameSurface);
  gameSurfaceObserver.observe(canvas);
  boundGameCanvas = canvas;
}

async function bootChessHost(): Promise<Engine> {
  (
    globalThis as { __W3DTS_SCRIPT_PLAY_STATE__?: 'playing' | 'paused' | 'stopped' }
  ).__W3DTS_SCRIPT_PLAY_STATE__ = 'playing';

  const logger = new Logger(chessBus);
  await GPUManager.initialize(logger);
  setMsaaSampleCount(1);

  const hidden = document.createElement('canvas');
  hidden.width = 4;
  hidden.height = 4;
  hidden.setAttribute('aria-hidden', 'true');
  hidden.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;pointer-events:none;';
  document.body.appendChild(hidden);

  const engine = await new EngineBuilder(hidden)
    .setUIBus(chessBus)
    .setLogger(logger)
    .withModelLoader(emptyLoader)
    .build();

  engine.director.register(new ChessDemoProject());
  await engine.start('ChessDemoProject');
  return engine;
}
