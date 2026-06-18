import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror from '@uiw/react-codemirror';
import { AlertTriangle, X } from 'lucide-react';
import type { StudioError } from '../../../shared/types';
import type { PlaybackHighlightRange } from '../../services/strudel/playbackHighlights';
import type { EditorFile, EditorPanelLeaf, EditorPanelNode } from '../../types/workbench';
import { playbackHighlightExtension } from './playbackHighlightExtension';

type EditorPaneProps = {
  openFiles: EditorFile[];
  layout: EditorPanelNode;
  activePanelId: string;
  onActivatePanel: (panelId: string) => void;
  onActivateFile: (panelId: string, relativePath: string) => void;
  onCloseFile: (panelId: string, relativePath: string) => void;
  onChangeContent: (relativePath: string, content: string) => void;
  playbackHighlightRangesByPath: Record<string, PlaybackHighlightRange[]>;
  fileErrorsByPath: Record<string, StudioError>;
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
  playbackHighlightRangesByPath,
  fileErrorsByPath,
}: EditorLeafProps): JSX.Element => {
  const activeFile = panel.filePath
    ? openFiles.find((file) => file.relativePath === panel.filePath) ?? null
    : null;
  const panelFiles = [
    ...new Set([
      ...panel.filePaths,
      ...(panel.filePath ? [panel.filePath] : []),
    ]),
  ]
    .map((relativePath) => openFiles.find((file) => file.relativePath === relativePath) ?? null)
    .filter((file): file is EditorFile => Boolean(file));

  const closeFileFromMiddleClick = (
    event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>,
    relativePath: string,
  ): void => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onCloseFile(panel.id, relativePath);
  };

  const getFileErrorTitle = (error: StudioError): string => {
    const location = error.line
      ? ` Line ${error.line}${error.column ? `, column ${error.column}` : ''}.`
      : '';
    return `Syntax error: ${error.message}.${location}`;
  };

  return (
    <div
      className={`editor-shell ${activePanelId === panel.id ? 'is-active-panel' : ''}`}
      onFocus={() => onActivatePanel(panel.id)}
      onMouseDown={() => onActivatePanel(panel.id)}
    >
      <div className="tab-strip" role="tablist">
        {panelFiles.map((file) => {
          const fileError = fileErrorsByPath[file.relativePath];
          return (
            <div
              className={`editor-tab ${activeFile?.relativePath === file.relativePath ? 'is-active' : ''}`}
              key={file.relativePath}
              onAuxClick={(event) => closeFileFromMiddleClick(event, file.relativePath)}
              onPointerDown={(event) => closeFileFromMiddleClick(event, file.relativePath)}
            >
              <button type="button" role="tab" onClick={() => onActivateFile(panel.id, file.relativePath)}>
                <span className="tab-label">{file.name}</span>
                <span className="tab-indicators">
                  {fileError ? (
                    <span className="syntax-error-dot" title={getFileErrorTitle(fileError)} aria-label="Syntax error">
                      <AlertTriangle size={13} aria-hidden="true" />
                    </span>
                  ) : null}
                  {file.dirty ? <strong className="dirty-dot" aria-label="Unsaved changes" /> : null}
                </span>
              </button>
              <button
                type="button"
                className="tab-close"
                onClick={() => onCloseFile(panel.id, file.relativePath)}
                title="Close file"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {activeFile ? (
        <CodeMirror
          className="code-editor"
          value={activeFile.content}
          height="100%"
          theme={oneDark}
          extensions={[
            javascript({ jsx: false, typescript: true }),
            playbackHighlightExtension(playbackHighlightRangesByPath[activeFile.relativePath] ?? []),
          ]}
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
  playbackHighlightRangesByPath,
  fileErrorsByPath,
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
          playbackHighlightRangesByPath={playbackHighlightRangesByPath}
          fileErrorsByPath={fileErrorsByPath}
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
