import { dialog, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ipcChannels } from '../../shared/ipc';
import type { SaveWorkspaceRequest, WorkspaceFile, WorkspaceSnapshot } from '../../shared/types';
import {
  assertInsideProject,
  createProjectSnapshot,
  getWorkspacePath,
} from '../filesystem/projectFiles';

const readWorkspaceFile = async (workspacePath: string): Promise<WorkspaceFile> => {
  const raw = await readFile(workspacePath, 'utf8');
  const parsed = JSON.parse(raw) as WorkspaceFile;
  if (parsed.version !== 1 || typeof parsed.projectRoot !== 'string') {
    throw new Error('Unsupported workspace file.');
  }
  return parsed;
};

export const registerWorkspaceIpc = (): void => {
  ipcMain.handle(ipcChannels.saveWorkspace, async (_event, request: SaveWorkspaceRequest) => {
    const workspacePath = getWorkspacePath(request.projectRoot);
    const workspace: WorkspaceFile = {
      version: 1,
      projectRoot: request.projectRoot,
      openFiles: request.openFiles,
      activeFilePath: request.activeFilePath,
      savedAt: new Date().toISOString(),
    };

    await mkdir(dirname(workspacePath), { recursive: true });
    await writeFile(workspacePath, JSON.stringify(workspace, null, 2), 'utf8');
    return workspacePath;
  });

  ipcMain.handle(ipcChannels.loadWorkspace, async (): Promise<WorkspaceSnapshot | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Load Strudel Studio workspace',
      filters: [{ name: 'Strudel Studio Workspace', extensions: ['json'] }],
      properties: ['openFile'],
    });

    const workspacePath = result.filePaths[0];
    if (result.canceled || !workspacePath) {
      return null;
    }

    const workspace = await readWorkspaceFile(workspacePath);
    const project = await createProjectSnapshot(workspace.projectRoot);
    const openFiles = await Promise.all(
      workspace.openFiles.map(async (file) => {
        const absolutePath = assertInsideProject(workspace.projectRoot, file.relativePath);
        const content = await readFile(absolutePath, 'utf8');
        return {
          absolutePath,
          relativePath: file.relativePath,
          content,
          includedInPlayAll: file.includedInPlayAll,
        };
      }),
    );

    return {
      project,
      openFiles,
      activeFilePath: workspace.activeFilePath,
      savedAt: workspace.savedAt,
      workspacePath,
    };
  });
};
