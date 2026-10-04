import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chessMaster', {
  version: (): Promise<string> => ipcRenderer.invoke('app-version'),
  openPeerWindow: (search: string): Promise<void> => ipcRenderer.invoke('open-peer-window', search),
  coachSettings: (): Promise<unknown> => ipcRenderer.invoke('coach-settings'),
  coachProbe: (): Promise<unknown> => ipcRenderer.invoke('coach-probe'),
  coachLaunch: (): Promise<unknown> => ipcRenderer.invoke('coach-launch'),
  coachOpenDownload: (): Promise<void> => ipcRenderer.invoke('coach-open-download'),
  coachSaveSettings: (patch: unknown): Promise<unknown> => ipcRenderer.invoke('coach-save-settings', patch),
  coachModels: (): Promise<unknown> => ipcRenderer.invoke('coach-models'),
  coachChat: (messages: unknown): Promise<unknown> => ipcRenderer.invoke('coach-chat', messages),
  coachCancel: (): Promise<unknown> => ipcRenderer.invoke('coach-cancel'),
});
