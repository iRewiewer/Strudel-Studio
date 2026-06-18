import type { ProjectFile, ProjectSnapshot, SampleServerInfo, StudioError } from '../../shared/types';

export type EditorFile = ProjectFile & {
  content: string;
  dirty: boolean;
  includedInPlayAll: boolean;
  playbackVolume: number;
  isOpen: boolean;
};

export type PlaybackMode = 'single' | 'all';

export type PlaybackStatus = 'stopped' | 'starting' | 'playing' | 'error';

export type PlaybackState = {
  status: PlaybackStatus;
  mode: PlaybackMode | null;
  activeFilePaths: string[];
  updatedAt: string | null;
  error: StudioError | null;
};

export type WorkbenchProject = ProjectSnapshot & {
  sampleServer: SampleServerInfo | null;
};

export type EditorSplitDirection = 'vertical' | 'horizontal';

export type EditorPanelLeaf = {
  type: 'leaf';
  id: string;
  filePath: string | null;
  filePaths: string[];
};

export type EditorPanelSplit = {
  type: 'split';
  id: string;
  direction: EditorSplitDirection;
  children: [EditorPanelNode, EditorPanelNode];
};

export type EditorPanelNode = EditorPanelLeaf | EditorPanelSplit;

export type StudioSettings = {
  keepPlayAllSelectionOnClose: boolean;
  openFileOnInclude: boolean;
  liveReevaluate: boolean;
};

export const stoppedPlaybackState: PlaybackState = {
  status: 'stopped',
  mode: null,
  activeFilePaths: [],
  updatedAt: null,
  error: null,
};
