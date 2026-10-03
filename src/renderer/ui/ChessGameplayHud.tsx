/**
 * @file ChessGameplayHud.tsx
 * @description Learn-line progress beside the shell. Play status lives in the shell bar.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
  CHESS_HUD_COMMAND_EVENT,
  CHESS_HUD_STATE_EVENT,
  parseChessHudState,
  type ChessHudLearnState,
  type ChessHudState,
} from '../../chess';
import { chessBus as uiBus } from '../bus';
import { shellCopy, subscribeShellLanguage, type ShellLanguage } from '../shell/copy/shellCopy';
import { parseShellPrefs, SHELL_PREFS_KEY } from '../shell/shellScreen';

const GLASS: CSSProperties = {
  background: 'rgba(20, 22, 28, 0.82)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 8,
};

const AMBER = '#e8b86d';

function useChessHudStateFromBus(): ChessHudState | null {
  const [state, setState] = useState<ChessHudState | null>(null);
  const lastJson = useRef('');

  useEffect(() => {
    const onPayload = (raw: unknown): void => {
      const parsed = parseChessHudState(raw);
      if (!parsed) return;
      const json = JSON.stringify(parsed);
      if (json === lastJson.current) return;
      lastJson.current = json;
      setState(parsed);
    };
    uiBus.on(CHESS_HUD_STATE_EVENT, onPayload);
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

function LearnProgress({ state, line }: { state: ChessHudLearnState; line: string }): ReactElement {
  const ratio = state.plyCount > 0 ? Math.min(1, state.plyIndex / state.plyCount) : 0;
  return (
    <HudCard>
      <div className="scv-chess-learn-head">
        <p className="scv-chess-label">{line}</p>
        <span className="scv-chess-mono">
          {state.eco} {state.plyIndex}/{state.plyCount}
        </span>
      </div>
      <div className="scv-chess-progress-track">
        <div className="scv-chess-progress-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <ol className="scv-chess-plies">
        {state.plies.map((ply, index) => {
          const accent = ply.status === 'current' && !ply.hidden;
          return (
            <li
              key={`${ply.san}-${index}`}
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

export default function ChessGameplayHud(): ReactElement | null {
  const state = useChessHudStateFromBus();
  const [language, setLanguage] = useState<ShellLanguage>(() => readShellLanguage());
  useEffect(() => subscribeShellLanguage(setLanguage), []);
  if (!state || state.kind !== 'learn') return null;
  return (
    <div data-testid="w3dts-chess-hud" className="scv-chess-hud" aria-live="polite">
      <div className="scv-chess-hud-top">
        <LearnProgress state={state} line={shellCopy(language).line} />
      </div>
    </div>
  );
}

function readShellLanguage(): ShellLanguage {
  try {
    return parseShellPrefs(globalThis.localStorage?.getItem(SHELL_PREFS_KEY) ?? null).language;
  } catch {
    return 'fr';
  }
}
