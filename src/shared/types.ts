export type FileId = string;

export type ProjectFile = {
  id: FileId;
  absolutePath: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: string;
};

export type SampleServerInfo = {
  baseUrl: string;
  manifestUrl: string;
  samplesRoot: string;
  sampleCount: number;
};

export type ProjectSnapshot = {
  rootPath: string;
  name: string;
  files: ProjectFile[];
  sampleServer: SampleServerInfo | null;
};

export type OpenFileState = {
  absolutePath: string;
  relativePath: string;
  content: string;
  includedInPlayAll: boolean;
  playbackVolume: number;
};

export type WorkspaceSnapshot = {
  project: ProjectSnapshot;
  openFiles: OpenFileState[];
  activeFilePath: string | null;
  activePanelId: string | null;
  editorLayout: WorkspaceEditorPanelNode | null;
  savedAt: string;
  workspacePath: string;
};

export type ProjectSessionSnapshot = {
  project: ProjectSnapshot;
  openFiles: OpenFileState[];
  activeFilePath: string | null;
  activePanelId: string | null;
  editorLayout: WorkspaceEditorPanelNode | null;
  savedAt: string | null;
  workspacePath: string | null;
};

export type RecentProject = {
  rootPath: string;
  name: string;
  workspacePath: string;
  lastOpenedAt: string;
};

export type ThemeColorKey =
  | 'background'
  | 'surface'
  | 'panel'
  | 'border'
  | 'primary'
  | 'primaryText'
  | 'text'
  | 'mutedText'
  | 'warning'
  | 'danger'
  | 'editorBackground'
  | 'editorText';

export type ThemeFontKey = 'interface' | 'editor';

export type ThemeFontSizeKey = 'interface' | 'editor';

export type StudioTheme = {
  version: 1;
  name: string;
  author: string;
  themeVersion: string;
  colors: Record<ThemeColorKey, string>;
  fonts: Record<ThemeFontKey, string>;
  fontSizes: Record<ThemeFontSizeKey, number>;
};

export type StudioThemeSummary = {
  id: string;
  name: string;
  path: string | null;
  theme: StudioTheme;
};

export type SaveThemeRequest = {
  theme: StudioTheme;
  targetPath?: string | null;
  saveAsNew?: boolean;
};

export type SaveThemeResult = {
  theme: StudioThemeSummary;
  themesDirectory: string;
};

export type DeleteThemeRequest = {
  themePath: string;
};

export type WorkspaceEditorPanelLeaf = {
  type: 'leaf';
  id: string;
  filePath: string | null;
  filePaths?: string[];
};

export type WorkspaceEditorPanelSplit = {
  type: 'split';
  id: string;
  direction: 'vertical' | 'horizontal';
  children: [WorkspaceEditorPanelNode, WorkspaceEditorPanelNode];
};

export type WorkspaceEditorPanelNode = WorkspaceEditorPanelLeaf | WorkspaceEditorPanelSplit;

export type WorkspaceFile = {
  version: 1;
  projectRoot: string;
  openFiles: Array<{
    relativePath: string;
    includedInPlayAll: boolean;
    playbackVolume?: number;
  }>;
  activeFilePath: string | null;
  activePanelId?: string;
  editorLayout?: WorkspaceEditorPanelNode;
  savedAt: string;
};

export type CreateFileRequest = {
  projectRoot: string;
  relativePath: string;
};

export type ReadFileRequest = {
  projectRoot: string;
  relativePath: string;
};

export type SaveFileRequest = {
  projectRoot: string;
  relativePath: string;
  content: string;
};

export type SaveWorkspaceRequest = {
  projectRoot: string;
  openFiles: Array<{
    relativePath: string;
    includedInPlayAll: boolean;
    playbackVolume?: number;
  }>;
  activeFilePath: string | null;
  activePanelId?: string;
  editorLayout?: WorkspaceEditorPanelNode;
};

export type StudioError = {
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  raw?: unknown;
};
