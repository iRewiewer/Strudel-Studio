import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror from '@uiw/react-codemirror';
import { X } from 'lucide-react';
import type { EditorFile, EditorPanelState, EditorSplitDirection } from '../../types/workbench';

type EditorPaneProps = {
  openFiles: EditorFile[];
  panels: EditorPanelState[];
  activePanelId: string;
  splitDirection: EditorSplitDirection;
  onActivatePanel: (panelId: string) => void;
  onActivateFile: (panelId: string, relativePath: string) => void;
  onCloseFile: (relativePath: string) => void;
  onChangeContent: (relativePath: string, content: string) => void;
};

export const EditorPane = ({
  openFiles,
  panels,
  activePanelId,
  splitDirection,
  onActivatePanel,
  onActivateFile,
  onCloseFile,
  onChangeContent,
}: EditorPaneProps): JSX.Element => {
  return (
    <section className={`editor-workspace split-${splitDirection}`} aria-label="Strudel editor">
      {panels.map((panel) => {
        const activeFile = panel.filePath
          ? openFiles.find((file) => file.relativePath === panel.filePath) ?? null
          : null;

        return (
          <div
            className={`editor-shell ${activePanelId === panel.id ? 'is-active-panel' : ''}`}
            key={panel.id}
            onFocus={() => onActivatePanel(panel.id)}
            onMouseDown={() => onActivatePanel(panel.id)}
          >
            <div className="tab-strip" role="tablist">
              {openFiles.map((file) => (
                <div
                  className={`editor-tab ${activeFile?.relativePath === file.relativePath ? 'is-active' : ''}`}
                  key={file.relativePath}
                >
                  <button type="button" role="tab" onClick={() => onActivateFile(panel.id, file.relativePath)}>
                    <span>{file.name}</span>
                    {file.dirty ? <strong className="dirty-dot" aria-label="Unsaved changes" /> : null}
                  </button>
                  <button
                    type="button"
                    className="tab-close"
                    onClick={() => onCloseFile(file.relativePath)}
                    title="Close file"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            {activeFile ? (
              <CodeMirror
                className="code-editor"
                value={activeFile.content}
                height="100%"
                theme={oneDark}
                extensions={[javascript({ jsx: false, typescript: true })]}
                basicSetup={{
                  foldGutter: false,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  lineNumbers: true,
                }}
                onChange={(value) => onChangeContent(activeFile.relativePath, value)}
              />
            ) : (
              <div className="empty-editor">
                <p>Open or create a `.strudel` file.</p>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};
