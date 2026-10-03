/**
 * @file ChessGraphicsMenu.tsx
 * @description Graphics options: internal resolution and the expensive chess post effects.
 */

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { CHESS_HUD_COMMAND_EVENT } from '../../chess';
import { chessBus as uiBus } from '../bus';
import {
  GRAPHICS_PRESETS,
  RESOLUTION_OPTIONS,
  TEXTURE_QUALITY_OPTIONS,
  currentGameSurfaceSize,
  getChessGraphicsCanvas,
  getChessGraphicsEngine,
  getChessGraphicsSettings,
  matchingGraphicsPreset,
  readChessFramesPerSecond,
  setChessGraphicsSettings,
  subscribeChessGraphics,
  type ChessGraphicsSettings,
  type ChessResolution,
} from '../graphics/chessGraphicsSettings';

const GLASS: CSSProperties = {
  background: 'rgba(20, 22, 28, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 8,
};

const AMBER = '#e8b86d';

function resolutionLabel(id: ChessResolution): string {
  return RESOLUTION_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export default function ChessGraphicsMenu(): ReactElement {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ChessGraphicsSettings>(getChessGraphicsSettings);
  const [fps, setFps] = useState(0);
  const [surface, setSurface] = useState({ width: 0, height: 0 });

  useEffect(() => subscribeChessGraphics(setSettings), []);

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

  useEffect(() => {
    if (!open) return;
    const tick = (): void => {
      setFps(readChessFramesPerSecond(getChessGraphicsEngine()));
      setSurface(currentGameSurfaceSize(getChessGraphicsCanvas()));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [open, settings]);

  const patch = (partial: Partial<ChessGraphicsSettings>): void => {
    setChessGraphicsSettings({ ...settings, ...partial });
  };

  const presetId = matchingGraphicsPreset(settings);

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
        <span className="scv-chess-label">Options</span>
        <span className="scv-chess-mode-value">{resolutionLabel(settings.resolution)}</span>
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
                aria-labelledby="w3dts-chess-graphics-title"
                className="scv-chess-modal"
                style={GLASS}
                onClick={(ev) => ev.stopPropagation()}
              >
                <p id="w3dts-chess-graphics-title" className="scv-chess-label">
                  Graphismes
                </p>
                <p className="scv-chess-desc">
                  En 4K, l’occlusion, les reflets et le bloom sont calculés sur chaque pixel. Fluide
                  limite le rendu interne à 1080p.
                </p>
                <div className="scv-chess-mode-grid">
                  {GRAPHICS_PRESETS.map((preset) => {
                    const selected = presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className="scv-chess-mode-tile"
                        style={{
                          background: selected
                            ? 'rgba(232,184,109,0.16)'
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selected ? AMBER : 'rgba(255,255,255,0.12)'}`,
                        }}
                        onClick={() => setChessGraphicsSettings(preset.settings)}
                      >
                        <span className="scv-chess-mode-tile-title">{preset.title}</span>
                        <span className="scv-chess-mode-tile-blurb">{preset.blurb}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="scv-chess-label scv-chess-mt">Résolution interne</p>
                <div className="scv-chess-color-row">
                  {RESOLUTION_OPTIONS.map((option) => {
                    const selected = settings.resolution === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="scv-chess-color-btn"
                        style={{
                          background: selected
                            ? 'rgba(232,184,109,0.16)'
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selected ? AMBER : 'rgba(255,255,255,0.12)'}`,
                          color: selected ? AMBER : '#e8eaed',
                        }}
                        onClick={() => patch({ resolution: option.id })}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="scv-chess-label scv-chess-mt">Textures des pièces</p>
                <div className="scv-chess-color-row">
                  {TEXTURE_QUALITY_OPTIONS.map((option) => {
                    const selected = settings.textureQuality === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="scv-chess-color-btn"
                        style={{
                          background: selected
                            ? 'rgba(232,184,109,0.16)'
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selected ? AMBER : 'rgba(255,255,255,0.12)'}`,
                          color: selected ? AMBER : '#e8eaed',
                        }}
                        onClick={() => patch({ textureQuality: option.id })}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <label className="scv-chess-check">
                  <input
                    type="checkbox"
                    checked={settings.shadows}
                    onChange={(ev) => patch({ shadows: ev.target.checked })}
                  />
                  Ombres
                </label>
                <label className="scv-chess-check">
                  <input
                    type="checkbox"
                    checked={settings.ambientOcclusion}
                    onChange={(ev) => patch({ ambientOcclusion: ev.target.checked })}
                  />
                  Occlusion ambiante
                </label>
                <label className="scv-chess-check">
                  <input
                    type="checkbox"
                    checked={settings.reflections}
                    onChange={(ev) => patch({ reflections: ev.target.checked })}
                  />
                  Reflets du plateau
                </label>
                <label className="scv-chess-check">
                  <input
                    type="checkbox"
                    checked={settings.bloom}
                    onChange={(ev) => patch({ bloom: ev.target.checked })}
                  />
                  Bloom
                </label>
                <p className="scv-chess-p2p">
                  Rendu {surface.width}×{surface.height}
                  {fps > 0 ? ` · ${fps} img/s` : ''}
                </p>
                <div className="scv-chess-modal-actions">
                  <button
                    type="button"
                    className="scv-chess-primary-btn"
                    style={{ background: AMBER, color: '#1a140c' }}
                    onClick={() => setOpen(false)}
                  >
                    Fermer
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
