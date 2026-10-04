/**
 * @file coachDialogue.ts
 * @description Pages of a coach reply for the dialogue bubble.
 */

/** Characters in one bubble, spaces included. */
export const COACH_DIALOGUE_LIMIT = 160;

const SENTENCE_END = /[.!?。！？…](?=\s|$)/u;

/**
 * Splits a reply into bubble pages. A page holds whole sentences and stays
 * within the limit when the next sentence still fits. A sentence longer than
 * the limit stays on its own page.
 * @param text - Full reply from the coach.
 * @param limit - Preferred maximum characters on one page.
 */
export function coachDialoguePages(text: string, limit = COACH_DIALOGUE_LIMIT): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const cap = Math.max(1, Math.floor(limit));
  const sentences = coachSentences(clean);
  const pages: string[] = [];
  let page = '';
  for (const sentence of sentences) {
    const next = page ? `${page} ${sentence}` : sentence;
    if (page && next.length > cap) {
      pages.push(page);
      page = sentence;
    } else {
      page = next;
    }
  }
  if (page) pages.push(page);
  return pages;
}

/** Sentences ending on `.` `!` `?` or an ideographic stop. A decimal point stays inside. */
function coachSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const mark = text[index] ?? '';
    if (mark === '.' && /\d/.test(text[index - 1] ?? '') && /\d/.test(text[index + 1] ?? '')) continue;
    if (mark === '.' && text[index + 1] === '.') continue;
    if (!SENTENCE_END.test(mark) || (text[index + 1] !== undefined && text[index + 1] !== ' ')) continue;
    const sentence = text.slice(start, index + 1).trim();
    if (sentence) sentences.push(sentence);
    start = index + 1;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}
