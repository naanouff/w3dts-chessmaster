/**
 * @file ChessModePicker.tsx
 * @description Chess session mode picker for scene-viewer HUD.
 */

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import {
  CHESS_HUD_COMMAND_EVENT,
  ECO_OPENINGS,
  type ChessColor,
  type ChessDemoQuery,
  type ChessPlayMode,
} from '../../chess';
import { chessBus as uiBus } from '../bus';

const GLASS: CSSProperties = {
  background: 'rgba(20, 22, 28, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 8,
};

const AMBER = '#e8b86d';

const MODES: { id: ChessPlayMode; title: string; blurb: string }[] = [
  { id: 'cpu', title: 'CPU', blurb: 'Heuristic replies automatically' },
  { id: 'hotseat', title: 'Hot-seat', blurb: 'Pass the mouse at the table' },
  { id: 'p2p', title: 'P2P', blurb: 'Second window of this app' },
  { id: 'learn', title: 'Learn', blurb: 'Walk a short ECO line' },
];

export interface ChessModePickerProps {
  session: ChessDemoQuery;
  modeLabel: string;
}

export default function ChessModePicker({
  session,
  modeLabel,
}: ChessModePickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChessDemoQuery>(session);

  useEffect(() => {
    if (!open) setDraft(session);
  }, [open, session]);

  useEffect(() => {
    uiBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'mode-picker', open });
    return () => {
      uiBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'mode-picker', open: false });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const apply = (): void => {
    uiBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'apply-session', session: draft });
    setOpen(false);
  };

  const setMode = (mode: ChessPlayMode): void => {
    setDraft((prev) => ({
      ...prev,
      mode,
      eco: prev.eco ?? ECO_OPENINGS[0]?.eco ?? 'C50',
    }));
  };

  const setColor = (localColor: ChessColor): void => {
    setDraft((prev) => ({ ...prev, localColor }));
  };

  return (
    <>
      <button
        type="button"
        className="scv-chess-mode-btn"
        style={GLASS}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="scv-chess-label">Mode</span>
        <span className="scv-chess-mode-value">{modeLabel}</span>
      </button>
      {open
        ? createPortal(
            <div
              className="scv-chess-modal-backdrop"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="w3dts-chess-mode-picker-title"
                className="scv-chess-modal"
                style={GLASS}
                onClick={(ev) => ev.stopPropagation()}
              >
                <p id="w3dts-chess-mode-picker-title" className="scv-chess-label">
                  Session
                </p>
                <div className="scv-chess-mode-grid">
                  {MODES.map((tile) => {
                    const selected = draft.mode === tile.id;
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        className="scv-chess-mode-tile"
                        style={{
                          background: selected
                            ? 'rgba(232,184,109,0.16)'
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selected ? AMBER : 'rgba(255,255,255,0.12)'}`,
                        }}
                        onClick={() => setMode(tile.id)}
                      >
                        <span className="scv-chess-mode-tile-title">{tile.title}</span>
                        <span className="scv-chess-mode-tile-blurb">{tile.blurb}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="scv-chess-label scv-chess-mt">Colour</p>
                <div className="scv-chess-color-row">
                  {(['white', 'black'] as const).map((color) => {
                    const selected = draft.localColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        className="scv-chess-color-btn"
                        style={{
                          background: selected
                            ? 'rgba(232,184,109,0.16)'
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selected ? AMBER : 'rgba(255,255,255,0.12)'}`,
                          color: selected ? AMBER : '#e8eaed',
                        }}
                        onClick={() => setColor(color)}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
                {draft.mode === 'learn' ? (
                  <>
                    <label className="scv-chess-label scv-chess-mt" htmlFor="w3dts-chess-eco">
                      Opening
                    </label>
                    <select
                      id="w3dts-chess-eco"
                      className="scv-chess-select"
                      value={draft.eco ?? ECO_OPENINGS[0]?.eco ?? 'C50'}
                      onChange={(ev) => setDraft((prev) => ({ ...prev, eco: ev.target.value }))}
                    >
                      {ECO_OPENINGS.map((opening) => (
                        <option key={opening.eco} value={opening.eco}>
                          {opening.eco} — {opening.name}
                        </option>
                      ))}
                    </select>
                    <label className="scv-chess-check">
                      <input
                        type="checkbox"
                        checked={draft.quiz}
                        onChange={(ev) =>
                          setDraft((prev) => ({ ...prev, quiz: ev.target.checked }))
                        }
                      />
                      Hide next SAN (quiz)
                    </label>
                  </>
                ) : null}
                <div className="scv-chess-modal-actions">
                  <button
                    type="button"
                    className="scv-chess-ghost-btn"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="scv-chess-primary-btn"
                    style={{ background: AMBER, color: '#1a140c' }}
                    onClick={apply}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>,
            document.querySelector('[data-testid="w3dts-chess-hud"]') ?? document.body
          )
        : null}
    </>
  );
}
