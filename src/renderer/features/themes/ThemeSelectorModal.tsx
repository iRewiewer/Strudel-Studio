import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Plus, Save, Search, X } from 'lucide-react';
import type {
  StudioTheme,
  StudioThemeSummary,
  ThemeColorKey,
  ThemeFontKey,
  ThemeFontSizeKey,
} from '../../../shared/types';
import { defaultStudioTheme, themeColorKeys, themeFontKeys, themeFontSizeKeys } from '../../../shared/theme';
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

const unsavedThemeId = 'new-theme';

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

const themeFontSizeLabels: Record<ThemeFontSizeKey, string> = {
  editor: 'Editor font size',
};

const cloneTheme = (theme: StudioTheme): StudioTheme => ({
  version: 1,
  name: theme.name,
  colors: { ...theme.colors },
  fonts: { ...theme.fonts },
  fontSizes: { ...theme.fontSizes },
});

const normalizeThemeName = (value: string): string => {
  return value.trim() || 'Untitled Theme';
};

const clampFontSize = (value: number): number => {
  return Math.min(Math.max(Math.round(value), 10), 28);
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
  const [fontQuery, setFontQuery] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);

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
    async (nextSelectedThemeId?: string, fallbackThemeName?: string): Promise<void> => {
      const result = await listStudioThemes();
      const nextThemes = [defaultThemeSummary, ...result.themes];
      setThemes(nextThemes);
      setThemesDirectory(result.themesDirectory);

      const selected = (nextSelectedThemeId ? nextThemes.find((theme) => theme.id === nextSelectedThemeId) : null)
        ?? nextThemes.find((theme) => theme.id === selectedThemeId)
        ?? (fallbackThemeName ? nextThemes.find((theme) => theme.name === fallbackThemeName) : null)
        ?? nextThemes[0];

      if (selected) {
        selectTheme(selected);
      }
    },
    [selectTheme, selectedThemeId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setAddMenuOpen(false);
    setSaveMenuOpen(false);
    setFontQuery('');

    void Promise.all([refreshThemes(undefined, activeTheme.name), listSystemFonts()])
      .then(([, fontNames]) => setFonts(fontNames))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, [open]);

  useEffect(() => {
    if (!addMenuOpen && !saveMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (addMenuOpen && !addMenuRef.current?.contains(target)) {
        setAddMenuOpen(false);
      }
      if (saveMenuOpen && !saveMenuRef.current?.contains(target)) {
        setSaveMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setAddMenuOpen(false);
        setSaveMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addMenuOpen, saveMenuOpen]);

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

  const filteredFontOptions = useMemo(() => {
    const normalizedQuery = fontQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return fontOptions;
    }

    return fontOptions.filter((fontName) => fontName.toLowerCase().includes(normalizedQuery));
  }, [fontOptions, fontQuery]);

  const getFontOptionsForValue = useCallback(
    (currentFont: string): string[] => {
      return filteredFontOptions.includes(currentFont)
        ? filteredFontOptions
        : [currentFont, ...filteredFontOptions].filter(Boolean);
    },
    [filteredFontOptions],
  );

  const updateDraftTheme = useCallback(
    (updater: (theme: StudioTheme) => StudioTheme): void => {
      setDraftTheme((previous) => {
        const nextTheme = updater(previous);
        if (selectedThemeId === unsavedThemeId) {
          setThemes((currentThemes) =>
            currentThemes.map((theme) =>
              theme.id === unsavedThemeId
                ? { ...theme, name: normalizeThemeName(nextTheme.name), theme: nextTheme }
                : theme,
            ),
          );
        }
        onApplyTheme(nextTheme);
        return nextTheme;
      });
      setStatus(null);
    },
    [onApplyTheme, selectedThemeId],
  );

  const handleCreateTheme = useCallback((): void => {
    const nextTheme = createNewTheme();
    const unsavedTheme: StudioThemeSummary = {
      id: unsavedThemeId,
      name: nextTheme.name,
      path: null,
      theme: nextTheme,
    };

    setThemes((previous) => [
      defaultThemeSummary,
      unsavedTheme,
      ...previous.filter((theme) => theme.id !== defaultThemeSummary.id && theme.id !== unsavedThemeId),
    ]);
    setSelectedThemeId(unsavedThemeId);
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
        const withoutSaved = previous.filter((item) => item.id !== theme.id && item.id !== unsavedThemeId);
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
              <div className="theme-action-menu" ref={addMenuRef}>
                <button
                  type="button"
                  className="theme-menu-trigger"
                  onClick={() => setAddMenuOpen((previous) => !previous)}
                  title="Add theme"
                  aria-expanded={addMenuOpen}
                >
                  <Plus size={17} aria-hidden="true" />
                </button>
                {addMenuOpen ? (
                  <div className="menu-panel">
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenuOpen(false);
                        handleCreateTheme();
                      }}
                    >
                      Create new theme
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenuOpen(false);
                        void handleImportTheme();
                      }}
                    >
                      Add external theme file
                    </button>
                  </div>
                ) : null}
              </div>

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
                  <small>{theme.id === unsavedThemeId ? 'Unsaved theme' : theme.path ? 'Local theme' : 'Built in'}</small>
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
              <label className="lookup-search theme-font-search">
                <Search size={15} aria-hidden="true" />
                <input
                  value={fontQuery}
                  onChange={(event) => setFontQuery(event.target.value)}
                  placeholder="Search fonts"
                  aria-label="Search fonts"
                />
              </label>
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
                      {getFontOptionsForValue(draftTheme.fonts[key]).map((fontName) => (
                        <option key={`${key}-${fontName}`} value={fontName}>
                          {fontName}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="theme-font-size-grid">
                {themeFontSizeKeys.map((key) => (
                  <label className="theme-font-size-field" key={key}>
                    <span>{themeFontSizeLabels[key]}</span>
                    <div className="font-size-control">
                      <input
                        type="range"
                        min={10}
                        max={28}
                        value={draftTheme.fontSizes[key]}
                        onChange={(event) =>
                          updateDraftTheme((theme) => ({
                            ...theme,
                            fontSizes: {
                              ...theme.fontSizes,
                              [key]: clampFontSize(Number(event.target.value)),
                            },
                          }))
                        }
                      />
                      <input
                        type="number"
                        min={10}
                        max={28}
                        value={draftTheme.fontSizes[key]}
                        onChange={(event) =>
                          updateDraftTheme((theme) => ({
                            ...theme,
                            fontSizes: {
                              ...theme.fontSizes,
                              [key]: clampFontSize(Number(event.target.value)),
                            },
                          }))
                        }
                        aria-label={themeFontSizeLabels[key]}
                      />
                    </div>
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

          <div className="theme-save-menu" ref={saveMenuRef}>
            <button
              type="button"
              className="theme-menu-trigger theme-save-trigger"
              onClick={() => setSaveMenuOpen((previous) => !previous)}
              aria-expanded={saveMenuOpen}
            >
              <Save size={16} aria-hidden="true" />
              Save
            </button>
            {saveMenuOpen ? (
              <div className="menu-panel align-right">
                <button
                  type="button"
                  onClick={() => {
                    setSaveMenuOpen(false);
                    void handleSaveTheme(true);
                  }}
                >
                  Save to new theme
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveMenuOpen(false);
                    void handleSaveTheme(false);
                  }}
                  disabled={!selectedThemePath}
                >
                  Save to this theme
                </button>
              </div>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
};
