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
import { bundledReleaseNote } from './bundledReleaseNotes';
import {
  isShellLanguage,
  publishShellLanguage,
  SHELL_LANGUAGE_LABELS,
  SHELL_LANGUAGES,
  shellCopy,
  type ShellCopy,
} from './copy/shellCopy';
import {
  acceptJoinCode,
  bootCrestFill,
  bootCrestInset,
  defaultShellPrefs,
  initialShell,
  parseShellPrefs,
  rangeThumbRatio,
  reduceShell,
  SHELL_PREFS_KEY,
  shellBlocksPlay,
  shellSession,
  type ShellAction,
  type ShellMode,
  type ShellPrefs,
  type ShellState,
} from './shellScreen';
import './shell.css';

const MODE_IDS = ['cpu', 'hotseat', 'local', 'online', 'learn'] as const satisfies readonly ShellMode[];

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
  const [appVersion, setAppVersion] = useState('');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

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

  const copy = shellCopy(prefs.language);
  const menu = shell.screen !== 'partie';
  const play = hud?.kind === 'play' ? hud : null;
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
                options={ECO_OPENINGS.map((item) => ({
                  id: item.eco,
                  label: `${item.eco} ${openingName(copy, item.eco)}`,
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
                {copy.p2p[play.p2pStatus]}
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
    </section>
  );
}

function OptionsSheet({
  copy,
  graphics,
  fps,
  surface,
  onClose,
}: {
  copy: ShellCopy;
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
