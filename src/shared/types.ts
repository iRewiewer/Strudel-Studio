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
};

export type WorkspaceSnapshot = {
  project: ProjectSnapshot;
  openFiles: OpenFileState[];
  activeFilePath: string | null;
  savedAt: string;
  workspacePath: string;
};

export type ProjectSessionSnapshot = {
  project: ProjectSnapshot;
  openFiles: OpenFileState[];
  activeFilePath: string | null;
  savedAt: string | null;
  workspacePath: string | null;
};

export type RecentProject = {
  rootPath: string;
  name: string;
  workspacePath: string;
  lastOpenedAt: string;
};

export type WorkspaceFile = {
  version: 1;
  projectRoot: string;
  openFiles: Array<{
    relativePath: string;
    includedInPlayAll: boolean;
  }>;
  activeFilePath: string | null;
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
  }>;
  activeFilePath: string | null;
};

export type StudioError = {
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  raw?: unknown;
};
