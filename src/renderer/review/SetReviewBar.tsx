/**
 * @file SetReviewBar.tsx
 * @project w3dts
 * @author Cyril TARRIET
 * @description Room, camera, and post-process controls for the engine review. Hidden during a match.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  getChessGraphicsEngine,
  getChessGraphicsSettings,
  subscribeChessGraphics,
  useChessGraphicsSettings,
  type ChessGraphicsSettings,
} from '../graphics/chessGraphicsSettings';
import { getChessAmbiance, setChessAmbiance, type ChessAmbianceId } from '../host/chessAmbiance';
import {
  chessReviewColor,
  chessReviewPiece,
  setChessReviewColor,
  setChessReviewPiece,
  subscribeChessReviewColor,
  subscribeChessReviewPiece,
  type ChessReviewPiece,
} from '../host/chessPieceReview';
import type { ChessColor, ChessPieceRole } from '../../chess/rules/chessTypes';
import {
  chessReviewFrame,
  requestChessCameraArrival,
  reviewGrade,
  setChessReviewFrame,
  setReviewGrade,
  subscribeChessReviewFrame,
  type ChessReviewFrame,
  type ReviewGrade,
} from '../host/chessSetReview';
import { sceneLifeEnabled, setSceneLifeEnabled, subscribeSceneLife } from '../host/chessSceneLife';
import {
  REVIEW_POST_CONTROLS,
  readReviewPost,
  writeReviewPost,
  type ReviewPostControl,
  type ReviewPostPass,
} from './reviewPostControls';
import {
  readReviewFrameStats,
  reviewPostConfigJson,
  reviewSectionEnabled,
  reviewSectionFlag,
  stepReviewScene,
  toggleReviewSection,
  type ReviewFrameStats,
  type ReviewMonitor,
} from './reviewHud';

const PIECES: readonly { id: ChessPieceRole; label: string }[] = [
  { id: 'pawn', label: 'Pion' },
  { id: 'rook', label: 'Tour' },
  { id: 'knight', label: 'Cavalier' },
  { id: 'bishop', label: 'Fou' },
  { id: 'queen', label: 'Reine' },
  { id: 'king', label: 'Roi' },
];

const ROOMS: readonly { id: ChessAmbianceId; label: string }[] = [
  { id: 'atelier', label: 'Atelier' },
  { id: 'salon', label: 'Salon' },
  { id: 'club', label: 'Club' },
  { id: 'jardin', label: 'Jardin' },
  { id: 'terrasse', label: 'Terrasse' },
];

const POST_GROUPS = [...new Set(REVIEW_POST_CONTROLS.map((control) => control.group))];

const GRADE_FIELD: Readonly<Record<string, keyof ReviewGrade>> = {
  'grade-brightness': 'brightness',
  'grade-contrast': 'contrast',
  'grade-saturation': 'saturation',
};

function postSeed(): Record<string, number> {
  return Object.fromEntries(REVIEW_POST_CONTROLS.map((control) => [control.id, control.initial]));
}

function formatPost(control: ReviewPostControl, value: number): string {
  if (control.step >= 1) return String(Math.round(value));
  if (control.step >= 0.05) return value.toFixed(2);
  return value.toFixed(3);
}

const SECTIONS = [...POST_GROUPS, 'FXAA'];

function livePostPasses(): ReviewPostPass[] {
  const engine = getChessGraphicsEngine();
  if (!engine) return [];
  return [...engine.renderGraph.getPasses(), ...engine.gameRenderGraph.getPasses()] as ReviewPostPass[];
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

/**
 * Switches the staged room and the review camera. The image is the game engine.
 * @returns The review bar.
 */
export default function SetReviewBar(): ReactElement {
  const [room, setRoom] = useState<ChessAmbianceId>(getChessAmbiance());
  const [frame, setFrame] = useState<ChessReviewFrame>(chessReviewFrame());
  const [graphics, setGraphics] = useState<ChessGraphicsSettings>(getChessGraphicsSettings());
  const [life, setLife] = useState(sceneLifeEnabled());
  const [piece, setPiece] = useState<ChessReviewPiece>(chessReviewPiece());
  const [camp, setCamp] = useState<ChessColor>(chessReviewColor());
  const [stats, setStats] = useState<ReviewFrameStats>({ fps: 0, triangles: 0, passes: [] });
  const [posts, setPosts] = useState<Record<string, number>>(postSeed);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  // The review profile is applied while the host boots, after this bar first renders.
  useEffect(() => {
    setGraphics(getChessGraphicsSettings());
    return subscribeChessGraphics(setGraphics);
  }, []);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    []
  );

  useEffect(() => subscribeChessReviewFrame(setFrame), []);
  useEffect(() => subscribeChessReviewPiece(setPiece), []);
  useEffect(() => subscribeChessReviewColor(setCamp), []);
  useEffect(() => subscribeSceneLife(setLife), []);
  useEffect(() => {
    const next = reviewGrade(room);
    setPosts((current) => ({
      ...current,
      'grade-brightness': next.brightness,
      'grade-contrast': next.contrast,
      'grade-saturation': next.saturation,
    }));
  }, [room]);

  useEffect(() => {
    const tick = (): void => {
      const engine = getChessGraphicsEngine();
      setStats(readReviewFrameStats((engine?.perfMonitor as ReviewMonitor | undefined) ?? null));
      const passes = livePostPasses();
      if (passes.length === 0) return;
      setPosts((current) => {
        let changed = false;
        const next = { ...current };
        for (const control of REVIEW_POST_CONTROLS) {
          const live = readReviewPost(passes, control);
          if (live === null || Math.abs(live - current[control.id]) <= control.step * 0.49) continue;
          next[control.id] = live;
          changed = true;
        }
        return changed ? next : current;
      });
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  const onPost = (control: ReviewPostControl, raw: number): void => {
    const gradeKey = GRADE_FIELD[control.id];
    if (gradeKey) setReviewGrade(room, { ...reviewGrade(room), [gradeKey]: raw });
    const engine = getChessGraphicsEngine();
    if (engine) {
      writeReviewPost(engine.renderGraph.getPasses() as ReviewPostPass[], control, raw);
      writeReviewPost(engine.gameRenderGraph.getPasses() as ReviewPostPass[], control, raw);
    }
    setPosts((current) => ({ ...current, [control.id]: raw }));
  };

  const openRoom = (id: ChessAmbianceId): void => {
    setChessReviewPiece(null);
    setPiece(null);
    setChessAmbiance(id);
    setRoom(id);
  };

  const copyConfig = (): void => {
    void navigator.clipboard.writeText(reviewPostConfigJson(graphics, posts)).then(() => {
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const flipSection = (group: string): void => {
    const next = toggleReviewSection(graphics, group);
    if (next === graphics) return;
    useChessGraphicsSettings(next);
    setGraphics(next);
  };

  const previous = ROOMS.find((entry) => entry.id === stepReviewScene(room, -1)) ?? ROOMS[0];
  const current = ROOMS.find((entry) => entry.id === room) ?? ROOMS[0];
  const following = ROOMS.find((entry) => entry.id === stepReviewScene(room, 1)) ?? ROOMS[0];

  return (
    <div className="set-review">
      <div className="set-review-menu">
        <button
          type="button"
          className={menuOpen ? 'is-on' : undefined}
          aria-label="Menu revue"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="set-review-burger" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        {menuOpen ? (
          <div className="set-review-menu-panel">
            <p>Caméra</p>
            <div className="set-review-menu-row">
              <button
                type="button"
                className={frame === 'game' && piece === null ? 'is-on' : undefined}
                onClick={() => {
                  setChessReviewPiece(null);
                  setPiece(null);
                  setChessReviewFrame('game');
                  setFrame('game');
                }}
              >
                Caméra de jeu
              </button>
              <button
                type="button"
                className={frame === 'wide' && piece === null ? 'is-on' : undefined}
                onClick={() => {
                  setChessReviewPiece(null);
                  setPiece(null);
                  setChessReviewFrame('wide');
                  setFrame('wide');
                }}
              >
                Cadre
              </button>
              <button type="button" onClick={() => requestChessCameraArrival()}>
                Arrivée
              </button>
              <button
                type="button"
                className={camp === 'white' ? 'is-on' : undefined}
                onClick={() => {
                  setChessReviewColor('white');
                  setCamp('white');
                }}
              >
                Blanc
              </button>
              <button
                type="button"
                className={camp === 'black' ? 'is-on' : undefined}
                onClick={() => {
                  setChessReviewColor('black');
                  setCamp('black');
                }}
              >
                Noir
              </button>
            </div>
            <p>Pièces</p>
            <div className="set-review-menu-row">
              <button
                type="button"
                className={piece === null ? 'is-on' : undefined}
                onClick={() => {
                  setChessReviewPiece(null);
                  setPiece(null);
                }}
              >
                Jeu
              </button>
            </div>
            <div className="set-review-menu-row">
              {PIECES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={piece === entry.id ? 'is-on' : undefined}
                  onClick={() => {
                    setChessReviewPiece(entry.id);
                    setPiece(entry.id);
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <p>Ambiance</p>
            <div className="set-review-menu-row">
              <button type="button" className={life ? 'is-on' : undefined} onClick={() => setSceneLifeEnabled(!life)}>
                Vie
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <aside className="set-review-params">
        <button type="button" onClick={copyConfig}>
          {copied ? 'Copié' : 'Copier JSON'}
        </button>
        {SECTIONS.map((group) => (
          <div className="set-review-fold" key={group}>
            <details open>
              <summary>
                <span>{group}</span>
              </summary>
              {REVIEW_POST_CONTROLS.filter((control) => control.group === group).map((control) => (
                <label key={control.id}>
                  {control.label}
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={posts[control.id]}
                    onChange={(event) => onPost(control, Number(event.target.value))}
                  />
                  <span>{formatPost(control, posts[control.id])}</span>
                </label>
              ))}
            </details>
            {reviewSectionFlag(group) ? (
              <button
                type="button"
                className={reviewSectionEnabled(graphics, group) ? 'is-on' : undefined}
                aria-pressed={reviewSectionEnabled(graphics, group)}
                onClick={() => flipSection(group)}
              >
                {reviewSectionEnabled(graphics, group) ? 'On' : 'Off'}
              </button>
            ) : null}
          </div>
        ))}
      </aside>
      <aside className="set-review-stats">
        <p>{stats.fps} img/s</p>
        <p>{formatCount(stats.triangles)} triangles</p>
        <p>{stats.passes.length} passes</p>
        <ol>
          {stats.passes.map((pass) => (
            <li key={pass.name}>
              <span>{pass.name}</span>
              <span>{pass.ms.toFixed(2)} ms</span>
            </li>
          ))}
        </ol>
      </aside>
      <nav className="set-review-scenes">
        <span>{previous.label}</span>
        <button type="button" onClick={() => openRoom(previous.id)}>
          {'<'}
        </button>
        <strong>{current.label}</strong>
        <button type="button" onClick={() => openRoom(following.id)}>
          {'>'}
        </button>
        <span>{following.label}</span>
      </nav>
    </div>
  );
}
