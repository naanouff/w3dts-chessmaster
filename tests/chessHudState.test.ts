/**
 * @file chessHudState.test.ts
 * @description CHESS-B5: parse chess HUD payloads without GPU.
 */

import { describe, expect, it } from 'vitest';
import {
  ChessMatch,
  buildChessHudLearnPlies,
  chessPlayP2pHint,
  mergeChessDemoQueryIntoSearch,
  normalizeChessHudP2pStatus,
  parseChessHudCommand,
  parseChessHudState,
  stripChessSanSuffix,
} from '../src/chess/index';

describe('parseChessHudState', () => {
  it('returns null for non-objects', () => {
    expect(parseChessHudState(null)).toBeNull();
    expect(parseChessHudState(undefined)).toBeNull();
    expect(parseChessHudState('x')).toBeNull();
    expect(parseChessHudState({ kind: 'other' })).toBeNull();
  });

  it('parses a play payload (cpu clocks + thinking)', () => {
    const parsed = parseChessHudState({
      kind: 'play',
      mode: 'cpu',
      label: 'Status',
      title: 'White to move',
      description: 'You are white. CPU replies automatically.',
      localColor: 'white',
      sideToMove: 'white',
      cpuThinking: true,
      p2pStatus: 'waiting',
      clocks: { whiteSeconds: 600, blackSeconds: 599.2 },
      flag: null,
    });
    expect(parsed).toEqual({
      kind: 'play',
      mode: 'cpu',
      label: 'Status',
      title: 'White to move',
      description: 'You are white. CPU replies automatically.',
      localColor: 'white',
      sideToMove: 'white',
      cpuThinking: true,
      p2pStatus: null,
      clocks: { whiteSeconds: 600, blackSeconds: 599.2 },
      flag: null,
      onlineReady: false,
      onlineRefused: false,
      session: { mode: 'cpu', localColor: 'white', quiz: false },
    });
  });

  it('keeps p2p status only in p2p mode', () => {
    const parsed = parseChessHudState({
      kind: 'play',
      mode: 'p2p',
      label: 'Status',
      title: 'Black to move',
      description: chessPlayP2pHint('white'),
      localColor: 'white',
      sideToMove: 'black',
      clocks: { whiteSeconds: 10, blackSeconds: 10 },
      p2pStatus: 'connected',
    });
    expect(parsed?.kind).toBe('play');
    if (parsed?.kind !== 'play') return;
    expect(parsed.p2pStatus).toBe('connected');
    expect(parsed.description).toBe('You are white. Second tab: chess=p2p&chessColor=black');
    expect(parsed.description.includes('FEN')).toBe(false);
    expect(parsed.description.includes('depth')).toBe(false);
  });

  it('parses a learn payload and drops invalid plies', () => {
    const parsed = parseChessHudState({
      kind: 'learn',
      label: 'Opening',
      title: 'Italian Game (C50)',
      description: 'Play Nf3.',
      eco: 'C50',
      openingName: 'Italian Game',
      plyIndex: 2,
      plyCount: 6,
      quiz: true,
      miss: false,
      complete: false,
      coachBusy: false,
      plies: [
        { san: 'e4', status: 'done', hidden: false },
        { san: '', status: 'done' },
        { san: 'Nf3', status: 'current', hidden: true },
      ],
    });
    expect(parsed?.kind).toBe('learn');
    if (parsed?.kind !== 'learn') return;
    expect(parsed.plies).toEqual([
      { san: 'e4', status: 'done', hidden: false },
      { san: 'Nf3', status: 'current', hidden: true },
    ]);
    expect(parsed.quiz).toBe(true);
    expect(parsed.session).toEqual({
      mode: 'learn',
      localColor: 'white',
      eco: 'C50',
      quiz: true,
    });
  });
});

describe('buildChessHudLearnPlies', () => {
  it('marks done / current / future and hides the next SAN in quiz', () => {
    const plies = buildChessHudLearnPlies(['e4', 'e5', 'Nf3'], 1, true);
    expect(plies).toEqual([
      { san: 'e4', status: 'done', hidden: false },
      { san: 'e5', status: 'current', hidden: true },
      { san: 'Nf3', status: 'future', hidden: true },
    ]);
  });

  it('does not hide SAN when quiz is off', () => {
    expect(buildChessHudLearnPlies(['e4+'], 0, false)[0]).toEqual({
      san: 'e4',
      status: 'current',
      hidden: false,
    });
  });
});

describe('normalizeChessHudP2pStatus', () => {
  it('maps transport states onto HUD chips', () => {
    expect(normalizeChessHudP2pStatus('connected')).toBe('connected');
    expect(normalizeChessHudP2pStatus('degraded')).toBe('connected');
    expect(normalizeChessHudP2pStatus('nope')).toBe('waiting');
  });
});

describe('stripChessSanSuffix', () => {
  it('drops check and mate marks', () => {
    expect(stripChessSanSuffix('Nf3+')).toBe('Nf3');
    expect(stripChessSanSuffix('Qh5#')).toBe('Qh5');
  });
});

describe('parseChessHudCommand', () => {
  it('parses apply-session and mode-picker', () => {
    expect(parseChessHudCommand({ type: 'mode-picker', open: true })).toEqual({
      type: 'mode-picker',
      open: true,
    });
    expect(
      parseChessHudCommand({
        type: 'apply-session',
        session: { mode: 'learn', localColor: 'black', eco: 'C60', quiz: true },
      })
    ).toEqual({
      type: 'apply-session',
      session: { mode: 'learn', localColor: 'black', eco: 'C60', quiz: true },
    });
    expect(parseChessHudCommand({ type: 'apply-session', session: { mode: 'nope' } })).toBeNull();
    expect(parseChessHudCommand({ type: 'request-state' })).toEqual({ type: 'request-state' });
    expect(
      parseChessHudCommand({
        type: 'apply-session',
        session: { mode: 'p2p', localColor: 'white' },
        table: 'online',
      })
    ).toEqual({
      type: 'apply-session',
      session: { mode: 'p2p', localColor: 'white', quiz: false },
      table: 'online',
    });
  });

  it('accepts a resume of a game in progress and the cabinet commands', () => {
    const match = ChessMatch.starting();
    expect(match.tryMove('e2', 'e4').ok).toBe(true);
    const game = {
      id: 'interrupt',
      kind: 'interrupt',
      shellMode: 'cpu',
      fen: match.fen(),
      whiteSeconds: 500,
      blackSeconds: 600,
      localColor: 'white',
      savedAt: 1,
    };
    expect(parseChessHudCommand({ type: 'resume-saved', game })).toMatchObject({
      type: 'resume-saved',
      game: { id: 'interrupt', fen: match.fen() },
    });
    expect(
      parseChessHudCommand({
        type: 'resume-saved',
        game: { ...game, fen: ChessMatch.starting().fen(), whiteSeconds: 600, blackSeconds: 600 },
      })
    ).toBeNull();
    expect(parseChessHudCommand({ type: 'save-voluntary' })).toEqual({ type: 'save-voluntary' });
    expect(parseChessHudCommand({ type: 'discard-interrupt' })).toEqual({ type: 'discard-interrupt' });
    expect(parseChessHudCommand({ type: 'delete-voluntary', id: 'v1' })).toEqual({
      type: 'delete-voluntary',
      id: 'v1',
    });
    expect(parseChessHudCommand({ type: 'delete-voluntary' })).toBeNull();
  });
});

describe('mergeChessDemoQueryIntoSearch', () => {
  it('keeps project= and drops leftover learn params when switching to cpu', () => {
    expect(
      mergeChessDemoQueryIntoSearch(
        '?project=ChessDemoProject&chess=learn&chessEco=C50&chessQuiz=1',
        {
          mode: 'cpu',
          localColor: 'white',
          quiz: false,
        }
      )
    ).toBe('project=ChessDemoProject');
  });

  it('writes p2p + colour without FEN keys', () => {
    const merged = mergeChessDemoQueryIntoSearch('project=ChessDemoProject', {
      mode: 'p2p',
      localColor: 'black',
      quiz: false,
    });
    expect(merged).toBe('project=ChessDemoProject&chess=p2p&chessColor=black');
    expect(merged.includes('fen')).toBe(false);
  });
});
