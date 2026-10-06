/**
 * @file shellScreen.test.ts
 * @description CHESS-B10: shell navigation without a DOM or a GPU.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cpuSearchDepth } from '../src/chess/index';
import { chessMixVolume } from '../src/renderer/host/chessTableAudio';
import {
  acceptJoinCode,
  bootCrestFill,
  bootCrestInset,
  defaultShellPrefs,
  initialShell,
  parseShellPrefs,
  rangeThumbRatio,
  reduceShell,
  opensLocalPeerWindow,
  peerResumeSearch,
  shellBlocksPlay,
  shellSession,
  type ShellState,
} from '../src/renderer/shell/shellScreen';

function game(): ShellState {
  return reduceShell(reduceShell(initialShell(false), { type: 'play' }), { type: 'start' });
}

describe('shell glass', () => {
  it('whitens the liquid glass so dark ink stays readable', () => {
    const css = readFileSync(new URL('../src/renderer/shell/shell.css', import.meta.url), 'utf8');
    const match = css.match(/--glass:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(0.25);
  });

  it('paints shell text black', () => {
    const css = readFileSync(new URL('../src/renderer/shell/shell.css', import.meta.url), 'utf8');
    expect(css).toMatch(/--ink:\s*#000\b/);
    expect(css).toMatch(/--muted:\s*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.62\s*\)/);
  });
});

describe('shell shadow choice', () => {
  const catalogs = ['fr', 'en', 'de', 'it', 'es', 'ru', 'zh', 'ja'];

  it('names soft shadows in every catalog and drops the cascade count', () => {
    for (const id of catalogs) {
      const source = readFileSync(
        new URL(`../src/renderer/shell/copy/${id}.ts`, import.meta.url),
        'utf8'
      );
      expect(source).toContain('shadowSoft:');
      expect(source).not.toContain('shadowCascade');
    }
    const shell = readFileSync(
      new URL('../src/renderer/shell/ChessShell.tsx', import.meta.url),
      'utf8'
    );
    expect(shell).toContain("id: 'soft'");
    expect(shell).not.toContain('shadowCascades');
    const menu = readFileSync(
      new URL('../src/renderer/ui/ChessGraphicsMenu.tsx', import.meta.url),
      'utf8'
    );
    expect(menu).toContain("['soft', 'Douce']");
    expect(menu).not.toContain('SHADOW_CASCADE_OPTIONS');
  });
});

describe('shell screen', () => {
  it('starts on the welcome screen', () => {
    expect(initialShell(false).screen).toBe('accueil');
  });

  it('opens the game directly for the peer window', () => {
    const state = initialShell(true);
    expect(state.screen).toBe('partie');
    expect(shellBlocksPlay(state)).toBe(false);
  });

  it('opens modes from play and the game from start', () => {
    const modes = reduceShell(initialShell(false), { type: 'play' });
    expect(modes.screen).toBe('modes');
    expect(reduceShell(modes, { type: 'start' }).screen).toBe('partie');
  });

  it('opens the lobby instead of the game when the mode is online', () => {
    let state = reduceShell(initialShell(false), { type: 'play' });
    state = reduceShell(state, { type: 'set-mode', mode: 'online' });
    expect(reduceShell(state, { type: 'start' }).screen).toBe('salon');
  });

  it('closes the assistant drawer on escape before opening pause', () => {
    let state = reduceShell(game(), { type: 'open-assistant' });
    state = reduceShell(state, { type: 'escape' });
    expect(state.screen).toBe('partie');
    expect(state.assistant).toBe(false);
    expect(reduceShell(state, { type: 'escape' }).screen).toBe('pause');
  });

  it('returns to the previous screen on escape', () => {
    const options = reduceShell(initialShell(false), { type: 'go', screen: 'options' });
    expect(reduceShell(options, { type: 'escape' }).screen).toBe('accueil');
  });

  it('returns home when about was opened from the welcome screen', () => {
    const about = reduceShell(initialShell(false), { type: 'go', screen: 'propos' });
    expect(about.screen).toBe('propos');
    expect(shellBlocksPlay(about)).toBe(true);
    expect(reduceShell(about, { type: 'escape' }).screen).toBe('accueil');
  });

  it('returns to the screen that opened saves', () => {
    const fromHome = reduceShell(initialShell(false), { type: 'go', screen: 'sauvegardes' });
    expect(shellBlocksPlay(fromHome)).toBe(true);
    expect(reduceShell(fromHome, { type: 'escape' }).screen).toBe('accueil');
    const pause = reduceShell(game(), { type: 'escape' });
    const fromPause = reduceShell(pause, { type: 'go', screen: 'sauvegardes' });
    expect(reduceShell(fromPause, { type: 'escape' }).screen).toBe('pause');
  });

  it('opens the guest window on the other color with the same fiche', () => {
    expect(peerResumeSearch('white', 'interrupt')).toBe(
      'chess=p2p&chessColor=black&chessPeer=1&chessShell=local&chessResume=interrupt'
    );
  });

  it('returns to pause when options were opened from pause', () => {
    const pause = reduceShell(game(), { type: 'escape' });
    const options = reduceShell(pause, { type: 'go', screen: 'options' });
    expect(reduceShell(options, { type: 'escape' }).screen).toBe('pause');
  });

  it('reopens the assistant when leaving settings opened from the drawer', () => {
    const settings = reduceShell(reduceShell(game(), { type: 'open-assistant' }), {
      type: 'coach-settings',
    });
    expect(settings.screen).toBe('parametres');
    const back = reduceShell(settings, { type: 'escape' });
    expect(back.screen).toBe('partie');
    expect(back.assistant).toBe(true);
  });

  it('stays on the lobby when the code is refused', () => {
    let state = reduceShell(initialShell(false), { type: 'play' });
    state = reduceShell(state, { type: 'set-mode', mode: 'online' });
    state = reduceShell(state, { type: 'start' });
    state = reduceShell(state, { type: 'reject-code' });
    expect(state.screen).toBe('salon');
    expect(state.notice).toBe('refused');
  });

  it('blocks play on a full screen and not during the game or the drawer', () => {
    expect(shellBlocksPlay(initialShell(false))).toBe(true);
    const playing = game();
    expect(shellBlocksPlay(playing)).toBe(false);
    expect(shellBlocksPlay(reduceShell(playing, { type: 'open-assistant' }))).toBe(false);
    expect(shellBlocksPlay(reduceShell(playing, { type: 'escape' }))).toBe(true);
  });

  it('keeps an online table in the lobby until the seats agree', () => {
    let state = reduceShell(initialShell(false), { type: 'play' });
    state = reduceShell(state, { type: 'set-mode', mode: 'online' });
    state = reduceShell(state, { type: 'start' });
    state = reduceShell(state, { type: 'create-table', code: 'AB12' });
    expect(state.screen).toBe('salon');
    expect(reduceShell(state, { type: 'peer-ready' }).screen).toBe('partie');
    expect(reduceShell(game(), { type: 'peer-ready' }).screen).toBe('partie');
  });

  it('opens a second window for the same machine and not for an online table', () => {
    expect(opensLocalPeerWindow('local')).toBe(true);
    expect(opensLocalPeerWindow(undefined)).toBe(true);
    expect(opensLocalPeerWindow('online')).toBe(false);
  });

  it('maps local and online play onto the existing peer session', () => {
    const color = 'white' as const;
    expect(shellSession('local', color, 'C50', 2).mode).toBe('p2p');
    expect(shellSession('online', color, 'C50', 2, { room: 'AB12', seat: 'host' })).toMatchObject({
      mode: 'p2p',
      room: 'AB12',
      seat: 'host',
    });
    expect(shellSession('hotseat', color, 'C50', 2).mode).toBe('hotseat');
    expect(shellSession('learn', color, 'C50', 2).quiz).toBe(true);
  });

  it('caps the CPU search depth at 3', () => {
    expect(cpuSearchDepth(1)).toBe(1);
    expect(cpuSearchDepth(5)).toBe(3);
    expect(shellSession('cpu', 'black', 'C50', 5).cpuDepth).toBe(3);
  });

  it('refuses a join code that is not four characters or is 0000', () => {
    expect(acceptJoinCode('AB12')).toBe(true);
    expect(acceptJoinCode('0000')).toBe(false);
    expect(acceptJoinCode('ABC')).toBe(false);
  });

  it('keeps the crest gray until the studio is ready, then colors it from the bottom', () => {
    expect(bootCrestFill(0, false)).toBe(0);
    expect(bootCrestFill(Number.NaN, false)).toBe(0);
    expect(bootCrestFill(8000, false)).toBeLessThan(1);
    expect(bootCrestFill(8000, false)).toBeGreaterThan(0);
    expect(bootCrestFill(0, true)).toBe(1);
    expect(bootCrestInset(0)).toBe('100%');
    expect(bootCrestInset(0.25)).toBe('75%');
    expect(bootCrestInset(1)).toBe('0%');
  });

  it('places a slider thumb from the minimum to the maximum', () => {
    expect(rangeThumbRatio(1, 1, 5)).toBe(0);
    expect(rangeThumbRatio(5, 1, 5)).toBe(1);
    expect(rangeThumbRatio(3, 1, 5)).toBe(0.5);
    expect(rangeThumbRatio(50, 0, 100)).toBe(0.5);
    expect(rangeThumbRatio(4, 4, 4)).toBe(0);
  });

  it('defaults the shell language to French and scales audio', () => {
    expect(defaultShellPrefs().language).toBe('fr');
    expect(parseShellPrefs(null).sfx).toBe(80);
    expect(chessMixVolume(0.5, 50)).toBeCloseTo(0.25);
    expect(chessMixVolume(0.5, 0)).toBe(0);
  });

  it('reads the last mode, color, level and opening, and drops unknown values', () => {
    const stored = JSON.stringify({
      mode: 'learn',
      color: 'black',
      level: 5,
      eco: 'C60',
      sfx: 10,
      ambience: 20,
      language: 'en',
    });
    expect(parseShellPrefs(stored)).toMatchObject({
      mode: 'learn',
      color: 'black',
      level: 5,
      eco: 'C60',
      sfx: 10,
      ambience: 20,
      language: 'en',
    });
    expect(parseShellPrefs(JSON.stringify({ mode: 'p2p', color: 'red', level: 9, eco: 'ZZZ' }))).toMatchObject({
      mode: 'cpu',
      color: 'white',
      level: 2,
      eco: 'C50',
      sfx: 80,
      ambience: 40,
      language: 'fr',
    });
    expect(defaultShellPrefs()).toMatchObject({ mode: 'cpu', color: 'white', level: 2, eco: 'C50' });
  });

  it('keeps the eight shell languages and drops an unknown one', () => {
    for (const language of ['de', 'it', 'es', 'ru', 'zh', 'ja', 'en', 'fr'] as const) {
      expect(parseShellPrefs(JSON.stringify({ language })).language).toBe(language);
    }
    expect(parseShellPrefs(JSON.stringify({ language: 'pt' })).language).toBe('fr');
    expect(parseShellPrefs('{').language).toBe('fr');
  });
});
