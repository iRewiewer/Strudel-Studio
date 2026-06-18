import { dialog, ipcMain, shell } from 'electron';
import type { AddPluginSourceRequest } from '../../shared/types';
import { ipcChannels } from '../../shared/ipc';
import {
  addPluginFromSource,
  deletePluginFolder,
  externalSamplesDirectoryPath,
  importPluginFolder,
  listPluginFolders,
  pluginsDirectoryPath,
  readPluginScriptBundle,
} from '../filesystem/pluginFiles';
import { mkdir } from 'node:fs/promises';

const openDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true });
  const error = await shell.openPath(directory);
  if (error) {
    throw new Error(error);
  }
};

export const registerPluginIpc = (): void => {
  ipcMain.handle(ipcChannels.listPlugins, async () => {
    return listPluginFolders();
  });

  ipcMain.handle(ipcChannels.addPluginSource, async (_event, request: AddPluginSourceRequest) => {
    return addPluginFromSource(request);
  });

  ipcMain.handle(ipcChannels.importPluginFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add Strudel Studio plugin folder',
      properties: ['openDirectory'],
    });

    const selectedPath = result.filePaths[0];
    if (result.canceled || !selectedPath) {
      return null;
    }

    return importPluginFolder(selectedPath);
  });

  ipcMain.handle(ipcChannels.deletePlugin, async (_event, request: { pluginPath: string }) => {
    return deletePluginFolder(request.pluginPath);
  });

  ipcMain.handle(ipcChannels.readPluginScriptBundle, async (_event, pluginPath: string) => {
    return readPluginScriptBundle(pluginPath);
  });

  ipcMain.handle(ipcChannels.revealPluginsDirectory, async () => {
    await openDirectory(pluginsDirectoryPath());
  });

  ipcMain.handle(ipcChannels.revealExternalSamplesDirectory, async () => {
    await openDirectory(externalSamplesDirectoryPath());
  });
};
