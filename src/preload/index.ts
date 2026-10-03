import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chessMaster', {
  version: (): Promise<string> => ipcRenderer.invoke('app-version'),
  openPeerWindow: (search: string): Promise<void> => ipcRenderer.invoke('open-peer-window', search),
});
