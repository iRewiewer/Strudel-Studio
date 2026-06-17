import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, Plus, Save, X } from 'lucide-react';
import type { StudioTheme, StudioThemeSummary, ThemeColorKey, ThemeFontKey } from '../../../shared/types';
import { defaultStudioTheme, themeColorKeys, themeFontKeys } from '../../../shared/theme';
import {
  importStudioThemeFile,
  listStudioThemes,
  listSystemFonts,
  revealStudioThemesDirectory,
  saveStudioTheme,
} from '../../services/filesystem/studioFilesystem';

type ThemeSelectorModalProps = {
  open: boolean;
  activeTheme: StudioTheme;
  onApplyTheme: (theme: StudioTheme) => void;
  onClose: () => void;
};

const defaultThemeSummary: StudioThemeSummary = {
  id: 'studio-default',
  name: defaultStudioTheme.name,
  path: null,
  theme: defaultStudioTheme,
};

const themeColorLabels: Record<ThemeColorKey, string> = {
  background: 'Background',
  surface: 'Surface',
  panel: 'Panel',
  border: 'Border',
  primary: 'Primary',
  primaryText: 'Primary text',
  text: 'Text',
  mutedText: 'Muted text',
  warning: 'Warning',
  danger: 'Danger',
  editorBackground: 'Editor background',
  editorText: 'Editor text',
};

const themeFontLabels: Record<ThemeFontKey, string> = {
  interface: 'Interface font',
  editor: 'Editor font',
};

const cloneTheme = (theme: StudioTheme): StudioTheme => ({
  version: 1,
  name: theme.name,
  colors: { ...theme.colors },
  fonts: { ...theme.fonts },
});

const normalizeThemeName = (value: string): string => {
  return value.trim() || 'Untitled Theme';
};

const createNewTheme = (): StudioTheme => ({
  ...cloneTheme(defaultStudioTheme),
  name: 'Untitled Theme',
});

export const ThemeSelectorModal = ({
  open,
  activeTheme,
  onApplyTheme,
  onClose,
}: ThemeSelectorModalProps): JSX.Element | null => {
  const [themes, setThemes] = useState<StudioThemeSummary[]>([defaultThemeSummary]);
  const [selectedThemeId, setSelectedThemeId] = useState(defaultThemeSummary.id);
  const [selectedThemePath, setSelectedThemePath] = useState<string | null>(null);
  const [themesDirectory, setThemesDirectory] = useState('');
  const [draftTheme, setDraftTheme] = useState<StudioTheme>(() => cloneTheme(activeTheme));
  const [fonts, setFonts] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyDraft = useCallback(
    (theme: StudioTheme): void => {
      const nextTheme = cloneTheme(theme);
      setDraftTheme(nextTheme);
      onApplyTheme(nextTheme);
    },
    [onApplyTheme],
  );

  const selectTheme = useCallback(
    (theme: StudioThemeSummary): void => {
      setSelectedThemeId(theme.id);
      setSelectedThemePath(theme.path);
      applyDraft(theme.theme);
      setStatus(null);
      setError(null);
    },
    [applyDraft],
  );

  const refreshThemes = useCallback(
    async (nextSelectedThemeId?: string): Promise<void> => {
      const result = await listStudioThemes();
      const nextThemes = [defaultThemeSummary, ...result.themes];
      setThemes(nextThemes);
      setThemesDirectory(result.themesDirectory);

      const selected = nextThemes.find((theme) => theme.id === nextSelectedThemeId)
        ?? nextThemes.find((theme) => theme.name === activeTheme.name)
        ?? nextThemes[0];

      if (selected) {
        selectTheme(selected);
      }
    },
    [activeTheme.name, selectTheme],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    void Promise.all([refreshThemes(), listSystemFonts()])
      .then(([, fontNames]) => setFonts(fontNames))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, [open, refreshThemes]);

  const fontOptions = useMemo(() => {
    return [
      ...new Set([
        draftTheme.fonts.interface,
        draftTheme.fonts.editor,
        defaultStudioTheme.fonts.interface,
        defaultStudioTheme.fonts.editor,
        ...fonts,
      ]),
    ].filter(Boolean);
  }, [draftTheme.fonts.editor, draftTheme.fonts.interface, fonts]);

  const updateDraftTheme = useCallback(
    (updater: (theme: StudioTheme) => StudioTheme): void => {
      setDraftTheme((previous) => {
        const nextTheme = updater(previous);
        onApplyTheme(nextTheme);
        return nextTheme;
      });
      setStatus(null);
    },
    [onApplyTheme],
  );

  const handleCreateTheme = useCallback((): void => {
    const nextTheme = createNewTheme();
    setSelectedThemeId('new-theme');
    setSelectedThemePath(null);
    applyDraft(nextTheme);
    setStatus(null);
    setError(null);
  }, [applyDraft]);

  const handleImportTheme = useCallback(async (): Promise<void> => {
    try {
      const imported = await importStudioThemeFile();
      if (!imported) {
        return;
      }
      await refreshThemes(imported.theme.id);
      setStatus(`Added ${imported.theme.name}`);
      setError(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    }
  }, [refreshThemes]);

  const handleRevealThemesDirectory = useCallback(async (): Promise<void> => {
    try {
      await revealStudioThemesDirectory();
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : String(revealError));
    }
  }, []);

  const handleSavedTheme = useCallback(
    (theme: StudioThemeSummary): void => {
      setThemes((previous) => {
        const withoutSaved = previous.filter((item) => item.id !== theme.id);
        return [defaultThemeSummary, ...withoutSaved.filter((item) => item.id !== defaultThemeSummary.id), theme]
          .sort((left, right) => {
            if (left.id === defaultThemeSummary.id) {
              return -1;
            }
            if (right.id === defaultThemeSummary.id) {
              return 1;
            }
            return left.name.localeCompare(right.name);
          });
      });
      setSelectedThemeId(theme.id);
      setSelectedThemePath(theme.path);
      applyDraft(theme.theme);
      setStatus(`Saved ${theme.name}`);
      setError(null);
    },
    [applyDraft],
  );

  const handleSaveTheme = useCallback(
    async (saveAsNew: boolean): Promise<void> => {
      try {
        const result = await saveStudioTheme({
          theme: {
            ...draftTheme,
            name: normalizeThemeName(draftTheme.name),
          },
          targetPath: selectedThemePath,
          saveAsNew,
        });

        setThemesDirectory(result.themesDirectory);
        handleSavedTheme(result.theme);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : String(saveError));
      }
    },
    [draftTheme, handleSavedTheme, selectedThemePath],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="theme-modal" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
        <header className="theme-modal-header">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2 id="theme-modal-title">Theme Selector</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="theme-modal-body">
          <aside className="theme-list-panel">
            <div className="theme-list-actions">
              <details className="theme-action-menu">
                <summary title="Add theme">
                  <Plus size={17} aria-hidden="true" />
                </summary>
                <div className="menu-panel">
                  <button type="button" onClick={handleCreateTheme}>
                    Create new theme
                  </button>
                  <button type="button" onClick={() => void handleImportTheme()}>
                    Add external theme file
                  </button>
                </div>
              </details>

              <button
                type="button"
                className="icon-button"
                onClick={() => void handleRevealThemesDirectory()}
                title={themesDirectory || 'Open themes directory'}
              >
                <FolderOpen size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="theme-list" role="list">
              {themes.map((theme) => (
                <button
                  type="button"
                  className={`theme-list-item ${selectedThemeId === theme.id ? 'is-active' : ''}`}
                  key={theme.id}
                  onClick={() => selectTheme(theme)}
                >
                  <span className="theme-list-swatch" style={{ background: theme.theme.colors.primary }} />
                  <span>{theme.name}</span>
                  <small>{theme.path ? 'Local theme' : 'Built in'}</small>
                </button>
              ))}
            </div>
          </aside>

          <main className="theme-editor-panel">
            <label className="theme-name-field">
              <span>Name</span>
              <input
                value={draftTheme.name}
                onChange={(event) =>
                  updateDraftTheme((theme) => ({
                    ...theme,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <section className="theme-field-section">
              <h3>Colors</h3>
              <div className="theme-color-grid">
                {themeColorKeys.map((key) => (
                  <label className="theme-color-field" key={key}>
                    <span>{themeColorLabels[key]}</span>
                    <input
                      type="color"
                      value={draftTheme.colors[key]}
                      onChange={(event) =>
                        updateDraftTheme((theme) => ({
                          ...theme,
                          colors: {
                            ...theme.colors,
                            [key]: event.target.value,
                          },
                        }))
                      }
                    />
                    <code>{draftTheme.colors[key]}</code>
                  </label>
                ))}
              </div>
            </section>

            <section className="theme-field-section">
              <h3>Fonts</h3>
              <div className="theme-font-grid">
                {themeFontKeys.map((key) => (
                  <label className="theme-font-field" key={key}>
                    <span>{themeFontLabels[key]}</span>
                    <select
                      value={draftTheme.fonts[key]}
                      onChange={(event) =>
                        updateDraftTheme((theme) => ({
                          ...theme,
                          fonts: {
                            ...theme.fonts,
                            [key]: event.target.value,
                          },
                        }))
                      }
                    >
                      {fontOptions.map((fontName) => (
                        <option key={`${key}-${fontName}`} value={fontName}>
                          {fontName}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          </main>
        </div>

        <footer className="theme-modal-footer">
          <div>
            {error ? <p className="theme-error">{error}</p> : null}
            {status ? <p className="theme-status">{status}</p> : null}
          </div>

          <details className="theme-save-menu">
            <summary>
              <Save size={16} aria-hidden="true" />
              Save
            </summary>
            <div className="menu-panel align-right">
              <button type="button" onClick={() => void handleSaveTheme(true)}>
                Save to new theme
              </button>
              <button type="button" onClick={() => void handleSaveTheme(false)} disabled={!selectedThemePath}>
                Save to this theme
              </button>
            </div>
          </details>
        </footer>
      </section>
    </div>
  );
};
