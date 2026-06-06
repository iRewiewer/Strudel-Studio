import type {
  CreateFileRequest,
  ProjectSnapshot,
  ReadFileRequest,
  SaveFileRequest,
  SaveWorkspaceRequest,
  WorkspaceSnapshot,
} from './types';

export type StudioApi = {
  openProjectFolder: () => Promise<ProjectSnapshot | null>;
  createStrudelFile: (request: CreateFileRequest) => Promise<ProjectSnapshot>;
  readFile: (request: ReadFileRequest) => Promise<string>;
  saveFile: (request: SaveFileRequest) => Promise<void>;
  saveWorkspace: (request: SaveWorkspaceRequest) => Promise<string>;
  loadWorkspace: () => Promise<WorkspaceSnapshot | null>;
};

export const ipcChannels = {
  openProjectFolder: 'studio:open-project-folder',
  createStrudelFile: 'studio:create-strudel-file',
  readFile: 'studio:read-file',
  saveFile: 'studio:save-file',
  saveWorkspace: 'studio:save-workspace',
  loadWorkspace: 'studio:load-workspace',
} as const;
