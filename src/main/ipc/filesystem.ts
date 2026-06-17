import { dialog, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ipcChannels } from '../../shared/ipc';
import type { CreateFileRequest, ProjectSessionSnapshot, ReadFileRequest, SaveFileRequest } from '../../shared/types';
import { forgetRecentProject, rememberRecentProject, listRecentProjects } from '../filesystem/recentProjects';
import { assertInsideProject, createProjectSnapshot } from '../filesystem/projectFiles';
import {
  createEmptyProjectSession,
  loadWorkspaceSnapshot,
  toProjectSession,
  workspaceExists,
} from '../filesystem/workspaceFiles';

const selectProjectFolder = async (title: string): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openDirectory', 'createDirectory'],
  });

  const selectedPath = result.filePaths[0];
  return result.canceled || !selectedPath ? null : selectedPath;
};

const loadProjectWorkspace = async (projectRoot: string): Promise<ProjectSessionSnapshot> => {
  const snapshot = await loadWorkspaceSnapshot(assertInsideProject(projectRoot, '.strudel-studio/workspace.json'));
  await rememberRecentProject(projectRoot);
  return toProjectSession(snapshot);
};

const createProject = async (projectRoot: string): Promise<ProjectSessionSnapshot> => {
  const session = await createEmptyProjectSession(projectRoot);
  await rememberRecentProject(projectRoot);
  return session;
};

export const registerFilesystemIpc = (): void => {
  ipcMain.handle(ipcChannels.newProjectFolder, async () => {
    while (true) {
      const selectedPath = await selectProjectFolder('Create Strudel Studio project');
      if (!selectedPath) {
        return null;
      }

      if (await workspaceExists(selectedPath)) {
        const result = await dialog.showMessageBox({
          type: 'question',
          title: 'Existing Strudel project',
          message: 'This already is a Strudel project. Would you like to open it?',
          buttons: ['Open Existing', 'Choose Different Folder', 'Cancel'],
          defaultId: 0,
          cancelId: 2,
        });

        if (result.response === 0) {
          return loadProjectWorkspace(selectedPath);
        }
        if (result.response === 1) {
          continue;
        }
        return null;
      }

      return createProject(selectedPath);
    }
  });

  ipcMain.handle(ipcChannels.openProjectFolder, async () => {
    const selectedPath = await selectProjectFolder('Open Strudel Studio project');
    if (!selectedPath) {
      return null;
    }

    if (await workspaceExists(selectedPath)) {
      return loadProjectWorkspace(selectedPath);
    }

    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'No Strudel project found',
      message: "There's no Strudel project here. Would you like to create one?",
      buttons: ['Create Project', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response !== 0) {
      return null;
    }

    return createProject(selectedPath);
  });

  ipcMain.handle(ipcChannels.openRecentProject, async (_event, projectRoot: string) => {
    if (await workspaceExists(projectRoot)) {
      return loadProjectWorkspace(projectRoot);
    }
    return createProject(projectRoot);
  });

  ipcMain.handle(ipcChannels.listRecentProjects, async () => {
    return listRecentProjects();
  });

  ipcMain.handle(ipcChannels.removeRecentProject, async (_event, projectRoot: string) => {
    return forgetRecentProject(projectRoot);
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
