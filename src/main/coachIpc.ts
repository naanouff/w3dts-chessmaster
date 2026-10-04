/**
 * @file coachIpc.ts
 * @description Main-process proxy for the coach. The renderer never sees the key.
 */

import { spawn, spawnSync } from 'node:child_process';
import { app, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  COACH_TIMEOUT_MS,
  applyLocalCoach,
  defaultCoachSettings,
  mergeCoachSettings,
  parseStoredCoachSettings,
  probeLocalOllama,
  requestCoachChat,
  requestCoachModels,
  toPublicSettings,
  type CoachProbe,
  type CoachPublicSettings,
  type CoachSettings,
} from '../chess/coach/coachClient';
import type { CoachChatMessage } from '../chess/coach/coachTurn';

const FILE_NAME = 'coach-settings.json';

function settingsPath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

async function readSettings(): Promise<CoachSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8');
    return parseStoredCoachSettings(JSON.parse(raw) as unknown);
  } catch {
    return defaultCoachSettings();
  }
}

async function writeSettings(settings: CoachSettings): Promise<void> {
  const file = settingsPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(settings), 'utf8');
}

let inflight: AbortController | null = null;

function beginRequest(): AbortSignal {
  inflight?.abort();
  const ctrl = new AbortController();
  inflight = ctrl;
  const timer = setTimeout(() => ctrl.abort(), COACH_TIMEOUT_MS);
  ctrl.signal.addEventListener('abort', () => clearTimeout(timer));
  return ctrl.signal;
}

function asMessages(raw: unknown): CoachChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: CoachChatMessage[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.role !== 'system' && rec.role !== 'user' && rec.role !== 'assistant') continue;
    if (typeof rec.content !== 'string') continue;
    out.push({ role: rec.role, content: rec.content });
  }
  return out;
}

function ollamaCandidates(): string[] {
  const files: string[] = [];
  if (process.env.LOCALAPPDATA) {
    files.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'));
  }
  if (process.env.ProgramFiles) {
    files.push(path.join(process.env.ProgramFiles, 'Ollama', 'ollama.exe'));
  }
  files.push('/usr/local/bin/ollama', '/opt/homebrew/bin/ollama');
  return files;
}

function findOllamaExecutable(): string | null {
  for (const file of ollamaCandidates()) {
    if (existsSync(file)) return file;
  }
  if (process.platform !== 'win32') return null;
  const found = spawnSync('where.exe', ['ollama'], { encoding: 'utf8', windowsHide: true, timeout: 2000 });
  if (found.status !== 0 || typeof found.stdout !== 'string') return null;
  const line = found.stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().endsWith('ollama.exe'));
  return line && existsSync(line) ? line : null;
}

async function readProbe(): Promise<CoachProbe & { settings: CoachPublicSettings }> {
  const installed = findOllamaExecutable() !== null;
  const probe = await probeLocalOllama(fetch, installed);
  const current = await readSettings();
  if (probe.state === 'ready') {
    const next = applyLocalCoach(current, probe.models);
    if (next.baseUrl !== current.baseUrl || next.model !== current.model || next.apiKey !== current.apiKey) {
      await writeSettings(next);
    }
    return { ...probe, settings: toPublicSettings(await readSettings()) };
  }
  return { state: probe.state, settings: toPublicSettings(current) };
}

async function launchOllama(): Promise<void> {
  const exe = findOllamaExecutable();
  if (!exe) return;
  const child = spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const probe = await probeLocalOllama(fetch, true);
    if (probe.state === 'ready') return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

export function registerCoachIpc(): void {
  ipcMain.handle('coach-settings', async () => toPublicSettings(await readSettings()));
  ipcMain.handle('coach-probe', () => readProbe());
  ipcMain.handle('coach-launch', async () => {
    await launchOllama();
    return readProbe();
  });
  ipcMain.handle('coach-open-download', () => {
    void shell.openExternal('https://ollama.com/download');
  });
  ipcMain.handle('coach-save-settings', async (_event, patch: unknown) => {
    const current = await readSettings();
    const rec = typeof patch === 'object' && patch !== null ? (patch as Record<string, unknown>) : {};
    const next = mergeCoachSettings(current, {
      ...(typeof rec.baseUrl === 'string' ? { baseUrl: rec.baseUrl } : {}),
      ...(typeof rec.model === 'string' ? { model: rec.model } : {}),
      ...(typeof rec.apiKey === 'string' ? { apiKey: rec.apiKey } : {}),
    });
    if (!next) return { ok: false as const, error: 'bad-url' as const };
    await writeSettings(next);
    return { ok: true as const, settings: toPublicSettings(next) };
  });
  ipcMain.handle('coach-models', async () => requestCoachModels(fetch, await readSettings(), beginRequest()));
  ipcMain.handle('coach-chat', async (_event, raw: unknown) =>
    requestCoachChat(fetch, await readSettings(), asMessages(raw), beginRequest())
  );
  ipcMain.handle('coach-cancel', () => {
    inflight?.abort();
    inflight = null;
  });
}
