import { dialog, ipcMain } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ipcChannels } from '../../shared/ipc';
import type { SaveWorkspaceRequest, WorkspaceFile, WorkspaceSnapshot } from '../../shared/types';
import { getWorkspacePath } from '../filesystem/projectFiles';
import { rememberRecentProject } from '../filesystem/recentProjects';
import { loadWorkspaceSnapshot } from '../filesystem/workspaceFiles';

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
    await rememberRecentProject(request.projectRoot);
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

    return loadWorkspaceSnapshot(workspacePath);
  });
};
