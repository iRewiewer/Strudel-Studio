import { Play, Radio, RotateCcw, Save, SaveAll, Square } from 'lucide-react';
import type { PlaybackState } from '../../types/workbench';

type PlaybackControlsProps = {
  playback: PlaybackState;
  activeFileName: string | null;
  includedCount: number;
  dirtyCount: number;
  onPlayActive: () => void;
  onPlayAll: () => void;
  onStop: () => void;
  onPanic: () => void;
  onSaveActive: () => void;
  onSaveAll: () => void;
  onSaveWorkspace: () => void;
  canPlayActive: boolean;
  canPlayAll: boolean;
  canSaveActive: boolean;
  canSaveAll: boolean;
};

export const PlaybackControls = ({
  playback,
  activeFileName,
  includedCount,
  dirtyCount,
  onPlayActive,
  onPlayAll,
  onStop,
  onPanic,
  onSaveActive,
  onSaveAll,
  onSaveWorkspace,
  canPlayActive,
  canPlayAll,
  canSaveActive,
  canSaveAll,
}: PlaybackControlsProps): JSX.Element => {
  const isBusy = playback.status === 'starting';

  return (
    <header className="topbar">
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
        <button type="button" className="toolbar-button" onClick={onSaveWorkspace}>
          <SaveAll size={16} aria-hidden="true" />
          Workspace
        </button>
      </div>
    </header>
  );
};
