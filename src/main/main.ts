import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { registerFilesystemIpc } from './ipc/filesystem';
import { registerPluginIpc } from './ipc/plugins';
import { registerThemeIpc } from './ipc/themes';
import { registerWorkspaceIpc } from './ipc/workspace';
import { ipcChannels } from '../shared/ipc';

const windowsAllowedToClose = new WeakSet<BrowserWindow>();

const getAppIconPath = (): string => {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');
};

const registerWindowIpc = (): void => {
  ipcMain.handle(ipcChannels.confirmClose, (event, shouldClose: boolean) => {
    if (!shouldClose) {
      return;
    }

    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) {
      return;
    }

    windowsAllowedToClose.add(window);
    window.close();
  });
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    title: 'Strudel Studio',
    icon: getAppIconPath(),
    backgroundColor: '#111517',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (windowsAllowedToClose.has(mainWindow)) {
      return;
    }

    event.preventDefault();
    mainWindow.webContents.send(ipcChannels.closeRequested);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

app.whenReady().then(() => {
  registerWindowIpc();
  registerFilesystemIpc();
  registerPluginIpc();
  registerThemeIpc();
  registerWorkspaceIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
