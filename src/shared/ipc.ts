import type {
  CreateFileRequest,
  ProjectSessionSnapshot,
  ProjectSnapshot,
  ReadFileRequest,
  RecentProject,
  SaveFileRequest,
  SaveWorkspaceRequest,
  WorkspaceSnapshot,
} from './types';

export type StudioApi = {
  onCloseRequested: (callback: () => void) => () => void;
  confirmClose: (shouldClose: boolean) => Promise<void>;
  newProjectFolder: () => Promise<ProjectSessionSnapshot | null>;
  openProjectFolder: () => Promise<ProjectSessionSnapshot | null>;
  openRecentProject: (projectRoot: string) => Promise<ProjectSessionSnapshot | null>;
  listRecentProjects: () => Promise<RecentProject[]>;
  createStrudelFile: (request: CreateFileRequest) => Promise<ProjectSnapshot>;
  readFile: (request: ReadFileRequest) => Promise<string>;
  saveFile: (request: SaveFileRequest) => Promise<void>;
  saveWorkspace: (request: SaveWorkspaceRequest) => Promise<string>;
  loadWorkspace: () => Promise<WorkspaceSnapshot | null>;
};

export const ipcChannels = {
  closeRequested: 'studio:close-requested',
  confirmClose: 'studio:confirm-close',
  newProjectFolder: 'studio:new-project-folder',
  openProjectFolder: 'studio:open-project-folder',
  openRecentProject: 'studio:open-recent-project',
  listRecentProjects: 'studio:list-recent-projects',
  createStrudelFile: 'studio:create-strudel-file',
  readFile: 'studio:read-file',
  saveFile: 'studio:save-file',
  saveWorkspace: 'studio:save-workspace',
  loadWorkspace: 'studio:load-workspace',
} as const;
