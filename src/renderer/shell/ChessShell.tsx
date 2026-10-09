/**
 * @file ChessShell.tsx
 * @description Welcome, modes, lobby, pause, saves, options and settings over the chess table.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
  CHESS_COACH_CONTEXT_EVENT,
  CHESS_COACH_OBJECT_EVENT,
  CHESS_HUD_COMMAND_EVENT,
  CHESS_HUD_STATE_EVENT,
  CHESS_SAVES_EVENT,
  ECO_OPENINGS,
  SAVED_GAMES_KEY,
  cpuSearchDepth,
  emptySaveCabinet,
  formatChessClock,
  parseChessCoachContext,
  parseChessHudState,
  parseSaveCabinet,
  type ChessColor,
  type ChessHudState,
  type CoachContext,
  type SaveCabinet,
  type SavedGame,
} from '../../chess';
import { chessBus } from '../bus';
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
  type ChessShadowMode,
  type ChessTextureQuality,
  type ChessUpscale,
} from '../graphics/chessGraphicsSettings';
import { ChessMenuMusic } from '../host/chessMenuMusic';
import { setChessAudioLevels } from '../host/chessTableAudio';
import {
  CHESS_AMBIANCES,
  chessSetLook,
  getChessAmbiance,
  setChessAmbiance,
  subscribeChessAmbiance,
  type ChessAmbianceId,
} from '../host/chessAmbiance';
import { bundledReleaseNote } from './bundledReleaseNotes';
import {
  isShellLanguage,
  publishShellLanguage,
  SHELL_LANGUAGE_LABELS,
  SHELL_LANGUAGES,
  shellCopy,
  type ShellCopy,
  type ShellLanguage,
} from './copy/shellCopy';
import {
  acceptJoinCode,
  bootCrestFill,
  bootCrestInset,
  defaultShellPrefs,
  initialShell,
  parseShellPrefs,
  peerResumeSearch,
  rangeThumbRatio,
  gameEndFromLearn,
  gameEndFromPlay,
  sheetBodyOverflows,
  reduceShell,
  type GameEnd,
  SHELL_PREFS_KEY,
  shellBlocksPlay,
  shellSession,
  shellWantsMenuMusic,
  type ShellAction,
  type ShellMode,
  type ShellPrefs,
  type ShellState,
} from './shellScreen';
import { COACH_LOCAL_BASE_URL, preferCoachModel, probeLocalOllama } from '../../chess/coach/coachClient';
import type { CoachProbeResult } from '../chessMaster';
import { coachDialoguePages } from './coachDialogue';
import { coachGhostSteps, coachMessages, type CoachAskKind } from './coachDrawer';
import './shell.css';

const MODE_IDS = ['cpu', 'hotseat', 'local', 'online', 'learn', 'training'] as const satisfies readonly ShellMode[];

function loadPrefs(): ShellPrefs {
  try {
    return parseShellPrefs(globalThis.localStorage?.getItem(SHELL_PREFS_KEY) ?? null);
  } catch {
    return defaultShellPrefs();
  }
}

function savePrefs(prefs: ShellPrefs): void {
  try {
    globalThis.localStorage?.setItem(SHELL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
  setChessAudioLevels(prefs.sfx, prefs.ambience);
  publishShellLanguage(prefs.language);
}

function loadCabinet(): SaveCabinet {
  try {
    return parseSaveCabinet(globalThis.localStorage?.getItem(SAVED_GAMES_KEY) ?? null);
  } catch {
    return emptySaveCabinet();
  }
}

function saveLine(copy: ShellCopy, game: SavedGame, language: ShellLanguage): string {
  const mode = copy.modeCards[game.shellMode].title;
  const side = game.localColor === 'black' ? copy.black : copy.white;
  const tail =
    game.kind === 'voluntary' && game.savedAt > 0
      ? new Date(game.savedAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : language, {
          day: 'numeric',
          month: 'short',
        })
      : formatChessClock(game.whiteSeconds);
  return `${mode} · ${side} · ${tail}`;
}

function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'A';
  }
  return code;
}

function Choice({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const labels = options.map((option) => option.label).join('\u0000');
  useLayoutEffect(() => {
    const button = root.current?.querySelector<HTMLButtonElement>(`[data-choice="${selected}"]`);
    if (!button) return;
    setBox({
      left: button.offsetLeft,
      top: button.offsetTop,
      width: button.offsetWidth,
      height: button.offsetHeight,
      ready: true,
    });
  }, [selected, labels]);
  return (
    <div className="choice" ref={root}>
      {box.ready ? (
        <span
          className="choice-thumb"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      ) : null}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          data-choice={option.id}
          className={option.id === selected ? 'is-selected' : ''}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BootCover({
  studioReady,
  onGone,
}: {
  studioReady: boolean;
  onGone: () => void;
}): ReactElement | null {
  const reduceMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  const [fill, setFill] = useState(reduceMotion ? 1 : 0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (reduceMotion || studioReady) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      setFill(bootCrestFill(now - started, false));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, studioReady]);

  useEffect(() => {
    if (!studioReady || gone) return;
    setFill(1);
    if (reduceMotion) {
      setGone(true);
      onGoneRef.current();
      return;
    }
    const frame = requestAnimationFrame(() => setLeaving(true));
    const fallback = window.setTimeout(() => {
      setGone(true);
      onGoneRef.current();
    }, 900);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [studioReady, reduceMotion, gone]);

  if (gone) return null;

  return (
    <section
      className={leaving ? 'boot is-leaving' : 'boot'}
      role="status"
      aria-label="Préparation du studio"
      onTransitionEnd={(event) => {
        if (event.propertyName !== 'opacity') return;
        setGone(true);
        onGoneRef.current();
      }}
    >
      <div className="boot-crest">
        <img className="is-gray" src="/brand/w3dts-chessmaster-logo.png" alt="" />
        <img
          className="is-color"
          src="/brand/w3dts-chessmaster-logo.png"
          alt=""
          style={{ clipPath: `inset(${bootCrestInset(fill)} 0 0 0)` }}
        />
      </div>
      <p className="boot-credit">ChessMaster & W3DTS copyright Cyril TARRIET</p>
    </section>
  );
}

function endTitle(copy: ShellCopy, kind: GameEnd['kind']): string {
  if (kind === 'won') return copy.won;
  if (kind === 'lost') return copy.lost;
  return copy.drawn;
}

function endSentence(copy: ShellCopy, end: GameEnd): string {
  if (end.cause === 'stalemate') return copy.stalemateLine;
  if (end.cause === 'insufficient') return copy.insufficientLine;
  if (end.cause === 'agreed') return copy.agreedLine;
  if (end.cause === 'resign') return end.loser === 'black' ? copy.resignBlack : copy.resignWhite;
  if (end.cause === 'line') return copy.lineDone;
  if (end.cause === 'flag') return end.loser === 'black' ? copy.flagBlack : copy.flagWhite;
  return end.loser === 'black' ? copy.mateBlack : copy.mateWhite;
}

export default function ChessShell({ studioReady }: { studioReady: boolean }): ReactElement {
  const peer = new URLSearchParams(window.location.search).get('chessPeer') === '1';
  const [bootGone, setBootGone] = useState(false);
  const [prefs, setPrefs] = useState<ShellPrefs>(loadPrefs);
  const [shell, setShell] = useState<ShellState>(() => {
    const base = initialShell(peer);
    if (peer) return base;
    return { ...base, mode: loadPrefs().mode };
  });
  const copy = shellCopy(prefs.language);
  const [hud, setHud] = useState<ChessHudState | null>(null);
  const [color, setColor] = useState<ChessColor>(() => (peer ? 'white' : loadPrefs().color));
  const [hostColor, setHostColor] = useState<ChessColor>(() => (peer ? 'white' : loadPrefs().color));
  const [level, setLevel] = useState(() => (peer ? 2 : loadPrefs().level));
  const [eco, setEco] = useState(() => (peer ? (ECO_OPENINGS[0]?.eco ?? 'C50') : loadPrefs().eco));
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [graphics, setGraphics] = useState<ChessGraphicsSettings>(getChessGraphicsSettings);
  const [ambiance, setAmbiance] = useState<ChessAmbianceId>(getChessAmbiance);
  const [fps, setFps] = useState(0);
  const [surface, setSurface] = useState({ width: 0, height: 0 });
  const [question, setQuestion] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [dialoguePage, setDialoguePage] = useState(0);
  const [welcomeHidden, setWelcomeHidden] = useState(false);
  const [coachContext, setCoachContext] = useState<CoachContext | null>(null);
  const [horizon, setHorizon] = useState(3);
  const [objecting, setObjecting] = useState(false);
  const [objectionLeaving, setObjectionLeaving] = useState(false);
  const [coachModels, setCoachModels] = useState<string[]>([]);
  const [coachStatus, setCoachStatus] = useState<'checking' | 'ready' | 'installed' | 'missing'>('checking');
  const [coachRemote, setCoachRemote] = useState(false);
  const [coachBase, setCoachBase] = useState('http://127.0.0.1:11434/v1');
  const [coachModel, setCoachModel] = useState('');
  const [coachKey, setCoachKey] = useState('');
  const [hideEnd, setHideEnd] = useState(false);
  const endRef = useRef<GameEnd | null>(null);
  const objectingRef = useRef(false);
  const objectionTimersRef = useRef<number[]>([]);
  const explainAfterRef = useRef(false);
  const [rankTab, setRankTab] = useState<'local' | 'online'>('local');
  const [cabinet, setCabinet] = useState<SaveCabinet>(loadCabinet);
  const [savedFlash, setSavedFlash] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const menuMusic = useRef<ChessMenuMusic | null>(null);
  if (menuMusic.current === null) menuMusic.current = new ChessMenuMusic();

  useEffect(() => {
    savePrefs(prefs);
    menuMusic.current?.applyMaster();
  }, [prefs]);

  useEffect(() => {
    const bus = menuMusic.current;
    if (!bus) return;
    bus.setWanted(bootGone && shellWantsMenuMusic(shell.screen));
  }, [bootGone, shell.screen]);

  useEffect(() => {
    const bus = menuMusic.current;
    if (!bus) return;
    const arm = (): void => {
      void bus.arm();
    };
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      bus.stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void window.chessMaster?.version().then((value) => {
      if (!cancelled && value) setAppVersion(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeChessGraphics(setGraphics), []);
  useEffect(() => subscribeChessAmbiance(setAmbiance), []);

  useEffect(() => {
    const onHud = (raw: unknown): void => {
      const parsed = parseChessHudState(raw);
      if (parsed) setHud(parsed);
    };
    chessBus.on(CHESS_HUD_STATE_EVENT, onHud);
    const onSaves = (raw: unknown): void => {
      setCabinet(parseSaveCabinet(JSON.stringify(raw ?? null)));
    };
    chessBus.on(CHESS_SAVES_EVENT, onSaves);
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'request-state' });
    return () => {
      chessBus.off(CHESS_HUD_STATE_EVENT, onHud);
      chessBus.off(CHESS_SAVES_EVENT, onSaves);
    };
  }, []);

  useEffect(() => {
    if (shell.screen !== 'pause') setSavedFlash(false);
  }, [shell.screen]);

  useEffect(() => {
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
      type: 'mode-picker',
      open: !bootGone || shellBlocksPlay(shell),
    });
  }, [shell.screen, bootGone]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !bootGone) return;
      if (objectingRef.current) {
        objectingRef.current = false;
        setObjecting(false);
        document.body.classList.remove('is-shaken');
        return;
      }
      const finished = endRef.current;
      setShell((prev) => {
        if (finished && (prev.screen === 'partie' || prev.screen === 'pause')) {
          return reduceShell(prev, { type: 'go', screen: 'accueil' });
        }
        return reduceShell(prev, { type: 'escape' });
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bootGone]);

  useEffect(() => {
    const onContext = (raw: unknown): void => {
      const parsed = parseChessCoachContext(raw);
      if (!parsed) return;
      setCoachContext((prev) => {
        if (
          prev &&
          prev.fen === parsed.fen &&
          prev.sideToMove === parsed.sideToMove &&
          prev.history.join(' ') === parsed.history.join(' ') &&
          prev.training?.held === parsed.training?.held &&
          prev.training?.lastUserSan === parsed.training?.lastUserSan &&
          prev.training?.clock === parsed.training?.clock
        ) {
          return prev;
        }
        return parsed;
      });
    };
    const clearObjectionTimers = (): void => {
      for (const id of objectionTimersRef.current) window.clearTimeout(id);
      objectionTimersRef.current = [];
    };
    const onObject = (): void => {
      clearObjectionTimers();
      setCoachNote(copy.objectionLesson);
      explainAfterRef.current = true;
      setShell((prev) => reduceShell(prev, { type: 'open-assistant' }));
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        objectingRef.current = false;
        setObjecting(false);
        setObjectionLeaving(false);
        document.body.classList.remove('is-shaken');
        objectionTimersRef.current = [
          window.setTimeout(() => document.getElementById('coach-stop')?.focus(), 0),
        ];
        return;
      }
      objectingRef.current = true;
      setObjectionLeaving(false);
      setObjecting(true);
      document.body.classList.add('is-shaken');
      objectionTimersRef.current = [
        window.setTimeout(() => setObjectionLeaving(true), 1600),
        window.setTimeout(() => {
          objectingRef.current = false;
          setObjecting(false);
          setObjectionLeaving(false);
          document.body.classList.remove('is-shaken');
          document.getElementById('coach-stop')?.focus();
        }, 2050),
      ];
    };
    chessBus.on(CHESS_COACH_CONTEXT_EVENT, onContext);
    chessBus.on(CHESS_COACH_OBJECT_EVENT, onObject);
    return () => {
      clearObjectionTimers();
      chessBus.off(CHESS_COACH_CONTEXT_EVENT, onContext);
      chessBus.off(CHESS_COACH_OBJECT_EVENT, onObject);
    };
  }, [copy.objectionLesson]);

  useEffect(() => {
    const show =
      shell.screen === 'partie' && shell.mode === 'training' && shell.assistant && coachContext !== null;
    const student = coachContext?.training?.localColor;
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
      type: 'coach-ghosts',
      horizon,
      steps: show && coachContext && student ? coachGhostSteps(coachContext.fen, horizon, student) : [],
    });
  }, [shell.screen, shell.mode, shell.assistant, coachContext, horizon]);

  const applyProbe = (result: CoachProbeResult): void => {
    setCoachStatus(result.state);
    setCoachModels(result.models ?? []);
    setCoachBase(result.settings.baseUrl);
    setCoachModel(result.settings.model);
    if (result.settings.baseUrl !== COACH_LOCAL_BASE_URL && result.settings.model) setCoachRemote(true);
  };

  useEffect(() => {
    const bridge = window.chessMaster;
    if (!bridge) return;
    let cancelled = false;
    const accept = (result: CoachProbeResult): void => {
      if (!cancelled) applyProbe(result);
    };
    if (bridge.coachProbe) {
      void bridge.coachProbe().then(accept);
      return () => {
        cancelled = true;
      };
    }
    void probeLocalOllama(globalThis.fetch.bind(globalThis), false).then(async (probe) => {
      if (cancelled) return;
      if (probe.state !== 'ready') {
        setCoachStatus('installed');
        return;
      }
      const model = preferCoachModel(probe.models, '');
      setCoachStatus('ready');
      setCoachModels(probe.models);
      if (!model) return;
      const saved = await bridge.coachSaveSettings?.({ baseUrl: COACH_LOCAL_BASE_URL, model });
      if (cancelled) return;
      if (saved?.ok) {
        setCoachModel(saved.settings.model);
        setCoachBase(saved.settings.baseUrl);
      } else {
        setCoachModel(model);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [shell.screen]);

  const askCoach = (kind: CoachAskKind): void => {
    const chat = window.chessMaster?.coachChat;
    if (!coachContext || !chat) {
      if (kind !== 'mistake') setCoachNote(copy.noModel);
      return;
    }
    const messages = coachMessages(kind, coachContext, question, horizon, shell.mode === 'learn', prefs.language);
    void chat(messages).then((result) => {
      if (result.ok) setCoachNote(result.text);
      else if (result.error === 'no-model') setCoachNote(copy.noModel);
      else if (result.error !== 'cancelled') setCoachNote(copy.noAnswer);
    });
  };

  useEffect(() => {
    setDialoguePage(0);
  }, [coachNote, welcomeHidden, shell.mode, shell.assistant, prefs.language]);

  useEffect(() => {
    if (!explainAfterRef.current || !shell.assistant || !coachContext?.training?.lastUserSan) return;
    explainAfterRef.current = false;
    askCoach('mistake');
  }, [shell.assistant, coachContext, prefs.language]);

  const saveCoachLink = (): void => {
    void window.chessMaster
      ?.coachSaveSettings?.({
        baseUrl: coachBase,
        model: coachModel,
        ...(coachKey ? { apiKey: coachKey } : {}),
      })
      .then((result) => {
        if (result.ok) {
          setCoachBase(result.settings.baseUrl);
          setCoachModel(result.settings.model);
          setCoachKey('');
          setCoachNote('');
        } else {
          setCoachNote(copy.noAnswer);
        }
      });
  };

  const chooseLocalModel = (model: string): void => {
    setCoachModel(model);
    void window.chessMaster?.coachSaveSettings?.({ baseUrl: COACH_LOCAL_BASE_URL, model });
  };

  const launchOllama = (): void => {
    setCoachStatus('checking');
    void window.chessMaster?.coachLaunch?.().then(applyProbe);
  };

  useEffect(() => {
    const primary = root.current?.querySelector<HTMLElement>('[data-primary]');
    primary?.focus();
  }, [shell.screen, shell.assistant]);

  useEffect(() => {
    if (shell.screen !== 'options') return;
    const tick = (): void => {
      setFps(readChessFramesPerSecond(getChessGraphicsEngine()));
      setSurface(currentGameSurfaceSize(getChessGraphicsCanvas()));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [shell.screen, graphics]);

  const rememberColor = (next: ChessColor): void => {
    setColor(next);
    setHostColor(next);
    setPrefs((prev) => ({ ...prev, color: next }));
  };

  const dispatch = (action: ShellAction): void => {
    const next = reduceShell(shell, action);
    setShell(next);
    if (action.type === 'set-mode') setPrefs((prev) => ({ ...prev, mode: action.mode }));
    const leavesOnline =
      shell.mode === 'online' &&
      (action.type === 'leave-table' ||
        (action.type === 'go' &&
          (shell.screen === 'salon' || shell.screen === 'partie' || shell.screen === 'pause')));
    if (leavesOnline) chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'close-table' });
    const starts =
      (action.type === 'start' && next.screen === 'partie') ||
      action.type === 'create-table' ||
      action.type === 'join-table';
    if (!starts) return;
    const online = action.type === 'create-table' || action.type === 'join-table';
    const side = online
      ? action.type === 'create-table'
        ? hostColor
        : hostColor === 'white'
          ? 'black'
          : 'white'
      : color;
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
      type: 'apply-session',
      session: shellSession(
        next.mode,
        side,
        eco,
        level,
        online ? { room: action.code, seat: action.type === 'create-table' ? 'host' : 'guest' } : undefined
      ),
      table: next.mode,
    });
  };

  const openSaved = (game: SavedGame): void => {
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
      type: 'resume-saved',
      game,
      ...(game.shellMode === 'cpu' || game.shellMode === 'training'
        ? { cpuDepth: cpuSearchDepth(level) }
        : {}),
    });
    setColor(game.localColor);
    if (game.shellMode === 'online') setHostColor(game.localColor);
    if (game.eco) setEco(game.eco);
    setPrefs((prev) => ({
      ...prev,
      mode: game.shellMode,
      color: game.localColor,
      ...(game.eco ? { eco: game.eco } : {}),
    }));
    setShell((prev) => {
      const withMode = reduceShell(prev, { type: 'set-mode', mode: game.shellMode });
      if (game.shellMode === 'online') {
        return { ...withMode, screen: 'salon', back: 'modes', assistant: false, notice: '' };
      }
      return reduceShell(withMode, { type: 'start' });
    });
    if (game.shellMode === 'local') {
      void window.chessMaster?.openPeerWindow(peerResumeSearch(game.localColor, game.id));
    }
  };

  const replayMatch = (): void => {
    if (shell.screen === 'pause') dispatch({ type: 'resume' });
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'reset-match' });
  };

  const saveGame = (): void => {
    const before = loadCabinet().voluntary.at(-1)?.id;
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'save-voluntary' });
    const after = loadCabinet();
    setCabinet(after);
    if (after.voluntary.at(-1)?.id !== before) setSavedFlash(true);
  };

  const menu = shell.screen !== 'partie';
  const play = hud?.kind === 'play' ? hud : null;
  const end = play
    ? gameEndFromPlay({
        localColor: play.localColor,
        sideToMove: play.sideToMove,
        flag: play.flag,
        outcome: play.outcome,
        resignLoser: play.resignLoser,
      })
    : hud?.kind === 'learn'
      ? gameEndFromLearn(hud.complete)
      : null;
  endRef.current = end;
  const endKey = end ? `${end.kind}:${end.cause}:${end.loser ?? ''}` : '';
  const showEnd =
    Boolean(end) &&
    !hideEnd &&
    (shell.screen === 'partie' || shell.screen === 'pause' || shell.screen === 'nulle-offre');

  useEffect(() => {
    if (shell.mode !== 'online' || !play) return;
    if (shell.screen === 'salon' && play.onlineRefused && shell.notice !== 'missing') {
      dispatch({ type: 'miss-table' });
      return;
    }
    if (shell.screen === 'salon' && play.onlineReady) {
      dispatch({ type: 'peer-ready' });
      return;
    }
    if (shell.screen === 'partie' && play.p2pStatus === 'disconnected') {
      dispatch({ type: 'leave-table' });
    }
  }, [shell.mode, shell.screen, shell.notice, play?.onlineReady, play?.onlineRefused, play?.p2pStatus]);

  useEffect(() => {
    setHideEnd(false);
  }, [endKey]);

  useEffect(() => {
    if (!play || end) return;
    if (play.drawOffer === 'incoming' && shell.screen !== 'nulle-offre') {
      setShell((prev) => ({ ...prev, screen: 'nulle-offre', back: 'pause', assistant: false }));
    }
  }, [play?.drawOffer, play, end, shell.screen]);

  useEffect(() => {
    if (!showEnd) return;
    root.current?.querySelector<HTMLElement>('#fin-see')?.focus();
  }, [showEnd]);
  const turn =
    play?.sideToMove === 'black' ? copy.blackTurn : copy.whiteTurn;
  const clock = play
    ? formatChessClock(
        play.sideToMove === 'black' ? play.clocks.blackSeconds : play.clocks.whiteSeconds
      )
    : '10:00';
  const opening = openingName(copy, eco);
  const modeTitle =
    shell.mode === 'learn'
      ? `${copy.learn} · ${opening}`
      : copy.modeCards[shell.mode].title;
  const coachSpeech =
    coachNote ||
    (!welcomeHidden && shell.mode === 'training' && shell.assistant
      ? `${copy.trainingWelcome} ${copy.ghostHint}`
      : '');
  const dialoguePages = coachDialoguePages(coachSpeech);
  const dialogueIndex = Math.min(dialoguePage, Math.max(0, dialoguePages.length - 1));

  return (
    <div ref={root} className={menu ? 'shell is-menu' : 'shell'} data-screen={shell.screen}>
      <BootCover studioReady={studioReady} onGone={() => setBootGone(true)} />
      {objecting ? (
        <div className={objectionLeaving ? 'objection is-leaving' : 'objection'} role="alert">
          <img src="/brand/coach-crest.webp" alt="" />
          <p className="objection-word">{copy.objection}</p>
          <p className="objection-line">{copy.objectionLine}</p>
        </div>
      ) : null}
      {shell.screen === 'accueil' ? (
        <section className="panel">
          <img className="crest" src="/brand/w3dts-chessmaster-logo.png" alt="" />
          <h1>W3DTS ChessMaster</h1>
          <button type="button" className="primary" data-primary onClick={() => dispatch({ type: 'play' })}>
            {copy.play}
          </button>
          {cabinet.interrupt ? (
            <button type="button" className="ghost home-resume" onClick={() => openSaved(cabinet.interrupt!)}>
              {copy.resumeGame}
            </button>
          ) : null}
          <nav className="text-links">
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'sauvegardes' })}>
              {copy.saves}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'classements' })}>
              {copy.ranks}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'options' })}>
              {copy.options}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'parametres' })}>
              {copy.settings}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'propos' })}>
              {copy.about}
            </button>
          </nav>
        </section>
      ) : null}

      {shell.screen === 'modes' ? (
        <section className="panel wide">
          <h1>{copy.modes}</h1>
          <div className="cards">
            {MODE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={shell.mode === id ? 'is-selected' : ''}
                onClick={() => dispatch({ type: 'set-mode', mode: id })}
              >
                <strong>{copy.modeCards[id].title}</strong>
                <span>{copy.modeCards[id].blurb}</span>
              </button>
            ))}
          </div>
          {shell.mode === 'cpu' || shell.mode === 'training' ? (
            <>
              <h2>{copy.color}</h2>
              <Choice
                options={[
                  { id: 'white', label: copy.white },
                  { id: 'black', label: copy.black },
                ]}
                selected={color}
                onSelect={(id) => rememberColor(id === 'black' ? 'black' : 'white')}
              />
              {shell.mode === 'cpu' ? (
                <>
                  <p className="field">
                    {copy.level} {level}
                  </p>
                  <ScaleRange
                    min={1}
                    max={3}
                    value={level}
                    onChange={(value) => {
                      setLevel(value);
                      setPrefs((prev) => ({ ...prev, level: value }));
                    }}
                  />
                </>
              ) : null}
            </>
          ) : null}
          {shell.mode === 'learn' ? (
            <>
              <h2>{copy.line}</h2>
              <Choice
                options={ECO_OPENINGS.map((item) => ({
                  id: item.eco,
                  label: `${item.eco} ${openingName(copy, item.eco)}`,
                }))}
                selected={eco}
                onSelect={(id) => {
                  setEco(id);
                  setPrefs((prev) => ({ ...prev, eco: id }));
                }}
              />
            </>
          ) : null}
          <div className="row-actions">
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'accueil' })}>
              {copy.back}
            </button>
            <button type="button" className="primary" data-primary onClick={() => dispatch({ type: 'start' })}>
              {shell.mode === 'online' ? copy.openLobby : copy.begin}
            </button>
          </div>
        </section>
      ) : null}

      {shell.screen === 'salon' ? (
        <section className="panel sheet">
          <h1>{copy.lobby}</h1>
          <div className="split">
            <div>
              <h2>{copy.create}</h2>
              <Choice
                options={[
                  { id: 'white', label: copy.white },
                  { id: 'black', label: copy.black },
                ]}
                selected={hostColor}
                onSelect={(id) => rememberColor(id === 'black' ? 'black' : 'white')}
              />
              <p className="hint">{copy.colorHint}</p>
              <p className="code">{code || '—'}</p>
              <button
                type="button"
                className="primary"
                data-primary
                onClick={() => {
                  const next = makeCode();
                  setCode(next);
                  dispatch({ type: 'create-table', code: next });
                }}
              >
                {copy.create}
              </button>
              {code ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void navigator.clipboard?.writeText(code)}
                >
                  {copy.copy}
                </button>
              ) : null}
            </div>
            <div>
              <h2>{copy.join}</h2>
              <input
                type="text"
                value={joinCode}
                maxLength={4}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              />
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const next = joinCode.trim().toUpperCase();
                  dispatch(acceptJoinCode(next) ? { type: 'join-table', code: next } : { type: 'reject-code' });
                }}
              >
                {copy.join}
              </button>
              {shell.notice === 'refused' ? <p className="notice">{copy.refused}</p> : null}
              {shell.notice === 'missing' ? <p className="notice">{copy.tableMissing}</p> : null}
              {play?.p2pStatus ? <p className="hint">{copy.p2p[play.p2pStatus]}</p> : null}
            </div>
          </div>
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'modes' })}>
            {copy.backModes}
          </button>
        </section>
      ) : null}

      {shell.screen === 'partie' || shell.screen === 'pause' ? (
        <>
          <header className="bar">
            <img className="crest-sm" src="/brand/w3dts-chessmaster-logo.png" alt="" />
            <div className="bar-copy">
              <p>{end ? endTitle(copy, end.kind) : play?.cpuThinking ? copy.thinking : turn}</p>
              <p className="hint">{end ? endSentence(copy, end) : modeTitle}</p>
            </div>
            {end || (shell.mode === 'training' && coachContext?.training?.clock !== true) ? null : (
            <p className="clock">{clock}</p>
          )}
            {play?.p2pStatus ? (
              <p className="hint">
                {copy.p2p[play.p2pStatus]}
                {code ? ` · ${code}` : ''}
              </p>
            ) : null}
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'open-assistant' })}>
              {copy.assistant}
            </button>
            {end && hideEnd ? (
              <button type="button" className="ghost" id="reopen-fin" onClick={() => setHideEnd(false)}>
                {copy.result}
              </button>
            ) : null}
            {end ? null : (
            <button
              type="button"
              className="primary"
              {...(shell.screen === 'partie' ? { 'data-primary': true } : {})}
              onClick={() => dispatch({ type: shell.screen === 'pause' ? 'resume' : 'escape' })}
            >
              {shell.screen === 'pause' ? copy.resume : copy.pause}
            </button>
            )}
          </header>
          <p className="keys">
            <span>
              <kbd>LMB</kbd> {copy.grab}
            </span>
            <span>
              <kbd>RMB</kbd> {copy.orbit}
            </span>
            <span>
              <kbd>X</kbd> {copy.reset}
            </span>
          </p>
          {shell.screen === 'partie' && dialoguePages.length > 0 ? (
            <section className="dialogue" aria-live="polite">
              <p>{dialoguePages[dialogueIndex]}</p>
              <div className="dialogue-nav">
                {dialogueIndex > 0 ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setDialoguePage((page) => Math.max(0, page - 1))}
                  >
                    {copy.dialoguePrev}
                  </button>
                ) : null}
                {dialogueIndex < dialoguePages.length - 1 ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setDialoguePage((page) => page + 1)}
                  >
                    {copy.dialogueNext}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    if (coachNote) setCoachNote('');
                    else setWelcomeHidden(true);
                  }}
                >
                  {dialogueIndex < dialoguePages.length - 1 ? copy.dialogueSkip : copy.close}
                </button>
              </div>
            </section>
          ) : null}
          {shell.screen === 'partie' && shell.assistant ? (
            <aside className="drawer">
              <header className="drawer-head">
                <img className="presence" src="/brand/coach-crest.webp" alt="" />
                <div>
                  <h2>{copy.assistant}</h2>
                  <p className="banner">{copy.coachBanner}</p>
                </div>
              </header>
              {!coachNote && coachStatus !== 'checking' && !coachModel ? (
                <p className="notice">{copy.noModel}</p>
              ) : null}
              <div className="drawer-actions">
                {shell.mode === 'training' ? (
                  <>
                    <button
                      id="coach-stop"
                      type="button"
                      className="ghost"
                      onClick={() =>
                        chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
                          type: coachContext?.training?.held ? 'training-resume' : 'training-stop',
                        })
                      }
                    >
                      {coachContext?.training?.held ? copy.resume : copy.stop}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'training-undo' })}
                    >
                      {copy.undoMove}
                    </button>
                    <button
                      type="button"
                      className="ghost span-2"
                      onClick={() =>
                        chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
                          type: 'training-clock',
                          on: coachContext?.training?.clock !== true,
                        })
                      }
                    >
                      {coachContext?.training?.clock === true ? copy.clockOff : copy.clockOn}
                    </button>
                    <label className="field span-2" htmlFor="coach-horizon">
                      {copy.horizon} {horizon}
                      <input
                        id="coach-horizon"
                        type="range"
                        min={1}
                        max={5}
                        value={horizon}
                        onChange={(event) => setHorizon(Number(event.target.value))}
                      />
                    </label>
                    <button type="button" className="ghost" onClick={() => askCoach('mistake')}>
                      {copy.mistake}
                    </button>
                    <button type="button" className="ghost" onClick={() => askCoach('strategy')}>
                      {copy.strategy}
                    </button>
                  </>
                ) : null}
                <button type="button" className="ghost" onClick={() => askCoach('explain')}>
                  {copy.explain}
                </button>
                <button type="button" className="ghost" onClick={() => askCoach('hint')}>
                  {copy.hint}
                </button>
                <label className="field span-2" htmlFor="coach-ask">
                  {copy.ask}
                  <textarea
                    id="coach-ask"
                    rows={1}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                </label>
                <button type="button" className="primary span-2" onClick={() => askCoach('ask')}>
                  {copy.send}
                </button>
                <button type="button" className="ghost" onClick={() => dispatch({ type: 'coach-settings' })}>
                  {copy.openSettings}
                </button>
                <button type="button" className="ghost" data-primary onClick={() => dispatch({ type: 'close-assistant' })}>
                  {copy.close}
                </button>
              </div>
            </aside>
          ) : null}
        </>
      ) : null}

      {showEnd && end ? (
        <div className="overlay">
          <section
            className={`panel fin-card is-${end.kind === 'won' ? 'won' : end.kind === 'lost' ? 'lost' : 'draw'}`}
            aria-labelledby="fin-title"
          >
            <img className="fin-crest" src="/brand/w3dts-chessmaster-logo.png" alt="" />
            <h1 id="fin-title">{endTitle(copy, end.kind)}</h1>
            <p>{endSentence(copy, end)}</p>
            <button type="button" className="primary" id="fin-see" data-primary onClick={() => setHideEnd(true)}>
              {copy.seeBoard}
            </button>
            <button type="button" className="ghost" onClick={replayMatch}>
              {copy.replay}
            </button>
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'modes' })}>
              {copy.changeMode}
            </button>
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'accueil' })}>
              {copy.home}
            </button>
          </section>
        </div>
      ) : null}

      {shell.screen === 'pause' && !end ? (
        <div className="overlay">
        <section className="panel">
          <h1>{copy.pause}</h1>
          <button type="button" className="primary" data-primary onClick={() => dispatch({ type: 'resume' })}>
            {copy.resume}
          </button>
          <button type="button" className="ghost" onClick={saveGame}>
            {copy.save}
          </button>
          {savedFlash ? <p className="notice">{copy.saved}</p> : null}
          {play?.drawOffer === 'refused' ? <p className="notice">{copy.drawRefused}</p> : null}
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'sauvegardes' })}>
            {copy.saves}
          </button>
          {shell.mode !== 'learn' ? (
            <>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'resign' });
                  dispatch({ type: 'resume' });
                }}
              >
                {copy.resign}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'offer-draw' });
                  if (shell.mode === 'hotseat') {
                    dispatch({ type: 'go', screen: 'nulle-offre' });
                  }
                }}
              >
                {copy.offerDraw}
              </button>
            </>
          ) : null}
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'modes' })}>
            {copy.changeMode}
          </button>
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'options' })}>
            {copy.options}
          </button>
          {shell.mode === 'online' && play?.p2pStatus && play.p2pStatus !== 'disconnected' ? (
            <button type="button" className="danger" onClick={() => dispatch({ type: 'leave-table' })}>
              {copy.leave}
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'accueil' })}>
            {copy.home}
          </button>
        </section>
        </div>
      ) : null}

      {shell.screen === 'nulle-offre' && !end ? (
        <div className="overlay">
          <section className="panel">
            <h1>{copy.drawOfferTitle}</h1>
            <p className="hint">{copy.drawOfferPeer}</p>
            <button
              type="button"
              className="primary"
              data-primary
              onClick={() => {
                chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'accept-draw' });
                dispatch({ type: 'resume' });
              }}
            >
              {copy.acceptDraw}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'refuse-draw' });
                dispatch({ type: 'resume' });
              }}
            >
              {copy.refuseDraw}
            </button>
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'go', screen: 'pause' })}>
              {copy.cancel}
            </button>
          </section>
        </div>
      ) : null}

      {shell.screen === 'sauvegardes' ? (
        <section className="panel sheet">
          <header className="sheet-head">
            <div>
              <h1>{copy.saves}</h1>
              <p className="hint">{copy.savesHint}</p>
            </div>
            <button type="button" className="ghost" data-primary onClick={() => dispatch({ type: 'escape' })}>
              {copy.close}
            </button>
          </header>
          <SheetBody>
          {cabinet.interrupt ? (
            <section className="sheet-section">
              <h2>{copy.interrupted}</h2>
              <div className="save-row">
                <p>{saveLine(copy, cabinet.interrupt, prefs.language)}</p>
                <button type="button" className="primary" onClick={() => openSaved(cabinet.interrupt!)}>
                  {copy.restore}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'discard-interrupt' })}
                >
                  {copy.discard}
                </button>
              </div>
            </section>
          ) : null}
          {cabinet.voluntary.length > 0 ? (
            <section className="sheet-section">
              <h2>{copy.requested}</h2>
              {cabinet.voluntary.map((game) => (
                <div className="save-row" key={game.id}>
                  <p>{saveLine(copy, game, prefs.language)}</p>
                  <button type="button" className="primary" onClick={() => openSaved(game)}>
                    {copy.restore}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'delete-voluntary', id: game.id })
                    }
                  >
                    {copy.remove}
                  </button>
                </div>
              ))}
            </section>
          ) : null}
          {!cabinet.interrupt && cabinet.voluntary.length === 0 ? <p className="hint">{copy.noSaves}</p> : null}
          </SheetBody>
        </section>
      ) : null}

      {shell.screen === 'propos' ? (
        <AboutSheet
          copy={copy}
          version={appVersion}
          note={bundledReleaseNote(appVersion)}
          onClose={() => dispatch({ type: 'escape' })}
        />
      ) : null}

      {shell.screen === 'options' ? (
        <OptionsSheet
          copy={copy}
          graphics={graphics}
          ambiance={ambiance}
          fps={fps}
          surface={surface}
          onClose={() => dispatch({ type: 'escape' })}
        />
      ) : null}

      {shell.screen === 'parametres' ? (
        <section className="panel sheet">
          <header className="sheet-head">
            <div>
              <h1>{copy.settings}</h1>
              <p className="hint">{copy.settingsHint}</p>
            </div>
            <button type="button" className="ghost" data-primary onClick={() => dispatch({ type: 'escape' })}>
              {copy.close}
            </button>
          </header>
          <SheetBody>
          <section className="sheet-section">
            <h2>{copy.sound}</h2>
            <label className="field" htmlFor="vol-sfx">
              {copy.sfx} {Math.round(prefs.sfx)}
            </label>
            <ScaleRange
              id="vol-sfx"
              min={0}
              max={100}
              value={prefs.sfx}
              float
              onChange={(sfx) => setPrefs({ ...prefs, sfx })}
            />
            <label className="field" htmlFor="vol-amb">
              {copy.ambience} {Math.round(prefs.ambience)}
            </label>
            <ScaleRange
              id="vol-amb"
              min={0}
              max={100}
              value={prefs.ambience}
              float
              onChange={(ambience) => setPrefs({ ...prefs, ambience })}
            />
          </section>
          <section className="sheet-section">
            <h2>{copy.language}</h2>
            <Choice
              options={SHELL_LANGUAGES.map((id) => ({ id, label: SHELL_LANGUAGE_LABELS[id] }))}
              selected={prefs.language}
              onSelect={(id) => {
                if (isShellLanguage(id)) setPrefs({ ...prefs, language: id });
              }}
            />
          </section>
          <section className="sheet-section">
            <h2>{copy.controls}</h2>
            <ul className="controls">
              <li>
                <kbd>LMB</kbd> {copy.grabLine}
              </li>
              <li>
                <kbd>RMB</kbd> {copy.orbitLine}
              </li>
              <li>
                <kbd>X</kbd> {copy.resetLine}
              </li>
              <li>
                <kbd>{copy.escapeKey}</kbd> {copy.escapeLine}
              </li>
            </ul>
          </section>
          <section className="sheet-section">
            <h2>{copy.assistant}</h2>
            {window.chessMaster?.coachSettings ? (
              <>
                {coachStatus === 'checking' ? <p className="hint">{copy.coachChecking}</p> : null}
                {coachStatus === 'ready' ? (
                  <>
                    <p className="banner">{copy.coachReady}</p>
                    {coachModels.length === 0 ? <p className="hint">{copy.coachNoModels}</p> : null}
                    {coachModels.length > 1 ? (
                      <>
                        <label className="field" htmlFor="coach-model">
                          {copy.coachModel}
                        </label>
                        <select
                          id="coach-model"
                          value={coachModel}
                          onChange={(event) => chooseLocalModel(event.target.value)}
                        >
                          {coachModels.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : coachModel ? (
                      <p className="hint">
                        {copy.coachModel} · {coachModel}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {coachStatus === 'installed' ? (
                  <>
                    <p className="banner">{copy.coachInstalled}</p>
                    <button type="button" className="primary" onClick={launchOllama}>
                      {copy.coachStart}
                    </button>
                  </>
                ) : null}
                {coachStatus === 'missing' ? (
                  <>
                    <p className="banner">{copy.coachMissing}</p>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => void window.chessMaster?.coachOpenDownload()}
                    >
                      {copy.coachInstall}
                    </button>
                  </>
                ) : null}
                <button type="button" className="ghost" onClick={() => setCoachRemote((open) => !open)}>
                  {copy.coachOther}
                </button>
                {coachRemote ? (
                  <>
                    <label className="field" htmlFor="coach-base">
                      {copy.coachBase}
                    </label>
                    <input
                      id="coach-base"
                      type="url"
                      value={coachBase}
                      onChange={(event) => setCoachBase(event.target.value)}
                    />
                    <label className="field" htmlFor="coach-remote-model">
                      {copy.coachModel}
                    </label>
                    <input
                      id="coach-remote-model"
                      type="text"
                      value={coachModel}
                      onChange={(event) => setCoachModel(event.target.value)}
                    />
                    <label className="field" htmlFor="coach-key">
                      {copy.coachKey}
                    </label>
                    <input
                      id="coach-key"
                      type="password"
                      value={coachKey}
                      autoComplete="off"
                      onChange={(event) => setCoachKey(event.target.value)}
                    />
                    <button type="button" className="primary" onClick={saveCoachLink}>
                      {copy.coachSave}
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <p className="notice">{copy.noModel}</p>
            )}
          </section>
          </SheetBody>
        </section>
      ) : null}

      {shell.screen === 'classements' ? (
        <section className="panel wide">
          <h1>{copy.ranks}</h1>
          <p className="hint">{copy.exampleRanks}</p>
          <Choice
            options={[
              { id: 'local', label: copy.localTab },
              { id: 'online', label: copy.onlineTab },
            ]}
            selected={rankTab}
            onSelect={(id) => setRankTab(id === 'online' ? 'online' : 'local')}
          />
          <dl className="stats">
            {(
              [
                [copy.wins, rankTab === 'local' ? 12 : 4],
                [copy.losses, rankTab === 'local' ? 7 : 2],
                [copy.draws, rankTab === 'local' ? 3 : 1],
                [copy.streak, rankTab === 'local' ? 2 : 1],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <ol className="games">
            {(rankTab === 'local' ? copy.localGames : copy.onlineGames).map((game, index) => (
              <li key={`${rankTab}-${index}`}>
                {game} · {copy.example}
              </li>
            ))}
          </ol>
          <button type="button" className="primary" data-primary onClick={() => dispatch({ type: 'escape' })}>
            {copy.close}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function ScaleRange({
  id,
  min,
  max,
  value,
  float: isFloat = false,
  onChange,
}: {
  id?: string;
  min: number;
  max: number;
  value: number;
  /** Continuous slider. An integer scale shows one jalon per step. */
  float?: boolean;
  onChange: (value: number) => void;
}): ReactElement {
  const steps = isFloat ? [] : Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const [caught, setCaught] = useState<number | null>(null);
  const previous = useRef(value);
  useEffect(() => {
    if (isFloat || previous.current === value) return;
    previous.current = value;
    setCaught(value);
  }, [isFloat, value]);
  const at = rangeThumbRatio(value, min, max);
  return (
    <div
      className={isFloat ? 'scale is-float' : 'scale'}
      onPointerDown={(event) => event.currentTarget.classList.remove('is-dragging')}
      onPointerMove={(event) => {
        if (!isFloat || event.buttons === 0) return;
        event.currentTarget.classList.add('is-dragging');
      }}
      onPointerUp={(event) => event.currentTarget.classList.remove('is-dragging')}
      onPointerCancel={(event) => event.currentTarget.classList.remove('is-dragging')}
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={isFloat ? 'any' : 1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="scale-thumb" style={{ '--at': String(at) } as CSSProperties} aria-hidden="true" />
      {isFloat ? null : (
        <div className="scale-marks" style={{ '--last': String(max - min) } as CSSProperties}>
          {steps.map((step) => (
            <button
              key={step}
              type="button"
              className={
                step === value
                  ? step === caught
                    ? 'scale-mark is-on is-catch'
                    : 'scale-mark is-on'
                  : 'scale-mark'
              }
              style={{ '--i': String(step - min) } as CSSProperties}
              onClick={() => onChange(step)}
            >
              {step}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SheetBody({ children }: { children: ReactNode }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = (): void => {
      setOverflow(sheetBodyOverflows(node.scrollHeight, node.clientHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children]);
  return (
    <div ref={ref} className={overflow ? 'sheet-body is-overflow' : 'sheet-body'}>
      {children}
    </div>
  );
}

function AboutSheet({
  copy,
  version,
  note,
  onClose,
}: {
  copy: ShellCopy;
  version: string;
  note: string;
  onClose: () => void;
}): ReactElement {
  return (
    <section className="panel sheet">
      <header className="sheet-head">
        <div>
          <h1>{copy.about}</h1>
        </div>
        <button type="button" className="ghost" data-primary onClick={onClose}>
          {copy.close}
        </button>
      </header>
      <SheetBody>
      <section className="sheet-section">
        <h2>{copy.aboutVersion}</h2>
        <p className="about-version">{version}</p>
      </section>
      <section className="sheet-section">
        <h2>{copy.aboutNote}</h2>
        <p className="about-note">{note || copy.aboutNoteMissing}</p>
      </section>
      <section className="sheet-section">
        <h2>{copy.aboutCredits}</h2>
        <p>{copy.aboutCopyright}</p>
        <p>{copy.aboutProprietary}</p>
      </section>
      </SheetBody>
    </section>
  );
}

function SetChoice({
  copy,
  selected,
  onSelect,
}: {
  copy: ShellCopy;
  selected: ChessAmbianceId;
  onSelect: (id: ChessAmbianceId) => void;
}): ReactElement {
  return (
    <div className="choice set-choice">
      {CHESS_AMBIANCES.map((id) => (
        <button
          key={id}
          type="button"
          className={id === selected ? 'is-selected' : ''}
          onClick={() => onSelect(id)}
        >
          <img src={chessSetLook(id).thumb} alt="" />
          <span>{copy.sets[id]}</span>
        </button>
      ))}
    </div>
  );
}

function OptionsSheet({
  copy,
  graphics,
  ambiance,
  fps,
  surface,
  onClose,
}: {
  copy: ShellCopy;
  graphics: ChessGraphicsSettings;
  ambiance: ChessAmbianceId;
  fps: number;
  surface: { width: number; height: number };
  onClose: () => void;
}): ReactElement {
  const preset = matchingGraphicsPreset(graphics) ?? '';
  const patch = (partial: Partial<ChessGraphicsSettings>): void => {
    setChessGraphicsSettings({ ...graphics, ...partial });
  };
  return (
    <section className="panel sheet">
      <header className="sheet-head">
        <div>
          <h1>{copy.options}</h1>
          <p className="hint">{copy.optionsHint}</p>
        </div>
        <button type="button" className="ghost" data-primary onClick={onClose}>
          {copy.close}
        </button>
      </header>
      <SheetBody>
      <section className="sheet-section">
      <h2>{copy.setChoice}</h2>
        <SetChoice copy={copy} selected={ambiance} onSelect={setChessAmbiance} />
      </section>
      <section className="sheet-section">
      <h2>{copy.preset}</h2>
      <Choice
        options={GRAPHICS_PRESETS.map((item) => ({ id: item.id, label: presetTitle(copy, item.id) }))}
        selected={preset}
        onSelect={(id) => {
          const found = GRAPHICS_PRESETS.find((item) => item.id === id);
          if (found) setChessGraphicsSettings(found.settings);
        }}
      />
      </section>
      <section className="sheet-section">
      <h2>{copy.image}</h2>
      <p className="field">{copy.resolution}</p>
      <Choice
        options={RESOLUTION_OPTIONS.map((item) => ({
          id: item.id,
          label: item.id === 'native' ? copy.resolutionNative : item.label,
        }))}
        selected={graphics.resolution}
        onSelect={(id) => patch({ resolution: id as ChessResolution })}
      />
      <p className="field">{copy.upscale}</p>
      <Choice
        options={[
          { id: 'off', label: copy.upscaleOff },
          { id: 'quality', label: copy.upscaleQuality },
          { id: 'performance', label: copy.upscalePerformance },
        ]}
        selected={graphics.upscale}
        onSelect={(id) => patch({ upscale: id as ChessUpscale })}
      />
      <p className="field">{copy.textures}</p>
      <Choice
        options={TEXTURE_QUALITY_OPTIONS.map((item) => ({
          id: item.id,
          label: copy.textureQuality[item.id],
        }))}
        selected={graphics.textureQuality}
        onSelect={(id) => patch({ textureQuality: id as ChessTextureQuality })}
      />
      </section>
      <section className="sheet-section">
      <h2>{copy.effects}</h2>
      <p className="field">{copy.shadows}</p>
      <Choice
        options={[
          { id: 'off', label: copy.shadowOff },
          { id: 'hard', label: copy.shadowHard },
          { id: 'soft', label: copy.shadowSoft },
        ]}
        selected={graphics.shadowMode}
        onSelect={(id) => {
          const shadowMode = id as ChessShadowMode;
          patch({ shadowMode, shadows: shadowMode !== 'off' });
        }}
      />
      <div className="toggle-grid">
        <label className="check">
          <span>{copy.ao}</span>
          <input
            type="checkbox"
            checked={graphics.ambientOcclusion}
            onChange={(event) => patch({ ambientOcclusion: event.target.checked })}
          />
        </label>
        <label className="check">
          <span>{copy.reflections}</span>
          <input
            type="checkbox"
            checked={graphics.reflections}
            onChange={(event) => patch({ reflections: event.target.checked })}
          />
        </label>
        <label className="check">
          <span>{copy.bloom}</span>
          <input
            type="checkbox"
            checked={graphics.bloom}
            onChange={(event) => patch({ bloom: event.target.checked })}
          />
        </label>
      </div>
      </section>
      <p className="status-line">
        {copy.render} {surface.width}×{surface.height} · {fps} {copy.fps}
      </p>
      </SheetBody>
    </section>
  );
}


function openingName(copy: ShellCopy, eco: string): string {
  if (
    eco === 'C50' ||
    eco === 'C60' ||
    eco === 'C44' ||
    eco === 'B20' ||
    eco === 'C00' ||
    eco === 'B10' ||
    eco === 'D06' ||
    eco === 'E60'
  ) {
    return copy.openings[eco];
  }
  return eco;
}

function presetTitle(copy: ShellCopy, id: string): string {
  if (id === 'fluide' || id === 'equilibre' || id === 'qualite' || id === 'natif') {
    return copy.presets[id];
  }
  return id;
}
