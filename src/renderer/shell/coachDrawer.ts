/**
 * @file coachDrawer.ts
 * @description Messages and ghost steps for the assistant drawer. No SAN is shown to the student.
 */

import {
  buildAskMessages,
  buildExplainMessages,
  buildHintMessages,
  buildMistakeMessages,
  buildStrategyMessages,
  planAhead,
  type ChessColor,
  type CoachChatMessage,
  type CoachContext,
  type CoachGhostStep,
} from '../../chess';

export type CoachAskKind = 'explain' | 'hint' | 'ask' | 'mistake' | 'strategy';

export function coachMessages(
  kind: CoachAskKind,
  ctx: CoachContext,
  question: string,
  horizon: number,
  quiz: boolean,
  language: string
): CoachChatMessage[] {
  const student = ctx.training?.localColor ?? null;
  if (kind === 'explain') return buildExplainMessages(ctx.fen, ctx.history, language, student);
  if (kind === 'hint') return buildHintMessages(ctx.fen, ctx.history, quiz, language, student);
  if (kind === 'ask') return buildAskMessages(ctx.fen, ctx.history, question, language, student);
  const fen = kind === 'mistake' && ctx.training?.lastUserFen ? ctx.training.lastUserFen : ctx.fen;
  const line = planAhead(fen, horizon);
  if (kind === 'mistake') {
    return buildMistakeMessages(fen, ctx.history, ctx.training?.lastUserSan ?? '', line, language, student);
  }
  return buildStrategyMessages(ctx.fen, ctx.history, line, language, student);
}

/**
 * Ghosts for the student's own moves. Opponent plies stay off the board.
 * @param fen - Position the line is searched from.
 * @param horizon - Search depth, 1 to 5.
 * @param localColor - Side the student plays.
 */
export function coachGhostSteps(fen: string, horizon: number, localColor: ChessColor): CoachGhostStep[] {
  return (planAhead(fen, horizon)?.steps ?? []).filter((step) => step.color === localColor).slice(0, 5);
}
