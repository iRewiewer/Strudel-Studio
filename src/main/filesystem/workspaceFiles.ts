import { readFile, stat } from 'node:fs/promises';
import type { ProjectSessionSnapshot, WorkspaceFile, WorkspaceSnapshot } from '../../shared/types';
import { assertInsideProject, createProjectSnapshot, getWorkspacePath } from './projectFiles';

export const workspaceExists = async (projectRoot: string): Promise<boolean> => {
  const metadata = await stat(getWorkspacePath(projectRoot)).catch(() => null);
  return Boolean(metadata?.isFile());
};

export const readWorkspaceFile = async (workspacePath: string): Promise<WorkspaceFile> => {
  const raw = await readFile(workspacePath, 'utf8');
  const parsed = JSON.parse(raw) as WorkspaceFile;
  if (parsed.version !== 1 || typeof parsed.projectRoot !== 'string') {
    throw new Error('Unsupported workspace file.');
  }
  return parsed;
};

export const loadWorkspaceSnapshot = async (workspacePath: string): Promise<WorkspaceSnapshot> => {
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
        playbackVolume: file.playbackVolume ?? 1,
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
};

export const toProjectSession = (snapshot: WorkspaceSnapshot): ProjectSessionSnapshot => ({
  project: snapshot.project,
  openFiles: snapshot.openFiles,
  activeFilePath: snapshot.activeFilePath,
  savedAt: snapshot.savedAt,
  workspacePath: snapshot.workspacePath,
});

export const createEmptyProjectSession = async (projectRoot: string): Promise<ProjectSessionSnapshot> => {
  return {
    project: await createProjectSnapshot(projectRoot),
    openFiles: [],
    activeFilePath: null,
    savedAt: null,
    workspacePath: null,
  };
};
