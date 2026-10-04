import { StrictMode, useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CHESS_HUD_COMMAND_EVENT, parseChessHudCommand } from '../chess';
import { chessBus } from './bus';
import './app.css';
import './chess-hud.css';
import { startChessHost } from './startChessHost';
import ChessGameplayHud from './ui/ChessGameplayHud';
import ChessShell from './shell/ChessShell';

function App(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [studioReady, setStudioReady] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('chessPeer') === '1') return;
    const onCommand = (raw: unknown): void => {
      const cmd = parseChessHudCommand(raw);
      if (!cmd || cmd.type !== 'apply-session' || cmd.session.mode !== 'p2p') return;
      const opposite = cmd.session.localColor === 'black' ? 'white' : 'black';
      const table = cmd.table === 'online' ? 'online' : 'local';
      void window.chessMaster?.openPeerWindow(
        `chess=p2p&chessColor=${opposite}&chessPeer=1&chessShell=${table}`
      );
    };
    chessBus.on(CHESS_HUD_COMMAND_EVENT, onCommand);
    return () => {
      chessBus.off(CHESS_HUD_COMMAND_EVENT, onCommand);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!navigator.gpu) {
          throw new Error('WebGPU is not available in this window.');
        }
        await startChessHost(canvas);
        if (cancelled) return;
        setStudioReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStudioReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="cm-canvas" />
      <ChessGameplayHud />
      <ChessShell studioReady={studioReady} />
      {error ? (
        <div className="cm-error" role="alert">
          <div>
            <img className="cm-logo" src="/brand/w3dts-chessmaster-logo.png" alt="" />
            <h1>W3DTS ChessMaster</h1>
            <p>{error}</p>
            <p>This app needs a GPU that exposes WebGPU.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
