/// <reference types="@webgpu/types" />

export interface ChessMasterBridge {
  version: () => Promise<string>;
  openPeerWindow: (search: string) => Promise<void>;
}

declare global {
  interface Window {
    chessMaster?: ChessMasterBridge;
  }
}
