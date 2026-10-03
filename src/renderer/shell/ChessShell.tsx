/**
 * @file ChessShell.tsx
 * @description Welcome, modes, lobby, pause, options and settings over the chess table.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import {
  CHESS_HUD_COMMAND_EVENT,
  CHESS_HUD_STATE_EVENT,
  ECO_OPENINGS,
  formatChessClock,
  parseChessHudState,
  type ChessColor,
  type ChessHudState,
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
  type ChessTextureQuality,
} from '../graphics/chessGraphicsSettings';
import { setChessAudioLevels } from '../host/chessTableAudio';
import {
  acceptJoinCode,
  bootCrestFill,
  bootCrestInset,
  defaultShellPrefs,
  initialShell,
  parseShellPrefs,
  rangeThumbRatio,
  reduceShell,
  shellBlocksPlay,
  shellSession,
  type ShellAction,
  type ShellMode,
  type ShellPrefs,
  type ShellState,
} from './shellScreen';
import './shell.css';

const PREFS_KEY = 'w3dts-chess-shell';

const MODES: { id: ShellMode; title: string; blurb: string }[] = [
  { id: 'cpu', title: 'Contre l’ordinateur', blurb: 'Une partie contre l’heuristique.' },
  { id: 'hotseat', title: 'À deux, même écran', blurb: 'On se passe la souris.' },
  { id: 'local', title: 'Sur cet ordinateur', blurb: 'Une seconde fenêtre de cette application.' },
  { id: 'online', title: 'En ligne', blurb: 'Créer ou rejoindre une table.' },
  { id: 'learn', title: 'Apprendre', blurb: 'Une courte ligne ECO.' },
];

const OPENING_FR: Record<string, string> = {
  C50: 'Partie italienne',
  C60: 'Espagnole',
  C44: 'Écossaise',
  B20: 'Sicilienne',
  C00: 'Française',
  B10: 'Caro-Kann',
  D06: 'Gambit de la dame',
  E60: 'Indienne du roi',
};

const P2P_FR: Record<string, string> = {
  waiting: 'En attente',
  connecting: 'Connexion',
  connected: 'Connecté',
  disconnected: 'Déconnecté',
};

function loadPrefs(): ShellPrefs {
  try {
    return parseShellPrefs(globalThis.localStorage?.getItem(PREFS_KEY) ?? null);
  } catch {
    return defaultShellPrefs();
  }
}

function savePrefs(prefs: ShellPrefs): void {
  try {
    globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
  setChessAudioLevels(prefs.sfx, prefs.ambience);
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
  }, [selected]);
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

export default function ChessShell({ studioReady }: { studioReady: boolean }): ReactElement {
  const peer = new URLSearchParams(window.location.search).get('chessPeer') === '1';
  const [bootGone, setBootGone] = useState(false);
  const [shell, setShell] = useState<ShellState>(() => initialShell(peer));
  const [prefs, setPrefs] = useState<ShellPrefs>(loadPrefs);
  const [hud, setHud] = useState<ChessHudState | null>(null);
  const [color, setColor] = useState<ChessColor>('white');
  const [hostColor, setHostColor] = useState<ChessColor>('white');
  const [level, setLevel] = useState(2);
  const [eco, setEco] = useState(ECO_OPENINGS[0]?.eco ?? 'C50');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [graphics, setGraphics] = useState<ChessGraphicsSettings>(getChessGraphicsSettings);
  const [fps, setFps] = useState(0);
  const [surface, setSurface] = useState({ width: 0, height: 0 });
  const [question, setQuestion] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [rankTab, setRankTab] = useState<'local' | 'online'>('local');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => subscribeChessGraphics(setGraphics), []);

  useEffect(() => {
    const onHud = (raw: unknown): void => {
      const parsed = parseChessHudState(raw);
      if (parsed) setHud(parsed);
    };
    chessBus.on(CHESS_HUD_STATE_EVENT, onHud);
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, { type: 'request-state' });
    return () => {
      chessBus.off(CHESS_HUD_STATE_EVENT, onHud);
    };
  }, []);

  useEffect(() => {
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
      type: 'mode-picker',
      open: !bootGone || shellBlocksPlay(shell),
    });
  }, [shell.screen, bootGone]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !bootGone) return;
      setShell((prev) => reduceShell(prev, { type: 'escape' }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bootGone]);

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

  const dispatch = (action: ShellAction): void => {
    const next = reduceShell(shell, action);
    setShell(next);
    const starts =
      (action.type === 'start' && next.screen === 'partie') ||
      action.type === 'create-table' ||
      action.type === 'join-table';
    if (!starts) return;
    const side =
      action.type === 'join-table'
        ? hostColor === 'white'
          ? 'black'
          : 'white'
        : next.mode === 'online' || next.mode === 'local'
          ? next.mode === 'online'
            ? hostColor
            : color
          : color;
    chessBus.emit(CHESS_HUD_COMMAND_EVENT, {
      type: 'apply-session',
      session: shellSession(next.mode, side, eco, level),
    });
  };

  const copy = prefs.language === 'en' ? EN : FR;
  const menu = shell.screen !== 'partie';
  const play = hud?.kind === 'play' ? hud : null;
  const turn =
    play?.sideToMove === 'black' ? copy.blackTurn : copy.whiteTurn;
  const clock = play
    ? formatChessClock(
        play.sideToMove === 'black' ? play.clocks.blackSeconds : play.clocks.whiteSeconds
      )
    : '10:00';
  const modeTitle =
    shell.mode === 'learn'
      ? `${copy.learn} · ${OPENING_FR[eco] ?? eco}`
      : (MODES.find((mode) => mode.id === shell.mode)?.title ?? '');

  return (
    <div ref={root} className={menu ? 'shell is-menu' : 'shell'} data-screen={shell.screen}>
      <BootCover studioReady={studioReady} onGone={() => setBootGone(true)} />
      {shell.screen === 'accueil' ? (
        <section className="panel">
          <img className="crest" src="/brand/w3dts-chessmaster-logo.png" alt="" />
          <h1>W3DTS ChessMaster</h1>
          <button type="button" className="primary" data-primary onClick={() => dispatch({ type: 'play' })}>
            {copy.play}
          </button>
          <nav className="text-links">
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'classements' })}>
              {copy.ranks}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'options' })}>
              {copy.options}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'go', screen: 'parametres' })}>
              {copy.settings}
            </button>
          </nav>
        </section>
      ) : null}

      {shell.screen === 'modes' ? (
        <section className="panel wide">
          <h1>{copy.modes}</h1>
          <div className="cards">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={shell.mode === mode.id ? 'is-selected' : ''}
                onClick={() => dispatch({ type: 'set-mode', mode: mode.id })}
              >
                <strong>{mode.title}</strong>
                <span>{mode.blurb}</span>
              </button>
            ))}
          </div>
          {shell.mode === 'cpu' ? (
            <>
              <h2>{copy.color}</h2>
              <Choice
                options={[
                  { id: 'white', label: copy.white },
                  { id: 'black', label: copy.black },
                ]}
                selected={color}
                onSelect={(id) => setColor(id === 'black' ? 'black' : 'white')}
              />
              <p className="field">
                {copy.level} {level}
              </p>
              <ScaleRange min={1} max={5} value={level} onChange={setLevel} />
            </>
          ) : null}
          {shell.mode === 'learn' ? (
            <>
              <h2>{copy.line}</h2>
              <Choice
                options={ECO_OPENINGS.map((opening) => ({
                  id: opening.eco,
                  label: `${opening.eco} ${OPENING_FR[opening.eco] ?? opening.name}`,
                }))}
                selected={eco}
                onSelect={setEco}
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
                onSelect={(id) => setHostColor(id === 'black' ? 'black' : 'white')}
              />
              <p className="hint">{copy.colorHint}</p>
              <p className="code">{code || '—'}</p>
              <button
                type="button"
                className="primary"
                data-primary
                onClick={() => {
                  setCode(makeCode());
                  dispatch({ type: 'create-table' });
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
                onClick={() =>
                  dispatch(acceptJoinCode(joinCode) ? { type: 'join-table' } : { type: 'reject-code' })
                }
              >
                {copy.join}
              </button>
              {shell.notice === 'refused' ? <p className="notice">{copy.refused}</p> : null}
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
              <p>{play?.cpuThinking ? copy.thinking : turn}</p>
              <p className="hint">{modeTitle}</p>
            </div>
            <p className="clock">{clock}</p>
            {play?.p2pStatus ? (
              <p className="hint">
                {P2P_FR[play.p2pStatus] ?? play.p2pStatus}
                {code ? ` · ${code}` : ''}
              </p>
            ) : null}
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'open-assistant' })}>
              {copy.assistant}
            </button>
            <button
              type="button"
              className="primary"
              {...(shell.screen === 'partie' ? { 'data-primary': true } : {})}
              onClick={() => dispatch({ type: shell.screen === 'pause' ? 'resume' : 'escape' })}
            >
              {shell.screen === 'pause' ? copy.resume : copy.pause}
            </button>
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
          {shell.screen === 'partie' && shell.assistant ? (
            <aside className="drawer">
              <h2>{copy.assistant}</h2>
              <p className="banner">{copy.coachBanner}</p>
              <p className="notice">{coachNote || copy.noModel}</p>
              <button type="button" className="ghost" onClick={() => setCoachNote(copy.noModel)}>
                {copy.explain}
              </button>
              <button type="button" className="ghost" onClick={() => setCoachNote(copy.noModel)}>
                {copy.hint}
              </button>
              <label className="field" htmlFor="coach-ask">
                {copy.ask}
              </label>
              <textarea
                id="coach-ask"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <button type="button" className="primary" onClick={() => setCoachNote(copy.noModel)}>
                {copy.send}
              </button>
              <button type="button" className="ghost" onClick={() => dispatch({ type: 'coach-settings' })}>
                {copy.openSettings}
              </button>
              <button
                type="button"
                className="ghost"
                data-primary
                onClick={() => dispatch({ type: 'close-assistant' })}
              >
                {copy.close}
              </button>
            </aside>
          ) : null}
        </>
      ) : null}

      {shell.screen === 'pause' ? (
        <div className="overlay">
        <section className="panel">
          <h1>{copy.pause}</h1>
          <button type="button" className="primary" data-primary onClick={() => dispatch({ type: 'resume' })}>
            {copy.resume}
          </button>
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

      {shell.screen === 'options' ? (
        <OptionsSheet
          copy={copy}
          graphics={graphics}
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
              options={[
                { id: 'fr', label: 'Français' },
                { id: 'en', label: 'Anglais' },
              ]}
              selected={prefs.language}
              onSelect={(id) => setPrefs({ ...prefs, language: id === 'en' ? 'en' : 'fr' })}
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
                <kbd>Échap</kbd> {copy.escapeLine}
              </li>
            </ul>
          </section>
          <section className="sheet-section">
            <h2>{copy.assistant}</h2>
            <p className="notice">{copy.noModel}</p>
          </section>
        </section>
      ) : null}

      {shell.screen === 'classements' ? (
        <section className="panel wide">
          <h1>{copy.ranks}</h1>
          <p className="hint">{copy.exampleRanks}</p>
          <Choice
            options={[
              { id: 'local', label: 'Local' },
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

function OptionsSheet({
  copy,
  graphics,
  fps,
  surface,
  onClose,
}: {
  copy: typeof FR;
  graphics: ChessGraphicsSettings;
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
      <section className="sheet-section">
      <h2>{copy.preset}</h2>
      <Choice
        options={GRAPHICS_PRESETS.map((item) => ({ id: item.id, label: item.title }))}
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
        options={RESOLUTION_OPTIONS.map((item) => ({ id: item.id, label: item.label }))}
        selected={graphics.resolution}
        onSelect={(id) => patch({ resolution: id as ChessResolution })}
      />
      <p className="field">{copy.textures}</p>
      <Choice
        options={TEXTURE_QUALITY_OPTIONS.map((item) => ({ id: item.id, label: item.label }))}
        selected={graphics.textureQuality}
        onSelect={(id) => patch({ textureQuality: id as ChessTextureQuality })}
      />
      </section>
      <section className="sheet-section">
      <h2>{copy.effects}</h2>
      <div className="toggle-grid">
        <label className="check">
          <span>{copy.shadows}</span>
          <input
            type="checkbox"
            checked={graphics.shadows}
            onChange={(event) => patch({ shadows: event.target.checked })}
          />
        </label>
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
    </section>
  );
}

const FR = {
  play: 'Jouer',
  ranks: 'Classements',
  options: 'Options',
  settings: 'Paramètres',
  settingsHint: 'Son, langue, contrôles et branchement de l’assistant.',
  modes: 'Modes',
  color: 'Couleur',
  white: 'Blancs',
  black: 'Noirs',
  level: 'Niveau',
  line: 'Ligne',
  begin: 'Commencer',
  openLobby: 'Ouvrir le salon',
  back: 'Retour',
  backModes: 'Retour aux modes',
  lobby: 'Salon en ligne',
  colorHint: 'La couleur se choisit ici. L’invité prend l’autre.',
  create: 'Créer une table',
  join: 'Rejoindre',
  copy: 'Copier',
  refused: 'Code refusé',
  whiteTurn: 'Les blancs jouent',
  blackTurn: 'Les noirs jouent',
  thinking: 'L’ordinateur réfléchit…',
  learn: 'Apprendre',
  assistant: 'Assistant',
  pause: 'Pause',
  grab: 'saisir',
  orbit: 'orbiter',
  reset: 'recommencer',
  coachBanner: 'Commentaire, pas un coup. L’assistant ne joue pas.',
  noModel: 'Aucun modèle n’est branché.',
  explain: 'Expliquer la position',
  hint: 'Indice',
  ask: 'Question libre',
  send: 'Envoyer',
  openSettings: 'Ouvrir les paramètres',
  close: 'Fermer',
  resume: 'Reprendre',
  changeMode: 'Changer de mode',
  leave: 'Quitter la table',
  home: 'Retour à l’accueil',
  sound: 'Son',
  sfx: 'Volume des coups',
  ambience: 'Volume d’ambiance',
  language: 'Langue',
  controls: 'Contrôles',
  grabLine: 'Saisir une pièce et la poser.',
  orbitLine: 'Tourner autour du plateau, molette comprise.',
  resetLine: 'Recommencer la partie ou la ligne.',
  escapeLine: 'Pause, ou fermer le panneau ouvert.',
  example: 'exemple',
  wins: 'Victoires',
  losses: 'Défaites',
  draws: 'Nuls',
  streak: 'Série',
  localGames: [
    'Victoire · ordinateur',
    'Défaite · même écran',
    'Nulle · en ligne',
    'Victoire · ouverture',
    'Victoire · ordinateur',
  ],
  onlineGames: [
    'Victoire · table K7QM',
    'Défaite · table M2LP',
    'Nulle · table Q9AD',
    'Victoire · table H4CE',
    'Défaite · table B8NR',
  ],
  exampleRanks: 'Exemple — aucun serveur de scores.',
  onlineTab: 'En ligne',
  optionsHint: 'Le rendu s’applique tout de suite. Le son et l’assistant sont dans Paramètres.',
  preset: 'Préréglage',
  image: 'Image',
  resolution: 'Résolution',
  textures: 'Textures des pièces',
  effects: 'Effets',
  shadows: 'Ombres',
  ao: 'Occlusion ambiante',
  reflections: 'Reflets du plateau',
  bloom: 'Bloom',
  render: 'Rendu',
  fps: 'img/s',
};

const EN: typeof FR = {
  ...FR,
  play: 'Play',
  ranks: 'Rankings',
  options: 'Options',
  settings: 'Settings',
  settingsHint: 'Sound, language, controls and how the assistant connects.',
  modes: 'Modes',
  color: 'Color',
  white: 'White',
  black: 'Black',
  level: 'Level',
  line: 'Line',
  begin: 'Start',
  openLobby: 'Open the lobby',
  back: 'Back',
  backModes: 'Back to modes',
  lobby: 'Online lobby',
  colorHint: 'Color is chosen here. The guest takes the other one.',
  create: 'Create a table',
  join: 'Join',
  copy: 'Copy',
  refused: 'Code refused',
  whiteTurn: 'White to move',
  blackTurn: 'Black to move',
  thinking: 'The computer is thinking…',
  assistant: 'Assistant',
  pause: 'Pause',
  grab: 'grab',
  orbit: 'orbit',
  reset: 'restart',
  coachBanner: 'A comment, not a move. The assistant does not play.',
  noModel: 'No model is connected.',
  explain: 'Explain the position',
  hint: 'Hint',
  ask: 'Free question',
  send: 'Send',
  openSettings: 'Open settings',
  close: 'Close',
  resume: 'Resume',
  changeMode: 'Change mode',
  leave: 'Leave the table',
  home: 'Back home',
  sound: 'Sound',
  sfx: 'Move volume',
  ambience: 'Ambience',
  language: 'Language',
  controls: 'Controls',
  grabLine: 'Grab a piece and set it down.',
  orbitLine: 'Orbit the board, including the wheel.',
  resetLine: 'Restart the game or the line.',
  escapeLine: 'Pause, or close the open panel.',
  wins: 'Wins',
  losses: 'Losses',
  draws: 'Draws',
  streak: 'Streak',
  localGames: [
    'Win · computer',
    'Loss · same screen',
    'Draw · online',
    'Win · opening',
    'Win · computer',
  ],
  onlineGames: [
    'Win · table K7QM',
    'Loss · table M2LP',
    'Draw · table Q9AD',
    'Win · table H4CE',
    'Loss · table B8NR',
  ],
  exampleRanks: 'Example — no score server.',
  onlineTab: 'Online',
  optionsHint: 'The picture updates at once. Sound and the assistant are in Settings.',
  preset: 'Preset',
  image: 'Picture',
  resolution: 'Resolution',
  textures: 'Piece textures',
  effects: 'Effects',
  shadows: 'Shadows',
  ao: 'Ambient occlusion',
  reflections: 'Board reflections',
  bloom: 'Bloom',
  render: 'Render',
  fps: 'fps',
};
