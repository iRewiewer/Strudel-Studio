import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror from '@uiw/react-codemirror';
import { X } from 'lucide-react';
import type { EditorFile, EditorPanelLeaf, EditorPanelNode } from '../../types/workbench';

type EditorPaneProps = {
  openFiles: EditorFile[];
  layout: EditorPanelNode;
  activePanelId: string;
  onActivatePanel: (panelId: string) => void;
  onActivateFile: (panelId: string, relativePath: string) => void;
  onCloseFile: (relativePath: string) => void;
  onChangeContent: (relativePath: string, content: string) => void;
};

type EditorLeafProps = Omit<EditorPaneProps, 'layout'> & {
  panel: EditorPanelLeaf;
};

const EditorLeaf = ({
  openFiles,
  panel,
  activePanelId,
  onActivatePanel,
  onActivateFile,
  onCloseFile,
  onChangeContent,
}: EditorLeafProps): JSX.Element => {
  const activeFile = panel.filePath
    ? openFiles.find((file) => file.relativePath === panel.filePath) ?? null
    : null;

  return (
    <div
      className={`editor-shell ${activePanelId === panel.id ? 'is-active-panel' : ''}`}
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
};

export const EditorPane = ({
  openFiles,
  layout,
  activePanelId,
  onActivatePanel,
  onActivateFile,
  onCloseFile,
  onChangeContent,
}: EditorPaneProps): JSX.Element => {
  const renderNode = (node: EditorPanelNode): JSX.Element => {
    if (node.type === 'leaf') {
      return (
        <EditorLeaf
          key={node.id}
          openFiles={openFiles}
          panel={node}
          activePanelId={activePanelId}
          onActivatePanel={onActivatePanel}
          onActivateFile={onActivateFile}
          onCloseFile={onCloseFile}
          onChangeContent={onChangeContent}
        />
      );
    }

    return (
      <div className={`editor-split split-${node.direction}`} key={node.id}>
        {renderNode(node.children[0])}
        {renderNode(node.children[1])}
      </div>
    );
  };

  return (
    <section className="editor-workspace" aria-label="Strudel editor">
      {renderNode(layout)}
    </section>
  );
};
