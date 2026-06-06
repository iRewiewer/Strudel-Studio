import { AlertTriangle, FolderTree, Music } from 'lucide-react';
import type { SampleServerInfo, StudioError } from '../../../shared/types';

type InspectorPanelProps = {
  sampleServer: SampleServerInfo | null;
  playbackError: StudioError | null;
  workspacePath: string | null;
};

export const InspectorPanel = ({
  sampleServer,
  playbackError,
  workspacePath,
}: InspectorPanelProps): JSX.Element => {
  return (
    <aside className="sidebar sidebar-right" aria-label="Playback details">
      <section className="inspector-section">
        <div className="section-title">
          <Music size={16} aria-hidden="true" />
          <h2>Playback</h2>
        </div>
        <p className="detail-line">Mode: combined fallback</p>
        <p className="detail-line">Update: live re-evaluate</p>
      </section>

      <section className="inspector-section">
        <div className="section-title">
          <FolderTree size={16} aria-hidden="true" />
          <h2>Samples</h2>
        </div>
        {sampleServer ? (
          <>
            <p className="detail-line">{sampleServer.sampleCount} local names</p>
            <p className="path-label" title={sampleServer.manifestUrl}>
              {sampleServer.manifestUrl}
            </p>
          </>
        ) : (
          <p className="detail-line">No local samples folder</p>
        )}
      </section>

      <section className="inspector-section">
        <div className="section-title">
          <FolderTree size={16} aria-hidden="true" />
          <h2>Workspace</h2>
        </div>
        <p className="path-label" title={workspacePath ?? undefined}>
          {workspacePath ?? 'Not saved yet'}
        </p>
      </section>

      {playbackError ? (
        <section className="inspector-section error-section">
          <div className="section-title">
            <AlertTriangle size={16} aria-hidden="true" />
            <h2>Error</h2>
          </div>
          {playbackError.filePath ? <p className="detail-line">{playbackError.filePath}</p> : null}
          {playbackError.line ? (
            <p className="detail-line">
              line {playbackError.line}
              {playbackError.column ? `, column ${playbackError.column}` : ''}
            </p>
          ) : null}
          <pre>{playbackError.message}</pre>
        </section>
      ) : null}
    </aside>
  );
};
