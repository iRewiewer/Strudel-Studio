import type {
  CreateFileRequest,
  DeleteThemeRequest,
  ProjectSessionSnapshot,
  ProjectSnapshot,
  ReadFileRequest,
  RecentProject,
  SaveFileRequest,
  SaveThemeRequest,
  SaveThemeResult,
  SaveWorkspaceRequest,
  StudioThemeSummary,
  WorkspaceSnapshot,
} from './types';

export type StudioApi = {
  onCloseRequested: (callback: () => void) => () => void;
  confirmClose: (shouldClose: boolean) => Promise<void>;
  newProjectFolder: () => Promise<ProjectSessionSnapshot | null>;
  openProjectFolder: () => Promise<ProjectSessionSnapshot | null>;
  openRecentProject: (projectRoot: string) => Promise<ProjectSessionSnapshot | null>;
  listRecentProjects: () => Promise<RecentProject[]>;
  removeRecentProject: (projectRoot: string) => Promise<RecentProject[]>;
  createStrudelFile: (request: CreateFileRequest) => Promise<ProjectSnapshot>;
  readFile: (request: ReadFileRequest) => Promise<string>;
  saveFile: (request: SaveFileRequest) => Promise<void>;
  saveWorkspace: (request: SaveWorkspaceRequest) => Promise<string>;
  loadWorkspace: () => Promise<WorkspaceSnapshot | null>;
  listThemes: () => Promise<{ themes: StudioThemeSummary[]; themesDirectory: string }>;
  importThemeFile: () => Promise<SaveThemeResult | null>;
  saveTheme: (request: SaveThemeRequest) => Promise<SaveThemeResult>;
  deleteTheme: (request: DeleteThemeRequest) => Promise<{ themes: StudioThemeSummary[]; themesDirectory: string }>;
  revealThemesDirectory: () => Promise<void>;
  listSystemFonts: () => Promise<string[]>;
};

export const ipcChannels = {
  closeRequested: 'studio:close-requested',
  confirmClose: 'studio:confirm-close',
  newProjectFolder: 'studio:new-project-folder',
  openProjectFolder: 'studio:open-project-folder',
  openRecentProject: 'studio:open-recent-project',
  listRecentProjects: 'studio:list-recent-projects',
  removeRecentProject: 'studio:remove-recent-project',
  createStrudelFile: 'studio:create-strudel-file',
  readFile: 'studio:read-file',
  saveFile: 'studio:save-file',
  saveWorkspace: 'studio:save-workspace',
  loadWorkspace: 'studio:load-workspace',
  listThemes: 'studio:list-themes',
  importThemeFile: 'studio:import-theme-file',
  saveTheme: 'studio:save-theme',
  deleteTheme: 'studio:delete-theme',
  revealThemesDirectory: 'studio:reveal-themes-directory',
  listSystemFonts: 'studio:list-system-fonts',
} as const;
