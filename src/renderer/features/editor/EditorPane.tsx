import { X } from 'lucide-react';
import type { EditorFile } from '../../types/workbench';

type EditorPaneProps = {
  openFiles: EditorFile[];
  activeFile: EditorFile | null;
  onActivateFile: (relativePath: string) => void;
  onCloseFile: (relativePath: string) => void;
  onChangeContent: (relativePath: string, content: string) => void;
};

export const EditorPane = ({
  openFiles,
  activeFile,
  onActivateFile,
  onCloseFile,
  onChangeContent,
}: EditorPaneProps): JSX.Element => {
  return (
    <section className="editor-shell" aria-label="Strudel editor">
      <div className="tab-strip" role="tablist">
        {openFiles.map((file) => (
          <div
            className={`editor-tab ${activeFile?.relativePath === file.relativePath ? 'is-active' : ''}`}
            key={file.relativePath}
          >
            <button type="button" role="tab" onClick={() => onActivateFile(file.relativePath)}>
              <span>{file.name}</span>
              {file.dirty ? <strong className="dirty-dot" aria-label="Unsaved changes" /> : null}
            </button>
            <button type="button" className="tab-close" onClick={() => onCloseFile(file.relativePath)} title="Close file">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {activeFile ? (
        <textarea
          className="code-editor"
          value={activeFile.content}
          spellCheck={false}
          onChange={(event) => onChangeContent(activeFile.relativePath, event.target.value)}
          aria-label={`Editing ${activeFile.relativePath}`}
        />
      ) : (
        <div className="empty-editor">
          <p>Open or create a `.strudel` file.</p>
        </div>
      )}
    </section>
  );
};
