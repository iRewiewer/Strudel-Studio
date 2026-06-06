import type { ProjectFile, ProjectSnapshot, SampleServerInfo, StudioError } from '../../shared/types';

export type EditorFile = ProjectFile & {
  content: string;
  dirty: boolean;
  includedInPlayAll: boolean;
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

export const stoppedPlaybackState: PlaybackState = {
  status: 'stopped',
  mode: null,
  activeFilePaths: [],
  updatedAt: null,
  error: null,
};
