/**
 * @file coachClient.ts
 * @description OpenAI-compatible chat helpers. The key never leaves the main process.
 */

import type { CoachChatMessage } from './coachTurn';

export const COACH_LOCAL_BASE_URL = 'http://127.0.0.1:11434/v1';
export const COACH_TIMEOUT_MS = 60_000;

export interface CoachSettings {
  provider: 'openai';
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface CoachPublicSettings {
  provider: 'openai';
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export type CoachFailure = 'no-model' | 'no-answer' | 'bad-url' | 'cancelled';

export type CoachChatResult = { ok: true; text: string } | { ok: false; error: CoachFailure };

export type CoachModelsResult = { ok: true; models: string[] } | { ok: false; error: CoachFailure };

export type CoachLocalState = 'ready' | 'installed' | 'missing';

export type CoachProbe = { state: 'ready'; models: string[] } | { state: 'installed' | 'missing' };

/** Prefer the saved model, otherwise llama3.2, otherwise the first listed model. */
export function preferCoachModel(models: readonly string[], current: string): string {
  if (current && models.includes(current)) return current;
  const llama = models.find((id) => id === 'llama3.2' || id.startsWith('llama3.2:'));
  return llama ?? models[0] ?? '';
}

/**
 * Keep a remote server the player already saved.
 * An empty or local setup adopts Ollama and drops the key.
 */
export function applyLocalCoach(current: CoachSettings, models: readonly string[]): CoachSettings {
  const remote = current.baseUrl !== COACH_LOCAL_BASE_URL && current.model.length > 0;
  if (remote) return current;
  return {
    provider: 'openai',
    baseUrl: COACH_LOCAL_BASE_URL,
    model: preferCoachModel(models, current.model),
    apiKey: '',
  };
}

const PROBE_TIMEOUT_MS = 1500;

/** Ask the local Ollama server. `installed` is true when the program is on disk but silent. */
export async function probeLocalOllama(fetchImpl: typeof fetch, installed: boolean): Promise<CoachProbe> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(modelsUrl(COACH_LOCAL_BASE_URL), { method: 'GET', signal: ctrl.signal });
    if (!response.ok) return { state: installed ? 'installed' : 'missing' };
    return { state: 'ready', models: parseModelIds(await response.json()) };
  } catch {
    return { state: installed ? 'installed' : 'missing' };
  } finally {
    clearTimeout(timer);
  }
}

export function defaultCoachSettings(): CoachSettings {
  return { provider: 'openai', baseUrl: COACH_LOCAL_BASE_URL, model: '', apiKey: '' };
}

export function toPublicSettings(settings: CoachSettings): CoachPublicSettings {
  return {
    provider: 'openai',
    baseUrl: settings.baseUrl,
    model: settings.model,
    hasKey: settings.apiKey.length > 0,
  };
}

export function normalizeCoachBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

export function parseStoredCoachSettings(raw: unknown): CoachSettings {
  const base = defaultCoachSettings();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base;
  const rec = raw as Record<string, unknown>;
  const baseUrl = typeof rec.baseUrl === 'string' ? normalizeCoachBaseUrl(rec.baseUrl) : null;
  return {
    provider: 'openai',
    baseUrl: baseUrl ?? base.baseUrl,
    model: typeof rec.model === 'string' ? rec.model.trim().slice(0, 120) : '',
    apiKey: typeof rec.apiKey === 'string' ? rec.apiKey : '',
  };
}

export function mergeCoachSettings(
  current: CoachSettings,
  patch: { baseUrl?: string; model?: string; apiKey?: string }
): CoachSettings | null {
  const baseUrl =
    patch.baseUrl === undefined ? current.baseUrl : normalizeCoachBaseUrl(patch.baseUrl);
  if (!baseUrl) return null;
  const model = patch.model === undefined ? current.model : patch.model.trim().slice(0, 120);
  const apiKey = patch.apiKey === undefined || patch.apiKey === '' ? current.apiKey : patch.apiKey;
  return { provider: 'openai', baseUrl, model, apiKey };
}

export function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

export function modelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/models`;
}

export function sanitizeCoachMessages(messages: readonly CoachChatMessage[]): CoachChatMessage[] {
  const kept: CoachChatMessage[] = [];
  let budget = 12_000;
  for (const message of messages.slice(0, 8)) {
    if (message.role !== 'system' && message.role !== 'user' && message.role !== 'assistant') continue;
    const room = Math.max(0, budget);
    const content = message.content.slice(0, room);
    budget -= content.length;
    if (content.length === 0) continue;
    kept.push({ role: message.role, content });
  }
  return kept;
}

export function buildChatRequestBody(model: string, messages: readonly CoachChatMessage[]): string {
  return JSON.stringify({
    model,
    messages: sanitizeCoachMessages(messages),
    stream: false,
    temperature: 0.3,
  });
}

export function parseModelIds(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const rec = payload as Record<string, unknown>;
  const rows = Array.isArray(rec.data) ? rec.data : Array.isArray(rec.models) ? rec.models : [];
  const ids: string[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id : typeof item.name === 'string' ? item.name : '';
    if (id) ids.push(id);
  }
  return ids;
}

export function parseChatText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== 'object' || first === null) return null;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' && content.trim().length > 0 ? content.trim() : null;
}

export function redactSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join('•••');
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestCoachModels(
  fetchImpl: typeof fetch,
  settings: CoachSettings,
  signal: AbortSignal
): Promise<CoachModelsResult> {
  const base = normalizeCoachBaseUrl(settings.baseUrl);
  if (!base) return { ok: false, error: 'bad-url' };
  try {
    const headers: Record<string, string> = {};
    if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
    const response = await fetchImpl(modelsUrl(base), { method: 'GET', headers, signal });
    if (!response.ok) return { ok: false, error: 'no-answer' };
    return { ok: true, models: parseModelIds(await readJson(response)) };
  } catch {
    if (signal.aborted) return { ok: false, error: 'cancelled' };
    return { ok: false, error: 'no-answer' };
  }
}

export async function requestCoachChat(
  fetchImpl: typeof fetch,
  settings: CoachSettings,
  messages: readonly CoachChatMessage[],
  signal: AbortSignal
): Promise<CoachChatResult> {
  if (!settings.model.trim()) return { ok: false, error: 'no-model' };
  const base = normalizeCoachBaseUrl(settings.baseUrl);
  if (!base) return { ok: false, error: 'bad-url' };
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
    const response = await fetchImpl(chatCompletionsUrl(base), {
      method: 'POST',
      headers,
      body: buildChatRequestBody(settings.model, messages),
      signal,
    });
    if (!response.ok) return { ok: false, error: 'no-answer' };
    const text = parseChatText(await readJson(response));
    if (!text) return { ok: false, error: 'no-answer' };
    return { ok: true, text: redactSecret(text, settings.apiKey) };
  } catch {
    if (signal.aborted) return { ok: false, error: 'cancelled' };
    return { ok: false, error: 'no-answer' };
  }
}
