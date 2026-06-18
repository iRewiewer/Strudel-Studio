import { Check, FileCode2, FilePlus2, FolderOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ProjectFile } from '../../../shared/types';
import type { EditorFile } from '../../types/workbench';

type FileExplorerProps = {
  projectName: string;
  projectRoot: string;
  files: ProjectFile[];
  openFilesByPath: Record<string, EditorFile>;
  activeFilePath: string | null;
  newFileName: string;
  onNewFileNameChange: (value: string) => void;
  onCreateFile: () => void;
  onOpenFile: (relativePath: string) => void;
  onToggleIncluded: (relativePath: string, included: boolean) => void;
  onPlaybackVolumeChange: (relativePath: string, volume: number) => void;
  onOpenProject: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const formatFileLabel = (relativePath: string): string => {
  return relativePath.replace(/\.strudel$/i, '');
};

export const FileExplorer = ({
  projectName,
  projectRoot,
  files,
  openFilesByPath,
  activeFilePath,
  newFileName,
  onNewFileNameChange,
  onCreateFile,
  onOpenFile,
  onToggleIncluded,
  onPlaybackVolumeChange,
  onOpenProject,
  collapsed,
  onToggleCollapsed,
}: FileExplorerProps): JSX.Element => {
  if (collapsed) {
    return (
      <aside className="sidebar sidebar-left is-collapsed" aria-label="Project files">
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={onToggleCollapsed}
          title="Expand project sidebar"
          aria-label="Expand project sidebar"
        >
          <PanelLeftOpen size={17} aria-hidden="true" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar sidebar-left" aria-label="Project files">
      <div className="sidebar-heading">
        <div>
          <p className="eyebrow">Project</p>
          <h2>{projectName}</h2>
        </div>
        <div className="sidebar-heading-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onToggleCollapsed}
            title="Collapse project sidebar"
            aria-label="Collapse project sidebar"
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" onClick={onOpenProject} title="Open project">
            <FolderOpen size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="path-label" title={projectRoot}>
        {projectRoot}
      </p>

      <div className="new-file-row">
        <input
          value={newFileName}
          onChange={(event) => onNewFileNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onCreateFile();
            }
          }}
          placeholder="drums.strudel"
          aria-label="New Strudel file name"
        />
        <button type="button" className="icon-button" onClick={onCreateFile} title="Create file">
          <FilePlus2 size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="file-list" role="list">
        {files.map((file) => {
          const openFile = openFilesByPath[file.relativePath];
          const included = openFile?.includedInPlayAll ?? false;
          const dirty = openFile?.dirty ?? false;
          const playbackVolume = openFile?.playbackVolume ?? 1;
          return (
            <div
              className={`file-row ${activeFilePath === file.relativePath ? 'is-active' : ''}`}
              key={file.relativePath}
              role="listitem"
            >
              <label className="include-toggle" title="Include in Play All">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(event) => onToggleIncluded(file.relativePath, event.target.checked)}
                />
                <span aria-hidden="true">{included ? <Check size={14} /> : null}</span>
              </label>
              <button type="button" className="file-open-button" onClick={() => onOpenFile(file.relativePath)}>
                <FileCode2 size={16} aria-hidden="true" />
                <span>{formatFileLabel(file.relativePath)}</span>
                {dirty ? <strong className="dirty-dot" aria-label="Unsaved changes" /> : null}
              </button>
              <label className="volume-slider" title={`Volume ${Math.round(playbackVolume * 100)}%`}>
                <span>Vol</span>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.01"
                  value={playbackVolume}
                  onChange={(event) => onPlaybackVolumeChange(file.relativePath, Number(event.target.value))}
                />
              </label>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
