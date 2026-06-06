import type {
  CreateFileRequest,
  OpenFileState,
  ProjectSessionSnapshot,
  ProjectSnapshot,
  RecentProject,
  SaveFileRequest,
  SaveWorkspaceRequest,
  WorkspaceSnapshot,
} from '../../../shared/types';

export const newProjectFolder = async (): Promise<ProjectSessionSnapshot | null> => {
  return window.studio.newProjectFolder();
};

export const openProjectFolder = async (): Promise<ProjectSessionSnapshot | null> => {
  return window.studio.openProjectFolder();
};

export const openRecentProject = async (projectRoot: string): Promise<ProjectSessionSnapshot | null> => {
  return window.studio.openRecentProject(projectRoot);
};

export const listRecentProjects = async (): Promise<RecentProject[]> => {
  return window.studio.listRecentProjects();
};

export const createStrudelFile = async (request: CreateFileRequest): Promise<ProjectSnapshot> => {
  return window.studio.createStrudelFile(request);
};

export const readProjectFile = async (projectRoot: string, relativePath: string): Promise<string> => {
  return window.studio.readFile({ projectRoot, relativePath });
};

export const saveProjectFile = async (request: SaveFileRequest): Promise<void> => {
  await window.studio.saveFile(request);
};

export const saveWorkspaceFile = async (request: SaveWorkspaceRequest): Promise<string> => {
  return window.studio.saveWorkspace(request);
};

export const loadWorkspaceFile = async (): Promise<WorkspaceSnapshot | null> => {
  return window.studio.loadWorkspace();
};

export const toOpenFileState = (file: OpenFileState): OpenFileState => ({
  absolutePath: file.absolutePath,
  relativePath: file.relativePath,
  content: file.content,
  includedInPlayAll: file.includedInPlayAll,
});
