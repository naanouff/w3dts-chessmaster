/**
 * @file ChessGameplayHud.tsx
 * @description Chess Game overlay for scene-viewer (no Tailwind — uses scene-viewer.css).
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  CHESS_HUD_COMMAND_EVENT,
  CHESS_HUD_STATE_EVENT,
  formatChessClock,
  parseChessHudState,
  type ChessHudLearnState,
  type ChessHudPlayState,
  type ChessHudP2pStatus,
  type ChessHudState,
} from '../../chess';
import { chessBus as uiBus } from '../bus';
import ChessModePicker from './ChessModePicker';
import ChessGraphicsMenu from './ChessGraphicsMenu';

const GLASS: CSSProperties = {
  background: 'rgba(20, 22, 28, 0.82)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 8,
};

const AMBER = '#e8b86d';

const MODE_LABEL: Record<ChessHudPlayState['mode'] | 'learn', string> = {
  cpu: 'CPU',
  hotseat: 'Hot-seat',
  p2p: 'P2P',
  learn: 'Learn',
};

const P2P_LABEL: Record<ChessHudP2pStatus, string> = {
  waiting: 'Waiting for peer',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Disconnected',
};

function useChessHudStateFromBus(): ChessHudState | null {
  const [state, setState] = useState<ChessHudState | null>(null);
  const lastJson = useRef('');

  useEffect(() => {
    const onPayload = (raw: unknown): void => {
      const parsed = parseChessHudState(raw);
      if (!parsed) return;
      const j = JSON.stringify(parsed);
      if (j === lastJson.current) return;
      lastJson.current = j;
      setState(parsed);
    };
    uiBus.on(CHESS_HUD_STATE_EVENT, onPayload);
    // Re-request: project may have emitted before this overlay mounted (scene-viewer race).
    uiBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'request-state' });
    return () => {
      uiBus.off(CHESS_HUD_STATE_EVENT, onPayload);
    };
  }, []);

  return state;
}

function HudCard({ children }: { children: ReactNode }): ReactElement {
  return (
    <section className="scv-chess-card" style={GLASS}>
      {children}
    </section>
  );
}

function SmallCapsLabel({ children }: { children: string }): ReactElement {
  return <p className="scv-chess-label">{children}</p>;
}

function Keycap({ keys, caption }: { keys: string; caption: string }): ReactElement {
  return (
    <span className="scv-chess-keycap">
      <kbd>{keys}</kbd>
      <span>{caption}</span>
    </span>
  );
}

function PlayClocks({ state }: { state: ChessHudPlayState }): ReactElement {
  const seat = state.mode === 'hotseat';
  const rows: { color: 'white' | 'black'; seconds: number }[] = [
    { color: 'white', seconds: state.clocks.whiteSeconds },
    { color: 'black', seconds: state.clocks.blackSeconds },
  ];
  return (
    <HudCard>
      <SmallCapsLabel>Clocks</SmallCapsLabel>
      <ul className="scv-chess-clock-list">
        {rows.map((row) => {
          const flagged = state.flag === row.color;
          const active = !state.flag && state.sideToMove === row.color;
          const name = seat
            ? row.color === 'white'
              ? 'Seat White'
              : 'Seat Black'
            : row.color === 'white'
              ? 'White'
              : 'Black';
          return (
            <li
              key={row.color}
              className="scv-chess-clock-row"
              style={{
                color: flagged ? 'rgba(232,234,237,0.55)' : active ? AMBER : '#e8eaed',
                textDecoration: flagged ? 'line-through' : undefined,
                fontWeight: active ? 600 : 500,
              }}
            >
              <span className="scv-chess-clock-name">{name}</span>
              <span>{formatChessClock(row.seconds)}</span>
            </li>
          );
        })}
      </ul>
    </HudCard>
  );
}

function LearnProgress({ state }: { state: ChessHudLearnState }): ReactElement {
  const ratio = state.plyCount > 0 ? Math.min(1, state.plyIndex / state.plyCount) : 0;
  return (
    <HudCard>
      <div className="scv-chess-learn-head">
        <SmallCapsLabel>Line</SmallCapsLabel>
        <span className="scv-chess-mono">
          {state.eco} {state.plyIndex}/{state.plyCount}
        </span>
      </div>
      <div className="scv-chess-progress-track">
        <div className="scv-chess-progress-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <ol className="scv-chess-plies">
        {state.plies.map((ply, i) => {
          const accent = ply.status === 'current' && !ply.hidden;
          return (
            <li
              key={`${ply.san}-${i}`}
              className="scv-chess-ply"
              style={{
                opacity: ply.status === 'done' ? 0.55 : 1,
                background: accent ? 'rgba(232,184,109,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${accent ? AMBER : 'rgba(255,255,255,0.12)'}`,
                color: accent ? AMBER : '#e8eaed',
              }}
            >
              {ply.hidden ? '—' : ply.san}
            </li>
          );
        })}
      </ol>
    </HudCard>
  );
}

function StatusCard({ state }: { state: ChessHudState }): ReactElement {
  const thinking = state.kind === 'play' && state.cpuThinking;
  const p2p = state.kind === 'play' ? state.p2pStatus : null;
  return (
    <HudCard>
      <SmallCapsLabel>{state.label}</SmallCapsLabel>
      <p className="scv-chess-title">{state.title}</p>
      {state.description ? <p className="scv-chess-desc">{state.description}</p> : null}
      {thinking ? (
        <p className="scv-chess-thinking" style={{ color: AMBER }}>
          CPU thinking…
        </p>
      ) : null}
      {p2p ? <p className="scv-chess-p2p">P2P · {P2P_LABEL[p2p]}</p> : null}
    </HudCard>
  );
}

export default function ChessGameplayHud(): ReactElement | null {
  const state = useChessHudStateFromBus();
  if (!state) return null;

  const modeKey = state.kind === 'learn' ? 'learn' : state.mode;
  const resetCaption =
    state.kind === 'learn' && state.complete
      ? 'next opening'
      : state.kind === 'learn'
        ? 'restart line'
        : 'reset';

  return (
    <div
      data-testid="w3dts-chess-hud"
      className="scv-chess-hud"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="scv-chess-hud-top">
        <StatusCard state={state} />
        {state.kind === 'play' ? <PlayClocks state={state} /> : <LearnProgress state={state} />}
      </div>
      <div className="scv-chess-hud-bottom">
        <div className="scv-chess-keys">
          <Keycap keys="LMB" caption="grab" />
          <Keycap keys="RMB / wheel" caption="orbit" />
          <Keycap keys="X" caption={resetCaption} />
        </div>
        <div className="scv-chess-hud-actions">
          <ChessGraphicsMenu />
          <ChessModePicker session={state.session} modeLabel={MODE_LABEL[modeKey]} />
        </div>
      </div>
    </div>
  );
}
