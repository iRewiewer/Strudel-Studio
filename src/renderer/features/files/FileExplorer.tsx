import { Check, FileCode2, FilePlus2, FolderOpen } from 'lucide-react';
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
  onOpenProject: () => void;
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
  onOpenProject,
}: FileExplorerProps): JSX.Element => {
  return (
    <aside className="sidebar sidebar-left" aria-label="Project files">
      <div className="sidebar-heading">
        <div>
          <p className="eyebrow">Project</p>
          <h2>{projectName}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onOpenProject} title="Open project">
          <FolderOpen size={18} aria-hidden="true" />
        </button>
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
                <span>{file.relativePath}</span>
                {dirty ? <strong className="dirty-dot" aria-label="Unsaved changes" /> : null}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
