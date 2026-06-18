import { Check, Download, FolderOpen, FolderPlus, Plus, PowerOff, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StudioPluginSummary } from '../../../shared/types';

export type PluginLoadState = {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
};

type PluginManagerModalProps = {
  open: boolean;
  plugins: StudioPluginSummary[];
  pluginStates: Record<string, PluginLoadState>;
  pluginsDirectory: string;
  onAddPlugin: (source: string, name: string) => Promise<void>;
  onImportPluginFolder: () => Promise<void>;
  onDeletePlugin: (plugin: StudioPluginSummary) => Promise<void>;
  onLoadPlugin: (plugin: StudioPluginSummary) => Promise<void>;
  onUnloadPlugin: (plugin: StudioPluginSummary) => void;
  onRefreshPlugins: () => Promise<void>;
  onRevealPluginsDirectory: () => Promise<void>;
  onClose: () => void;
};

const getPluginDetail = (plugin: StudioPluginSummary): string => {
  const author = plugin.author.trim() || 'Unknown';
  const version = plugin.pluginVersion.trim().replace(/^v\s*/i, '') || '1.0.0';
  return `${author} - v${version}`;
};

export const PluginManagerModal = ({
  open,
  plugins,
  pluginStates,
  pluginsDirectory,
  onAddPlugin,
  onImportPluginFolder,
  onDeletePlugin,
  onLoadPlugin,
  onUnloadPlugin,
  onRefreshPlugins,
  onRevealPluginsDirectory,
  onClose,
}: PluginManagerModalProps): JSX.Element | null => {
  const [query, setQuery] = useState('');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [pluginName, setPluginName] = useState('');
  const [pluginSource, setPluginSource] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setAddFormOpen(false);
      setPluginName('');
      setPluginSource('');
      setAddError(null);
      setAdding(false);
    }
  }, [open]);

  const filteredPlugins = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return plugins;
    }

    return plugins.filter((plugin) =>
      [
        plugin.name,
        plugin.author,
        plugin.description,
        plugin.source ?? '',
        plugin.path,
        ...plugin.scripts,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [plugins, query]);

  const handleAddPlugin = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAdding(true);
    setAddError(null);

    try {
      await onAddPlugin(pluginSource, pluginName);
      setPluginName('');
      setPluginSource('');
      setAddFormOpen(false);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : String(error));
    } finally {
      setAdding(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="external-samples-modal" role="dialog" aria-modal="true" aria-labelledby="plugins-title">
        <header className="theme-modal-header">
          <div>
            <p className="eyebrow">Runtime</p>
            <h2 id="plugins-title">Plugins</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="external-samples-body">
          <div className="external-samples-toolbar">
            <label className="lookup-search external-samples-search">
              <Search size={15} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search plugins"
                aria-label="Search plugins"
              />
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => void onRevealPluginsDirectory()}
              title={pluginsDirectory || 'Open plugins folder'}
            >
              <FolderOpen size={17} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" onClick={() => void onRefreshPlugins()} title="Refresh plugins">
              <RefreshCw size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => void onImportPluginFolder()}
              title="Import local plugin folder"
            >
              <FolderPlus size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => setAddFormOpen((previous) => !previous)}
              title="Add plugin source"
              aria-expanded={addFormOpen}
            >
              <Plus size={17} aria-hidden="true" />
            </button>
          </div>

          {addFormOpen ? (
            <form className="external-add-form" onSubmit={(event) => void handleAddPlugin(event)}>
              <label>
                <span>Name</span>
                <input
                  value={pluginName}
                  onChange={(event) => setPluginName(event.target.value)}
                  placeholder="Optional display name"
                />
              </label>
              <label>
                <span>Source</span>
                <input
                  value={pluginSource}
                  onChange={(event) => setPluginSource(event.target.value)}
                  placeholder="github:user/repo/branch or https://github.com/user/repo"
                  required
                />
              </label>
              {addError ? <p className="theme-error">{addError}</p> : null}
              <div className="external-add-actions">
                <button type="submit" className="theme-action-button" disabled={adding}>
                  <Download size={16} aria-hidden="true" />
                  {adding ? 'Adding' : 'Add & Load'}
                </button>
              </div>
            </form>
          ) : null}

          <div className="external-pack-list">
            {filteredPlugins.length === 0 ? <p className="detail-line">No matching plugins.</p> : null}
            {filteredPlugins.map((plugin) => {
              const state = pluginStates[plugin.id] ?? { status: 'idle', error: null };
              const loaded = state.status === 'loaded';
              const loading = state.status === 'loading';
              const canLoad = plugin.scripts.length > 0;

              return (
                <article className="external-pack-card" key={plugin.id}>
                  <div className="external-pack-heading">
                    <div>
                      <h3>{plugin.name}</h3>
                      <p>{getPluginDetail(plugin)}</p>
                    </div>
                    <div className="external-pack-actions">
                      {loaded ? (
                        <span className="external-pack-loaded" title="Loaded">
                          <Check size={16} aria-hidden="true" />
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="theme-action-button icon-only"
                        onClick={() => {
                          if (loaded) {
                            onUnloadPlugin(plugin);
                            return;
                          }
                          void onLoadPlugin(plugin);
                        }}
                        disabled={loading || !canLoad}
                        title={loaded ? 'Unload plugin' : loading ? 'Loading plugin' : 'Load plugin'}
                      >
                        {loaded ? <PowerOff size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                      </button>
                      {!loading ? (
                        <button
                          type="button"
                          className="theme-action-button danger icon-only"
                          onClick={() => void onDeletePlugin(plugin)}
                          title="Remove plugin"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p className="external-pack-source">{plugin.description}</p>
                  <p className="external-pack-source">{plugin.source ?? plugin.path}</p>
                  <p className="external-pack-count">
                    {plugin.scripts.length} script{plugin.scripts.length === 1 ? '' : 's'}
                  </p>
                  {state.status === 'error' && state.error ? <p className="theme-error">{state.error}</p> : null}
                  {plugin.scripts.length > 0 ? (
                    <div className="external-pack-preview">
                      {plugin.scripts.map((script) => (
                        <code key={`${plugin.id}-${script}`}>{script}</code>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </main>
      </section>
    </div>
  );
};
