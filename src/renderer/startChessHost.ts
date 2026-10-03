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

const emptyLoader: IModelLoaderService = {
  async load() {
    return null;
  },
};

/**
 * Boots the published engine on a hidden canvas and presents the chess table
 * on the visible Game surface.
 */
export async function startChessHost(gameCanvas: HTMLCanvasElement): Promise<Engine> {
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

  gameCanvas.dataset.testid = 'game-view-canvas';

  const engine = await new EngineBuilder(hidden)
    .setUIBus(chessBus)
    .setLogger(logger)
    .withModelLoader(emptyLoader)
    .build();

  engine.director.register(new ChessDemoProject());
  await engine.start('ChessDemoProject');
  engine.setGameViewSurface(gameCanvas);

  const syncGameSurface = (): void => {
    const width = gameCanvas.clientWidth;
    const height = gameCanvas.clientHeight;
    if (width > 0 && height > 0) engine.setGameViewSurfaceSize(width, height);
  };
  syncGameSurface();
  const observer = new ResizeObserver(syncGameSurface);
  observer.observe(gameCanvas);
  return engine;
}
