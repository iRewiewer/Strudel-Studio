import type {
  CreateFileRequest,
  AddPluginSourceRequest,
  DeletePluginRequest,
  DeleteThemeRequest,
  OpenFileState,
  PluginScriptBundle,
  ProjectSessionSnapshot,
  ProjectSnapshot,
  RecentProject,
  SaveFileRequest,
  SaveThemeRequest,
  SaveThemeResult,
  SaveWorkspaceRequest,
  StudioPluginSummary,
  StudioThemeSummary,
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

export const removeRecentProject = async (projectRoot: string): Promise<RecentProject[]> => {
  return window.studio.removeRecentProject(projectRoot);
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

export const listStudioThemes = async (): Promise<{ themes: StudioThemeSummary[]; themesDirectory: string }> => {
  return window.studio.listThemes();
};

export const importStudioThemeFile = async (): Promise<SaveThemeResult | null> => {
  return window.studio.importThemeFile();
};

export const saveStudioTheme = async (request: SaveThemeRequest): Promise<SaveThemeResult> => {
  return window.studio.saveTheme(request);
};

export const deleteStudioTheme = async (
  request: DeleteThemeRequest,
): Promise<{ themes: StudioThemeSummary[]; themesDirectory: string }> => {
  return window.studio.deleteTheme(request);
};

export const revealStudioThemesDirectory = async (): Promise<void> => {
  await window.studio.revealThemesDirectory();
};

export const listSystemFonts = async (): Promise<string[]> => {
  return window.studio.listSystemFonts();
};

export const listStudioPlugins = async (): Promise<{ plugins: StudioPluginSummary[]; pluginsDirectory: string }> => {
  return window.studio.listPlugins();
};

export const addStudioPluginSource = async (
  request: AddPluginSourceRequest,
): Promise<{ plugins: StudioPluginSummary[]; pluginsDirectory: string }> => {
  return window.studio.addPluginSource(request);
};

export const importStudioPluginFolder = async (): Promise<{
  plugins: StudioPluginSummary[];
  pluginsDirectory: string;
} | null> => {
  return window.studio.importPluginFolder();
};

export const deleteStudioPlugin = async (
  request: DeletePluginRequest,
): Promise<{ plugins: StudioPluginSummary[]; pluginsDirectory: string }> => {
  return window.studio.deletePlugin(request);
};

export const readStudioPluginScriptBundle = async (pluginPath: string): Promise<PluginScriptBundle> => {
  return window.studio.readPluginScriptBundle(pluginPath);
};

export const revealStudioPluginsDirectory = async (): Promise<void> => {
  await window.studio.revealPluginsDirectory();
};

export const revealExternalSamplesDirectory = async (): Promise<void> => {
  await window.studio.revealExternalSamplesDirectory();
};

export const toOpenFileState = (file: OpenFileState): OpenFileState => ({
  absolutePath: file.absolutePath,
  relativePath: file.relativePath,
  content: file.content,
  includedInPlayAll: file.includedInPlayAll,
  playbackVolume: file.playbackVolume,
});
