import { Clock3, FolderOpen, Plus, X } from 'lucide-react';
import type { RecentProject } from '../../../shared/types';

type WelcomeScreenProps = {
  recentProjects: RecentProject[];
  onNewProject: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (projectRoot: string) => void;
  onRemoveRecentProject: (projectRoot: string) => void;
  busy: boolean;
};

export const WelcomeScreen = ({
  recentProjects,
  onNewProject,
  onOpenProject,
  onOpenRecentProject,
  onRemoveRecentProject,
  busy,
}: WelcomeScreenProps): JSX.Element => {
  return (
    <main className="welcome-screen">
      <section className="welcome-copy">
        <p className="eyebrow">Strudel Studio</p>
        <h1>Local-first Strudel live coding</h1>
        <p>
          Work with real project files, keep multiple patterns open, and perform checked files together.
        </p>
        <div className="welcome-actions">
          <button type="button" className="primary-action" onClick={onNewProject} disabled={busy}>
            <Plus size={18} aria-hidden="true" />
            New Project
          </button>
          <button type="button" className="secondary-action" onClick={onOpenProject} disabled={busy}>
            <FolderOpen size={18} aria-hidden="true" />
            Open Project
          </button>
        </div>
      </section>

      <aside className="recent-panel" aria-label="Recent projects">
        <div className="section-title">
          <Clock3 size={16} aria-hidden="true" />
          <h2>Recent Projects</h2>
        </div>
        {recentProjects.length > 0 ? (
          <div className="recent-list">
            {recentProjects.map((project) => (
              <div className="recent-project-row" key={project.rootPath}>
                <button
                  type="button"
                  className="recent-project"
                  onClick={() => onOpenRecentProject(project.rootPath)}
                  disabled={busy}
                >
                  <span>{project.name}</span>
                  <small>{project.rootPath}</small>
                </button>
                <button
                  type="button"
                  className="recent-remove"
                  onClick={() => onRemoveRecentProject(project.rootPath)}
                  disabled={busy}
                  title="Remove from recents"
                  aria-label={`Remove ${project.name} from recents`}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="detail-line">No recent projects yet.</p>
        )}
      </aside>
    </main>
  );
};
