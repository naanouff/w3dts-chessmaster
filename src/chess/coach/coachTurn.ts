/**
 * @file coachTurn.ts
 * @description One coach utterance. The student UI shows the text. SAN stays internal.
 */

export interface CoachTurn {
  text: string;
  sans: string[];
  speaking: boolean;
}

export interface CoachChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
