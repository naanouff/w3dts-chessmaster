import { app, BrowserWindow, Menu, ipcMain, net, protocol } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const APP_SCHEME = 'app';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function rendererRoot(): string {
  return path.join(__dirname, '../renderer');
}

function registerAppProtocol(): void {
  const root = path.resolve(rendererRoot());
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const resolved = path.resolve(root, pathname.replace(/^[/\\]+/, ''));
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(resolved).toString());
  });
}

async function loadApp(win: BrowserWindow, search = ''): Promise<void> {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    const url = new URL(devUrl);
    const extra = new URLSearchParams(raw);
    extra.forEach((value, key) => url.searchParams.set(key, value));
    await win.loadURL(url.toString());
    return;
  }
  const qs = raw.length > 0 ? `?${raw}` : '';
  await win.loadURL(`${APP_SCHEME}://localhost/index.html${qs}`);
}

function windowIcon(): string {
  const packed = path.join(process.resourcesPath, 'icon.ico');
  if (existsSync(packed)) return packed;
  return path.join(__dirname, '../../resources/icon.ico');
}

function createWindow(search = ''): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'W3DTS ChessMaster',
    icon: windowIcon(),
    backgroundColor: '#0e1014',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.setMenu(null);
  void loadApp(win, search);
  return win;
}

let peerWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (!process.env.ELECTRON_RENDERER_URL) registerAppProtocol();
  ipcMain.handle('app-version', () => app.getVersion());
  ipcMain.handle('open-peer-window', (_event, search: unknown) => {
    if (peerWindow && !peerWindow.isDestroyed()) {
      peerWindow.focus();
      return;
    }
    const query = typeof search === 'string' && search.length > 0 ? search : 'chess=p2p&chessColor=black&chessPeer=1';
    peerWindow = createWindow(query);
    peerWindow.on('closed', () => {
      peerWindow = null;
    });
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
