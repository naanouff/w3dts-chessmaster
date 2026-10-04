/**
 * @file coachPrompt.ts
 * @description Grounded prompts. The model comments. It does not choose the move.
 */

import { ChessMatch } from '../rules/ChessMatch';
import type { ChessColor } from '../rules/chessTypes';
import { coachMaterial, type CoachVariation } from './coachPlan';
import type { CoachChatMessage } from './coachTurn';

const SYSTEM = [
  'You are a chess teacher beside the student.',
  'Teach what is happening, in plain words.',
  'Mention only moves from the search line and the legal list.',
  'This is a short search, not a tablebase. Do not invent a move.',
  'Write at most two short sentences.',
  'Stay under 180 characters.',
  'No paragraphs and no lists.',
].join(' ');

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French',
  en: 'English',
  de: 'German',
  it: 'Italian',
  es: 'Spanish',
  ru: 'Russian',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
};

const LEGAL_CAP = 48;

export function legalSansFromFen(fen: string): string[] {
  let match: ChessMatch;
  try {
    match = ChessMatch.fromFen(fen);
  } catch {
    return [];
  }
  const sans: string[] = [];
  for (const move of match.legalMoves()) {
    if (sans.length >= LEGAL_CAP) break;
    const next = ChessMatch.fromFen(fen);
    const result = next.tryMove(move.from, move.to);
    if (!result.ok) continue;
    sans.push(result.san.replace(/[+#]$/, ''));
  }
  return sans;
}

function snapshot(fen: string, history: readonly string[]): string {
  let match: ChessMatch;
  try {
    match = ChessMatch.fromFen(fen);
  } catch {
    return `FEN: ${fen}`;
  }
  const side = match.sideToMove();
  return [
    `FEN: ${fen}`,
    `Side to move: ${side}`,
    `Check: ${match.isCheck() ? 'yes' : 'no'}`,
    `Checkmate: ${match.isCheckmate() ? 'yes' : 'no'}`,
    `Stalemate: ${match.isStalemate() ? 'yes' : 'no'}`,
    `Material (white view, pawn 100): ${coachMaterial(match)}`,
    `Legal moves: ${legalSansFromFen(fen).join(' ')}`,
    `History: ${history.slice(-24).join(' ')}`,
  ].join('\n');
}

function sideClause(student: ChessColor | null): string {
  if (!student) return 'Never tell the student to move an opponent piece.';
  return `The student plays ${student}. Suggest only ${student} moves. Never tell the student to move an opponent piece.`;
}

function messages(user: string, language = 'en', student: ChessColor | null = null): CoachChatMessage[] {
  const name = LANGUAGE_NAMES[language] ?? 'English';
  const tongue = `Write every word in ${name}.`;
  const side = sideClause(student);
  return [
    { role: 'system', content: `${tongue} ${SYSTEM} ${side}` },
    { role: 'user', content: `${user}\n\n${tongue} ${side}` },
  ];
}

export function buildExplainMessages(
  fen: string,
  history: readonly string[],
  language = 'en',
  student: ChessColor | null = null
): CoachChatMessage[] {
  return messages(
    `${snapshot(fen, history)}\n\nTeach this position: who stands better and why, the main threat, and a simple plan.`,
    language,
    student
  );
}

export function buildHintMessages(
  fen: string,
  history: readonly string[],
  quiz: boolean,
  language = 'en',
  student: ChessColor | null = null
): CoachChatMessage[] {
  const quizLine = quiz
    ? 'This is a quiz. Do not name the move the student should play. Teach the idea instead.'
    : 'Teach one idea the student can use. Say why, not only which move. Do not play the move.';
  return messages(`${snapshot(fen, history)}\n\n${quizLine}`, language, student);
}

export function buildAskMessages(
  fen: string,
  history: readonly string[],
  question: string,
  language = 'en',
  student: ChessColor | null = null
): CoachChatMessage[] {
  return messages(
    `${snapshot(fen, history)}\n\nQuestion: ${question.trim()}\nAnswer as a teacher, with the reason, not only the conclusion.`,
    language,
    student
  );
}

export function buildMistakeMessages(
  fen: string,
  history: readonly string[],
  playedSan: string,
  line: CoachVariation | null,
  language = 'en',
  student: ChessColor | null = null
): CoachChatMessage[] {
  const first = line?.sans[0] ?? '';
  const differ = first && first !== playedSan.trim().replace(/[+#]$/, '');
  const compare = differ
    ? `The student played ${playedSan}. The search prefers ${first}. Teach the mistake: what the played move allows, what the preferred move changes, and one thing to remember next time.`
    : `The student played ${playedSan}. Teach whether the move is sound, and one thing to remember.`;
  return messages(
    `${snapshot(fen, history)}\nSearch: ${(line?.sans ?? []).join(' ')}\n${compare}`,
    language,
    student
  );
}

export function buildStrategyMessages(
  fen: string,
  history: readonly string[],
  line: CoachVariation | null,
  language = 'en',
  student: ChessColor | null = null
): CoachChatMessage[] {
  return messages(
    `${snapshot(fen, history)}\nSearch: ${(line?.sans ?? []).join(' ')}\nTeach a plan for the student's next moves. Start from the student's first move in the search. Keep that move. Do not ask the student to play the other color.`,
    language,
    student
  );
}
