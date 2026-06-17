import { dialog, ipcMain, shell } from 'electron';
import type { SaveThemeRequest } from '../../shared/types';
import { ipcChannels } from '../../shared/ipc';
import {
  importThemeFile as importThemeFileFromPath,
  listSystemFontNames,
  listThemeFiles,
  saveThemeFile,
  themesDirectoryPath,
} from '../filesystem/themeFiles';

export const registerThemeIpc = (): void => {
  ipcMain.handle(ipcChannels.listThemes, async () => {
    return listThemeFiles();
  });

  ipcMain.handle(ipcChannels.importThemeFile, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add external Strudel Studio theme',
      filters: [{ name: 'Theme JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    const selectedPath = result.filePaths[0];
    if (result.canceled || !selectedPath) {
      return null;
    }

    return importThemeFileFromPath(selectedPath);
  });

  ipcMain.handle(ipcChannels.saveTheme, async (_event, request: SaveThemeRequest) => {
    return saveThemeFile(request);
  });

  ipcMain.handle(ipcChannels.revealThemesDirectory, async () => {
    await listThemeFiles();
    const error = await shell.openPath(themesDirectoryPath());
    if (error) {
      throw new Error(error);
    }
  });

  ipcMain.handle(ipcChannels.listSystemFonts, async () => {
    return listSystemFontNames();
  });
};
