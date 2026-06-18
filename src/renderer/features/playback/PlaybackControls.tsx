import { useEffect, useRef, useState } from 'react';
import {
  Columns2,
  FilePlus2,
  FolderOpen,
  Home,
  Palette,
  PanelTopClose,
  Play,
  Radio,
  Rows2,
  RotateCcw,
  Save,
  SaveAll,
  Square,
} from 'lucide-react';
import type { PlaybackState } from '../../types/workbench';

type PlaybackControlsProps = {
  playback: PlaybackState;
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
  onGoHome: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onOpenThemeSelector: () => void;
  onSplitVertical: () => void;
  onSplitHorizontal: () => void;
  onClosePanel: () => void;
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
  panelCount,
  onPlayActive,
  onPlayAll,
  onStop,
  onPanic,
  onSaveActive,
  onSaveAll,
  onGoHome,
  onNewProject,
  onOpenProject,
  onOpenThemeSelector,
  onSplitVertical,
  onSplitHorizontal,
  onClosePanel,
  canPlayActive,
  canPlayAll,
  canSaveActive,
  canSaveAll,
}: PlaybackControlsProps): JSX.Element => {
  const isBusy = playback.status === 'starting';
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!fileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && !fileMenuRef.current?.contains(target)) {
        setFileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setFileMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fileMenuOpen]);

  const closeFileMenu = (): void => setFileMenuOpen(false);

  return (
    <header className="topbar">
      <details className="menu-dropdown" open={fileMenuOpen} ref={fileMenuRef}>
        <summary
          onClick={(event) => {
            event.preventDefault();
            setFileMenuOpen((previous) => !previous);
          }}
        >
          File
        </summary>
        <div className="menu-panel">
          <button type="button" onClick={() => { closeFileMenu(); onGoHome(); }}>
            <Home size={15} aria-hidden="true" />
            Back to Main Menu
          </button>
          <button type="button" onClick={() => { closeFileMenu(); onNewProject(); }}>
            <FilePlus2 size={15} aria-hidden="true" />
            New Project
          </button>
          <button type="button" onClick={() => { closeFileMenu(); onOpenProject(); }}>
            <FolderOpen size={15} aria-hidden="true" />
            Open Project
          </button>
          <button type="button" onClick={() => { closeFileMenu(); onOpenThemeSelector(); }}>
            <Palette size={15} aria-hidden="true" />
            Theme Selector
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
      </div>
    </header>
  );
};
