import type {
  CreateFileRequest,
  OpenFileState,
  ProjectSnapshot,
  SaveFileRequest,
  SaveWorkspaceRequest,
  WorkspaceSnapshot,
} from '../../../shared/types';

export const openProjectFolder = async (): Promise<ProjectSnapshot | null> => {
  return window.studio.openProjectFolder();
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
