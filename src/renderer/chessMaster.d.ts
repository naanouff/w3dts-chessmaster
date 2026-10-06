/// <reference types="@webgpu/types" />

export interface CoachPublicSettings {
  provider: 'openai';
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export interface CoachBridgeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CoachProbeResult {
  state: 'ready' | 'installed' | 'missing';
  models?: string[];
  settings: CoachPublicSettings;
}

export interface ChessMasterBridge {
  version: () => Promise<string>;
  openPeerWindow: (search: string) => Promise<void>;
  coachSettings: () => Promise<CoachPublicSettings>;
  coachProbe: () => Promise<CoachProbeResult>;
  coachLaunch: () => Promise<CoachProbeResult>;
  coachOpenDownload: () => Promise<void>;
  coachSaveSettings: (patch: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  }) => Promise<{ ok: true; settings: CoachPublicSettings } | { ok: false; error: string }>;
  coachModels: () => Promise<{ ok: true; models: string[] } | { ok: false; error: string }>;
  coachChat: (
    messages: CoachBridgeMessage[]
  ) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
  coachCancel: () => Promise<void>;
  benchReport: (json: string) => Promise<void>;
}

declare global {
  interface Window {
    chessMaster?: ChessMasterBridge;
  }
}
