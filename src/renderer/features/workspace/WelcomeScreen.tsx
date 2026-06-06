import { FolderOpen, Upload } from 'lucide-react';

type WelcomeScreenProps = {
  onOpenProject: () => void;
  onLoadWorkspace: () => void;
  busy: boolean;
};

export const WelcomeScreen = ({ onOpenProject, onLoadWorkspace, busy }: WelcomeScreenProps): JSX.Element => {
  return (
    <main className="welcome-screen">
      <section className="welcome-copy">
        <p className="eyebrow">Strudel Studio</p>
        <h1>Local-first Strudel live coding</h1>
        <p>
          Work with real project files, keep multiple patterns open, and perform checked files together.
        </p>
        <div className="welcome-actions">
          <button type="button" className="primary-action" onClick={onOpenProject} disabled={busy}>
            <FolderOpen size={18} aria-hidden="true" />
            Open Project
          </button>
          <button type="button" className="secondary-action" onClick={onLoadWorkspace} disabled={busy}>
            <Upload size={18} aria-hidden="true" />
            Load Workspace
          </button>
        </div>
      </section>
    </main>
  );
};
