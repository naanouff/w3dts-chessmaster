/**
 * @file coachClient.test.ts
 * @description OpenAI-compatible coach client with a mocked fetch.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyLocalCoach,
  buildChatRequestBody,
  chatCompletionsUrl,
  defaultCoachSettings,
  normalizeCoachBaseUrl,
  parseChatText,
  parseModelIds,
  preferCoachModel,
  probeLocalOllama,
  redactSecret,
  requestCoachChat,
  sanitizeCoachMessages,
  toPublicSettings,
} from '../src/chess/coach/coachClient';

describe('coach client', () => {
  it('accepts only http(s) bases without credentials', () => {
    expect(normalizeCoachBaseUrl('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1:11434/v1');
    expect(normalizeCoachBaseUrl('file:///tmp/model')).toBeNull();
    expect(normalizeCoachBaseUrl('http://user:pass@127.0.0.1:11434/v1')).toBeNull();
  });

  it('never publishes the key', () => {
    const settings = { ...defaultCoachSettings(), apiKey: 'secret-key' };
    expect(toPublicSettings(settings)).toEqual({
      provider: 'openai',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: '',
      hasKey: true,
    });
    expect(JSON.stringify(toPublicSettings(settings))).not.toContain('secret-key');
  });

  it('builds a non-streaming request and caps the transcript', () => {
    const body = JSON.parse(buildChatRequestBody('llama3.2', [{ role: 'user', content: 'hi' }])) as {
      stream: boolean;
      temperature: number;
      model: string;
    };
    expect(body).toMatchObject({ model: 'llama3.2', stream: false, temperature: 0.3 });
    const long = Array.from({ length: 12 }, (_, i) => ({
      role: 'user' as const,
      content: `${i}`.repeat(2000),
    }));
    const kept = sanitizeCoachMessages(long);
    expect(kept.length).toBeLessThanOrEqual(8);
    expect(kept.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(12_000);
  });

  it('reads model ids and chat text', () => {
    expect(parseModelIds({ data: [{ id: 'llama3.2:latest' }] })).toEqual(['llama3.2:latest']);
    expect(parseModelIds({ models: [{ name: 'qwen2.5:latest' }] })).toEqual(['qwen2.5:latest']);
    expect(parseChatText({ choices: [{ message: { content: '  Look at the center.  ' } }] })).toBe(
      'Look at the center.'
    );
  });

  it('asks the local endpoint and redacts a key echoed by the model', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'token secret-key stays here' } }] }), {
        status: 200,
      })
    );
    const result = await requestCoachChat(
      fetchImpl as unknown as typeof fetch,
      { ...defaultCoachSettings(), model: 'llama3.2', apiKey: 'secret-key' },
      [{ role: 'user', content: 'hello' }],
      new AbortController().signal
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      chatCompletionsUrl('http://127.0.0.1:11434/v1'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual({ ok: true, text: 'token ••• stays here' });
  });

  it('refuses to chat before a model is chosen', async () => {
    const fetchImpl = vi.fn();
    const result = await requestCoachChat(
      fetchImpl as unknown as typeof fetch,
      defaultCoachSettings(),
      [{ role: 'user', content: 'hello' }],
      new AbortController().signal
    );
    expect(result).toEqual({ ok: false, error: 'no-model' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('redacts the secret from a string', () => {
    expect(redactSecret('abc secret abc', 'secret')).toBe('abc ••• abc');
  });

  it('picks llama3.2 when the saved model is empty', () => {
    expect(preferCoachModel(['qwen2.5:latest', 'llama3.2:latest'], '')).toBe('llama3.2:latest');
    expect(preferCoachModel(['qwen2.5:latest', 'llama3.2:latest'], 'qwen2.5:latest')).toBe('qwen2.5:latest');
    expect(preferCoachModel([], '')).toBe('');
  });

  it('keeps a remote server and otherwise adopts the local model', () => {
    const remote = {
      ...defaultCoachSettings(),
      baseUrl: 'https://example.test/v1',
      model: 'remote-model',
      apiKey: 'secret-key',
    };
    expect(applyLocalCoach(remote, ['llama3.2'])).toEqual(remote);
    expect(applyLocalCoach(defaultCoachSettings(), ['qwen2.5:latest', 'llama3.2:latest'])).toEqual({
      provider: 'openai',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'llama3.2:latest',
      apiKey: '',
    });
  });

  it('reports Ollama ready, installed, or missing', async () => {
    const ready = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'llama3.2' }] }), { status: 200 }));
    expect(await probeLocalOllama(ready as unknown as typeof fetch, false)).toEqual({
      state: 'ready',
      models: ['llama3.2'],
    });
    const down = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await probeLocalOllama(down as unknown as typeof fetch, true)).toEqual({ state: 'installed' });
    expect(await probeLocalOllama(down as unknown as typeof fetch, false)).toEqual({ state: 'missing' });
  });
});
