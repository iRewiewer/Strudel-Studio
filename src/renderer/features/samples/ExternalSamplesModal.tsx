import { Check, CloudDownload, Download, FolderOpen, Plus, PowerOff, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  ExternalSamplePack,
  ExternalSamplePackState,
} from '../../services/strudel/externalSamplePacks';

type ExternalSamplesModalProps = {
  open: boolean;
  packs: ExternalSamplePack[];
  packStates: Record<string, ExternalSamplePackState>;
  onLoadPack: (pack: ExternalSamplePack) => Promise<void>;
  onAddPack: (source: string, name: string) => Promise<void>;
  onDeletePack: (pack: ExternalSamplePack) => void;
  onUnloadPack: (pack: ExternalSamplePack) => void;
  onCachePack: (pack: ExternalSamplePack) => Promise<void>;
  onRevealSamplesDirectory: () => Promise<void>;
  onClose: () => void;
};

export const ExternalSamplesModal = ({
  open,
  packs,
  packStates,
  onLoadPack,
  onAddPack,
  onDeletePack,
  onUnloadPack,
  onCachePack,
  onRevealSamplesDirectory,
  onClose,
}: ExternalSamplesModalProps): JSX.Element | null => {
  const [query, setQuery] = useState('');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customSource, setCustomSource] = useState('');
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
      setCustomName('');
      setCustomSource('');
      setAddError(null);
      setAdding(false);
    }
  }, [open]);

  const filteredPacks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return packs;
    }

    return packs.filter((pack) =>
      [pack.name, pack.description, pack.source].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [packs, query]);

  const handleAddPack = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAdding(true);
    setAddError(null);

    try {
      await onAddPack(customSource, customName);
      setCustomName('');
      setCustomSource('');
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
      <section className="external-samples-modal" role="dialog" aria-modal="true" aria-labelledby="external-samples-title">
        <header className="theme-modal-header">
          <div>
            <p className="eyebrow">Samples</p>
            <h2 id="external-samples-title">External Samples</h2>
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
                placeholder="Search packs"
                aria-label="Search external sample packs"
              />
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => void onRevealSamplesDirectory()}
              title="Open external samples folder"
            >
              <FolderOpen size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => setAddFormOpen((previous) => !previous)}
              title="Add external source"
              aria-expanded={addFormOpen}
            >
              <Plus size={17} aria-hidden="true" />
            </button>
          </div>

          {addFormOpen ? (
            <form className="external-add-form" onSubmit={(event) => void handleAddPack(event)}>
              <label>
                <span>Name</span>
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder="Optional display name"
                />
              </label>
              <label>
                <span>Source</span>
                <input
                  value={customSource}
                  onChange={(event) => setCustomSource(event.target.value)}
                  placeholder="github:user/repo/branch or https://.../strudel.json"
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
            {filteredPacks.length === 0 ? <p className="detail-line">No matching external sample packs.</p> : null}
            {filteredPacks.map((pack) => {
              const state = packStates[pack.id];
              const loaded = state?.status === 'loaded';
              const loading = state?.status === 'loading';
              const caching = state?.cacheStatus === 'caching';
              const cached = state?.cacheStatus === 'cached';
              const cacheError = state?.cacheStatus === 'error' ? state.cacheError : null;
              const fileCount = state?.files.length ?? 0;
              const previewNames = state?.names.slice(0, 24) ?? [];

              return (
                <article className="external-pack-card" key={pack.id}>
                  <div className="external-pack-heading">
                    <div>
                      <h3>{pack.name}</h3>
                      <p>{pack.description}</p>
                    </div>
                    <div className="external-pack-actions">
                      {loaded ? (
                        <span className="external-pack-loaded" title="Loaded">
                          <Check size={16} aria-hidden="true" />
                        </span>
                      ) : null}
                      {loaded ? (
                        <button
                          type="button"
                          className="theme-action-button icon-only"
                          onClick={() => void onCachePack(pack)}
                          disabled={caching || cached || fileCount === 0}
                          title={
                            cached
                              ? 'Samples cached'
                              : caching
                                ? 'Caching samples'
                                : fileCount === 0
                                  ? 'No audio files to cache'
                                  : 'Cache audio files'
                          }
                        >
                          {cached ? (
                            <Check size={16} aria-hidden="true" />
                          ) : (
                            <CloudDownload size={16} aria-hidden="true" />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="theme-action-button icon-only"
                        onClick={() => {
                          if (loaded) {
                            onUnloadPack(pack);
                            return;
                          }
                          void onLoadPack(pack);
                        }}
                        disabled={loading}
                        title={loaded ? 'Unload pack' : loading ? 'Loading pack' : 'Load pack'}
                      >
                        {loaded ? <PowerOff size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                      </button>
                      {!loading ? (
                        <button
                          type="button"
                          className="theme-action-button danger icon-only"
                          onClick={() => onDeletePack(pack)}
                          title="Remove external source"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p className="external-pack-source">{pack.source}</p>

                  {state?.status === 'error' ? <p className="theme-error">{state.error}</p> : null}
                  {loaded ? (
                    <>
                      <p className="external-pack-count">
                        {state.names.length} sounds indexed - {state.files.length} files
                      </p>
                      {caching ? (
                        <p className="external-pack-count">
                          Caching {state.cachedFileCount}/{state.files.length} files
                        </p>
                      ) : null}
                      {cached ? <p className="external-pack-count">{state.cachedFileCount} files cached</p> : null}
                      {cacheError ? <p className="theme-error">{cacheError}</p> : null}
                      <div className="external-pack-preview">
                        {previewNames.map((name) => (
                          <code key={`${pack.id}-${name}`}>{name}</code>
                        ))}
                      </div>
                    </>
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
