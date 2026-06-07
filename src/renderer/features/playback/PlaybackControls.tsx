import {
  Columns2,
  FilePlus2,
  FolderOpen,
  Home,
  MoreVertical,
  PanelTopClose,
  Play,
  Radio,
  Rows2,
  RotateCcw,
  Save,
  SaveAll,
  Square,
} from 'lucide-react';
import type { PlaybackState, StudioSettings } from '../../types/workbench';

type PlaybackControlsProps = {
  playback: PlaybackState;
  settings: StudioSettings;
  activeFileName: string | null;
  includedCount: number;
  dirtyCount: number;
  panelCount: number;
  onPlayActive: () => void;
  onPlayAll: () => void;
  onStop: () => void;
  onPanic: () => void;
  onSaveActive: () => void;
  onSaveAll: () => void;
  onSaveWorkspace: () => void;
  onGoHome: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSplitVertical: () => void;
  onSplitHorizontal: () => void;
  onClosePanel: () => void;
  onToggleKeepSelectionOnClose: (enabled: boolean) => void;
  canPlayActive: boolean;
  canPlayAll: boolean;
  canSaveActive: boolean;
  canSaveAll: boolean;
};

export const PlaybackControls = ({
  playback,
  settings,
  activeFileName,
  includedCount,
  dirtyCount,
  panelCount,
  onPlayActive,
  onPlayAll,
  onStop,
  onPanic,
  onSaveActive,
  onSaveAll,
  onSaveWorkspace,
  onGoHome,
  onNewProject,
  onOpenProject,
  onSplitVertical,
  onSplitHorizontal,
  onClosePanel,
  onToggleKeepSelectionOnClose,
  canPlayActive,
  canPlayAll,
  canSaveActive,
  canSaveAll,
}: PlaybackControlsProps): JSX.Element => {
  const isBusy = playback.status === 'starting';

  return (
    <header className="topbar">
      <details className="menu-dropdown">
        <summary>File</summary>
        <div className="menu-panel">
          <button type="button" onClick={onGoHome}>
            <Home size={15} aria-hidden="true" />
            Back to Main Menu
          </button>
          <button type="button" onClick={onNewProject}>
            <FilePlus2 size={15} aria-hidden="true" />
            New Project
          </button>
          <button type="button" onClick={onOpenProject}>
            <FolderOpen size={15} aria-hidden="true" />
            Open Project
          </button>
        </div>
      </details>

      <div className="transport-group">
        <button type="button" className="transport-button" onClick={onPlayActive} disabled={!canPlayActive || isBusy}>
          <Play size={17} aria-hidden="true" />
          Play
        </button>
        <button type="button" className="transport-button play-all" onClick={onPlayAll} disabled={!canPlayAll || isBusy}>
          <Radio size={17} aria-hidden="true" />
          Play All
        </button>
        <button type="button" className="transport-icon" onClick={onStop} disabled={playback.status === 'stopped'} title="Stop">
          <Square size={17} aria-hidden="true" />
        </button>
        <button type="button" className="transport-icon danger" onClick={onPanic} title="Panic">
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="status-pill" data-state={playback.status}>
        <span />
        {playback.status === 'playing'
          ? playback.mode === 'all'
            ? `${includedCount} files playing`
            : activeFileName ?? 'Playing'
          : playback.status}
      </div>

      <div className="editor-actions">
        <button type="button" className="transport-icon" onClick={onSplitVertical} title="Split vertically">
          <Columns2 size={17} aria-hidden="true" />
        </button>
        <button type="button" className="transport-icon" onClick={onSplitHorizontal} title="Split horizontally">
          <Rows2 size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="transport-icon"
          onClick={onClosePanel}
          disabled={panelCount <= 1}
          title="Close active panel"
        >
          <PanelTopClose size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="save-group">
        <button type="button" className="toolbar-button" onClick={onSaveActive} disabled={!canSaveActive}>
          <Save size={16} aria-hidden="true" />
          Save
        </button>
        <button type="button" className="toolbar-button" onClick={onSaveAll} disabled={!canSaveAll}>
          <SaveAll size={16} aria-hidden="true" />
          Save All
          {dirtyCount > 0 ? <span className="count-badge">{dirtyCount}</span> : null}
        </button>
        <details className="icon-menu-dropdown">
          <summary title="More actions">
            <MoreVertical size={17} aria-hidden="true" />
          </summary>
          <div className="menu-panel align-right">
            <button type="button" onClick={onSaveWorkspace}>
              <SaveAll size={15} aria-hidden="true" />
              Save Workspace
            </button>
            <label className="menu-check">
              <input
                type="checkbox"
                checked={settings.keepPlayAllSelectionOnClose}
                onChange={(event) => onToggleKeepSelectionOnClose(event.target.checked)}
              />
              Keep Play All selection on close
            </label>
          </div>
        </details>
      </div>
    </header>
  );
};
