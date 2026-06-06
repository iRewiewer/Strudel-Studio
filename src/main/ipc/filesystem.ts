import { dialog, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ipcChannels } from '../../shared/ipc';
import type { CreateFileRequest, ReadFileRequest, SaveFileRequest } from '../../shared/types';
import { assertInsideProject, createProjectSnapshot } from '../filesystem/projectFiles';

export const registerFilesystemIpc = (): void => {
  ipcMain.handle(ipcChannels.openProjectFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Strudel project folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    const selectedPath = result.filePaths[0];
    if (result.canceled || !selectedPath) {
      return null;
    }

    return createProjectSnapshot(selectedPath);
  });

  ipcMain.handle(ipcChannels.createStrudelFile, async (_event, request: CreateFileRequest) => {
    const target = assertInsideProject(request.projectRoot, request.relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, '', { encoding: 'utf8', flag: 'wx' });
    return createProjectSnapshot(request.projectRoot);
  });

  ipcMain.handle(ipcChannels.readFile, async (_event, request: ReadFileRequest) => {
    const target = assertInsideProject(request.projectRoot, request.relativePath);
    return readFile(target, 'utf8');
  });

  ipcMain.handle(ipcChannels.saveFile, async (_event, request: SaveFileRequest) => {
    const target = assertInsideProject(request.projectRoot, request.relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, request.content, 'utf8');
  });
};
