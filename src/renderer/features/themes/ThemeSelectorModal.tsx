import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Eye, EyeOff, FolderOpen, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import type {
  StudioTheme,
  StudioThemeSummary,
  ThemeColorKey,
  ThemeFontKey,
  ThemeFontSizeKey,
} from '../../../shared/types';
import { builtInStudioThemes, defaultStudioTheme, themeColorKeys, themeFontKeys } from '../../../shared/theme';
import {
  deleteStudioTheme,
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

const toBuiltInThemeId = (theme: StudioTheme, index: number): string => {
  if (index === 0) {
    return 'studio-default';
  }

  return `studio-built-in-${theme.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
};

const builtInThemeSummaries: StudioThemeSummary[] = builtInStudioThemes.map((theme, index) => ({
  id: toBuiltInThemeId(theme, index),
  name: theme.name,
  path: null,
  theme,
}));
const builtInThemeIds = new Set(builtInThemeSummaries.map((theme) => theme.id));
const defaultThemeSummary: StudioThemeSummary = builtInThemeSummaries[0]!;

const unsavedThemeId = 'new-theme';

const themeColorLabels: Record<ThemeColorKey, string> = {
  background: 'Background',
  surface: 'Surface',
  panel: 'Panel',
  recentPanel: 'Recent panel',
  border: 'Border',
  primary: 'Primary',
  primaryText: 'Primary text',
  text: 'Text',
  mutedText: 'Muted text',
  warning: 'Warning',
  danger: 'Danger',
  editorBackground: 'Editor background',
  editorText: 'Editor text',
  playbackHighlight: 'Playback highlight',
};

const themeFontLabels: Record<ThemeFontKey, string> = {
  interface: 'Interface font',
  editor: 'Editor font',
};

const themeFontSizeLabels: Record<ThemeFontSizeKey, string> = {
  interface: 'Interface font size',
  editor: 'Editor font size',
};

const normalizeThemeName = (value: string): string => {
  return value.trim() || 'Untitled Theme';
};

const normalizeThemeAuthor = (value: string): string => {
  return value.trim() || 'Unknown';
};

const normalizeThemeVersion = (value: string): string => {
  const version = value.trim().replace(/^v\s*/i, '');
  return version || '1.0.0';
};

const clampFontSize = (value: number): number => {
  return Math.min(Math.max(Math.round(value), 10), 28);
};

const cloneTheme = (theme: StudioTheme): StudioTheme => ({
  version: 1,
  name: theme.name,
  author: normalizeThemeAuthor(theme.author),
  themeVersion: normalizeThemeVersion(theme.themeVersion),
  colors: { ...defaultStudioTheme.colors, ...theme.colors },
  fonts: { ...defaultStudioTheme.fonts, ...theme.fonts },
  fontSizes: {
    interface: clampFontSize(theme.fontSizes.interface ?? defaultStudioTheme.fontSizes.interface),
    editor: clampFontSize(theme.fontSizes.editor ?? defaultStudioTheme.fontSizes.editor),
  },
});

const createNewTheme = (): StudioTheme => ({
  ...cloneTheme(defaultStudioTheme),
  name: 'Untitled Theme',
  author: 'Unknown',
  themeVersion: '1.0.0',
});

const getThemeListDetail = (theme: StudioThemeSummary): string => {
  if (!theme.path && theme.id !== unsavedThemeId) {
    return 'Built-In';
  }

  const author = normalizeThemeAuthor(theme.theme.author);
  const version = normalizeThemeVersion(theme.theme.themeVersion);
  return `${author} · v${version}`;
};

const isBuiltInThemeSummary = (theme: StudioThemeSummary): boolean => builtInThemeIds.has(theme.id);

const mergeThemeSummaries = (
  savedThemes: StudioThemeSummary[],
  unsavedTheme: StudioThemeSummary | null,
): StudioThemeSummary[] => [
  ...builtInThemeSummaries,
  ...(unsavedTheme ? [unsavedTheme] : []),
  ...savedThemes.filter((theme) => theme.id !== unsavedThemeId && !isBuiltInThemeSummary(theme)),
];

const themeMatches = (theme: StudioTheme, targetTheme: StudioTheme): boolean => {
  return (
    theme.name === targetTheme.name &&
    normalizeThemeAuthor(theme.author) === normalizeThemeAuthor(targetTheme.author) &&
    normalizeThemeVersion(theme.themeVersion) === normalizeThemeVersion(targetTheme.themeVersion)
  );
};

export const ThemeSelectorModal = ({
  open,
  activeTheme,
  onApplyTheme,
  onClose,
}: ThemeSelectorModalProps): JSX.Element | null => {
  const [themes, setThemes] = useState<StudioThemeSummary[]>(builtInThemeSummaries);
  const [selectedThemeId, setSelectedThemeId] = useState(defaultThemeSummary.id);
  const [selectedThemePath, setSelectedThemePath] = useState<string | null>(null);
  const [themesDirectory, setThemesDirectory] = useState('');
  const [draftTheme, setDraftTheme] = useState<StudioTheme>(() => cloneTheme(activeTheme));
  const [fonts, setFonts] = useState<string[]>([]);
  const [fontQuery, setFontQuery] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showBuiltInThemes, setShowBuiltInThemes] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

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
    async (nextSelectedThemeId?: string, fallbackTheme?: StudioTheme): Promise<void> => {
      const result = await listStudioThemes();
      const unsavedTheme = themes.find((theme) => theme.id === unsavedThemeId) ?? null;
      const nextThemes = mergeThemeSummaries(result.themes, unsavedTheme);
      setThemes(nextThemes);
      setThemesDirectory(result.themesDirectory);

      const selected = (nextSelectedThemeId ? nextThemes.find((theme) => theme.id === nextSelectedThemeId) : null)
        ?? (selectedThemeId !== defaultThemeSummary.id
          ? nextThemes.find((theme) => theme.id === selectedThemeId)
          : null)
        ?? (fallbackTheme ? nextThemes.find((theme) => themeMatches(theme.theme, fallbackTheme)) : null)
        ?? nextThemes.find((theme) => theme.id === selectedThemeId)
        ?? nextThemes[0];

      if (selected) {
        selectTheme(selected);
      }
    },
    [selectTheme, selectedThemeId, themes],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setAddMenuOpen(false);
    setFontQuery('');

    void Promise.all([refreshThemes(undefined, activeTheme), listSystemFonts()])
      .then(([, fontNames]) => setFonts(fontNames))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, [open]);

  useEffect(() => {
    if (!addMenuOpen) {
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
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setAddMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      if (addMenuOpen) {
        setAddMenuOpen(false);
        return;
      }

      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addMenuOpen, onClose, open]);

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

  const selectedTheme = useMemo(() => {
    return themes.find((theme) => theme.id === selectedThemeId) ?? null;
  }, [selectedThemeId, themes]);
  const visibleThemes = useMemo(() => {
    return showBuiltInThemes ? themes : themes.filter((theme) => !isBuiltInThemeSummary(theme));
  }, [showBuiltInThemes, themes]);
  const selectedThemeIsBuiltIn = Boolean(selectedTheme && !selectedTheme.path && selectedTheme.id !== unsavedThemeId);
  const canSaveSelectedTheme = !selectedThemeIsBuiltIn;
  const canDeleteSelectedTheme = !selectedThemeIsBuiltIn;
  const saveTitle = canSaveSelectedTheme ? 'Save theme' : "Can't save a built-in theme";
  const deleteTitle = canDeleteSelectedTheme ? 'Delete theme' : "Can't delete a built-in theme";

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

    setThemes((previous) => mergeThemeSummaries(previous, unsavedTheme));
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

  const handleRefreshThemes = useCallback(async (): Promise<void> => {
    try {
      await refreshThemes(selectedThemeId, draftTheme);
      setStatus('Theme list refreshed');
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }, [draftTheme.name, refreshThemes, selectedThemeId]);

  const handleSavedTheme = useCallback(
    (theme: StudioThemeSummary): void => {
      setThemes((previous) => {
        const withoutSaved = previous.filter(
          (item) => item.id !== theme.id && item.id !== unsavedThemeId && !isBuiltInThemeSummary(item),
        );
        return mergeThemeSummaries([...withoutSaved, theme].sort((left, right) => left.name.localeCompare(right.name)), null);
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
    async (): Promise<void> => {
      if (!canSaveSelectedTheme) {
        return;
      }

      try {
        const result = await saveStudioTheme({
          theme: {
            ...cloneTheme(draftTheme),
            name: normalizeThemeName(draftTheme.name),
          },
          targetPath: selectedThemePath,
          saveAsNew: !selectedThemePath,
        });

        setThemesDirectory(result.themesDirectory);
        handleSavedTheme(result.theme);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : String(saveError));
      }
    },
    [canSaveSelectedTheme, draftTheme, handleSavedTheme, selectedThemePath],
  );

  const handleDuplicateTheme = useCallback(async (): Promise<void> => {
    try {
      const sourceName = normalizeThemeName(draftTheme.name);
      const result = await saveStudioTheme({
        theme: {
          ...cloneTheme(draftTheme),
          name: `${sourceName} Copy`,
        },
        saveAsNew: true,
      });

      setThemesDirectory(result.themesDirectory);
      handleSavedTheme(result.theme);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : String(duplicateError));
    }
  }, [draftTheme, handleSavedTheme]);

  const handleDeleteTheme = useCallback(async (): Promise<void> => {
    if (!canDeleteSelectedTheme) {
      return;
    }

    if (!selectedThemePath) {
      setThemes((previous) => previous.filter((theme) => theme.id !== unsavedThemeId));
      selectTheme(defaultThemeSummary);
      setStatus('Discarded unsaved theme');
      setError(null);
      return;
    }

    const themeName = selectedTheme?.name ?? draftTheme.name;
    if (!window.confirm(`Delete "${themeName}"?`)) {
      return;
    }

    try {
      const result = await deleteStudioTheme({ themePath: selectedThemePath });
      setThemes(mergeThemeSummaries(result.themes, null));
      setThemesDirectory(result.themesDirectory);
      selectTheme(defaultThemeSummary);
      setStatus(`Deleted ${themeName}`);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }, [canDeleteSelectedTheme, draftTheme.name, selectTheme, selectedTheme, selectedThemePath]);

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
              <button
                type="button"
                className="icon-button"
                onClick={() => void handleRefreshThemes()}
                title="Refresh themes"
              >
                <RefreshCw size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowBuiltInThemes((previous) => !previous)}
                title={showBuiltInThemes ? 'Hide built-in themes' : 'Show built-in themes'}
                aria-pressed={!showBuiltInThemes}
              >
                {showBuiltInThemes ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>

            <div className="theme-list" role="list">
              {visibleThemes.length === 0 ? (
                <p className="theme-list-empty">No local themes</p>
              ) : null}
              {visibleThemes.map((theme) => (
                <button
                  type="button"
                  className={`theme-list-item ${selectedThemeId === theme.id ? 'is-active' : ''}`}
                  key={theme.id}
                  onClick={() => selectTheme(theme)}
                >
                  <span className="theme-list-swatch" style={{ background: theme.theme.colors.primary }} />
                  <span>{theme.name}</span>
                  <small>{getThemeListDetail(theme)}</small>
                </button>
              ))}
            </div>
          </aside>

          <main className="theme-editor-panel">
            <div className="theme-title-fields">
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
              <p className="theme-file-path" title={selectedThemePath ?? undefined}>
                {selectedThemePath ?? (selectedThemeIsBuiltIn ? 'Built-in theme' : 'Not saved to disk')}
              </p>
            </div>

            <div className="theme-meta-grid">
              <label className="theme-name-field">
                <span>Author</span>
                <input
                  value={draftTheme.author}
                  onChange={(event) =>
                    updateDraftTheme((theme) => ({
                      ...theme,
                      author: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="theme-name-field">
                <span>Version</span>
                <input
                  value={draftTheme.themeVersion}
                  onChange={(event) =>
                    updateDraftTheme((theme) => ({
                      ...theme,
                      themeVersion: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

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
              <div className="theme-typography-grid">
                {themeFontKeys.map((key) => (
                  <div className="theme-typography-row" key={key}>
                    <label className="theme-font-field">
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
                    <label className="theme-font-size-field">
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
                  </div>
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

          <div className="theme-footer-actions">
            <button
              type="button"
              className="theme-action-button"
              onClick={() => void handleSaveTheme()}
              disabled={!canSaveSelectedTheme}
              title={saveTitle}
              data-tooltip={saveTitle}
            >
              <Save size={16} aria-hidden="true" />
              Save
            </button>
            <button
              type="button"
              className="theme-action-button"
              onClick={() => void handleDuplicateTheme()}
              title="Duplicate theme"
            >
              <Copy size={16} aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              className="theme-action-button danger"
              onClick={() => void handleDeleteTheme()}
              disabled={!canDeleteSelectedTheme}
              title={deleteTitle}
              data-tooltip={deleteTitle}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
