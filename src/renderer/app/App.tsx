import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OpenFileState, ProjectFile, ProjectSessionSnapshot, ProjectSnapshot, RecentProject } from '../../shared/types';
import { EditorPane } from '../features/editor/EditorPane';
import { FileExplorer } from '../features/files/FileExplorer';
import { PlaybackControls } from '../features/playback/PlaybackControls';
import { InspectorPanel } from '../features/sidebar-right/InspectorPanel';
import { WelcomeScreen } from '../features/workspace/WelcomeScreen';
import {
  createStrudelFile,
  listRecentProjects,
  newProjectFolder,
  openProjectFolder,
  openRecentProject,
  readProjectFile,
  saveProjectFile,
  saveWorkspaceFile,
} from '../services/filesystem/studioFilesystem';
import { StrudelPlaybackService } from '../services/strudel/StrudelPlaybackService';
import type {
  EditorFile,
  EditorPanelState,
  EditorSplitDirection,
  PlaybackState,
  StudioSettings,
  WorkbenchProject,
} from '../types/workbench';
import { stoppedPlaybackState } from '../types/workbench';

const defaultPanelId = 'panel-1';
const sidebarMinWidth = 220;
const sidebarMaxWidth = 520;

const defaultSettings: StudioSettings = {
  keepPlayAllSelectionOnClose: false,
};

const toForwardSlashPath = (value: string): string => value.replaceAll('\\', '/');

const getFileName = (relativePath: string): string => {
  const parts = toForwardSlashPath(relativePath).split('/');
  return parts.at(-1) ?? relativePath;
};

const getExtension = (relativePath: string): string => {
  const name = getFileName(relativePath);
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
};

const normalizeNewFileName = (value: string): string => {
  const trimmed = toForwardSlashPath(value.trim()).replace(/^\/+/, '');
  if (!trimmed) {
    return '';
  }
  return getExtension(trimmed) ? trimmed : `${trimmed}.strudel`;
};

const findProjectFile = (project: ProjectSnapshot, relativePath: string): ProjectFile | null => {
  return project.files.find((file) => file.relativePath === relativePath) ?? null;
};

const createEditorFile = (
  project: ProjectSnapshot,
  relativePath: string,
  content: string,
  includedInPlayAll: boolean,
): EditorFile => {
  const metadata = findProjectFile(project, relativePath);
  const name = getFileName(relativePath);

  return {
    id: relativePath,
    absolutePath: metadata?.absolutePath ?? `${project.rootPath}/${relativePath}`,
    relativePath,
    name,
    extension: metadata?.extension ?? getExtension(relativePath),
    size: metadata?.size ?? content.length,
    modifiedAt: metadata?.modifiedAt ?? new Date().toISOString(),
    content,
    dirty: false,
    includedInPlayAll,
    isOpen: true,
  };
};

const createEditorFilesFromSession = (session: ProjectSessionSnapshot): Record<string, EditorFile> => {
  return session.openFiles.reduce<Record<string, EditorFile>>((accumulator, file: OpenFileState) => {
    accumulator[file.relativePath] = createEditorFile(
      session.project,
      file.relativePath,
      file.content,
      file.includedInPlayAll,
    );
    return accumulator;
  }, {});
};

const getPlaybackSignature = (files: EditorFile[]): string => {
  return files
    .map((file) => `${file.relativePath}\u0000${file.includedInPlayAll}\u0000${file.content}`)
    .join('\u0001');
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const App = (): JSX.Element => {
  const playbackService = useRef(new StrudelPlaybackService());
  const lastEvaluatedPlaybackSignature = useRef('');
  const [project, setProject] = useState<WorkbenchProject | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [openFilesByPath, setOpenFilesByPath] = useState<Record<string, EditorFile>>({});
  const [editorPanels, setEditorPanels] = useState<EditorPanelState[]>([
    { id: defaultPanelId, filePath: null },
  ]);
  const [activePanelId, setActivePanelId] = useState(defaultPanelId);
  const [splitDirection, setSplitDirection] = useState<EditorSplitDirection>('vertical');
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(300);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(280);
  const [settings, setSettings] = useState<StudioSettings>(defaultSettings);
  const [newFileName, setNewFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(stoppedPlaybackState);

  const allTrackedFiles = useMemo(() => Object.values(openFilesByPath), [openFilesByPath]);
  const openFiles = useMemo(
    () => allTrackedFiles.filter((file) => file.isOpen),
    [allTrackedFiles],
  );
  const includedFiles = useMemo(
    () => allTrackedFiles.filter((file) => file.includedInPlayAll),
    [allTrackedFiles],
  );
  const dirtyFiles = useMemo(
    () => allTrackedFiles.filter((file) => file.dirty),
    [allTrackedFiles],
  );
  const activePanel = editorPanels.find((panel) => panel.id === activePanelId) ?? editorPanels[0] ?? null;
  const activeFilePath = activePanel?.filePath ?? null;
  const activeFile = activeFilePath ? openFilesByPath[activeFilePath] ?? null : null;

  const refreshRecentProjects = useCallback(async (): Promise<void> => {
    setRecentProjects(await listRecentProjects());
  }, []);

  useEffect(() => {
    void refreshRecentProjects().catch((error) => {
      setOperationError(error instanceof Error ? error.message : String(error));
    });
  }, [refreshRecentProjects]);

  useEffect(() => {
    playbackService.current.setSampleManifestUrl(project?.sampleServer?.manifestUrl ?? null);
  }, [project?.sampleServer?.manifestUrl]);

  const setPanelFile = useCallback((panelId: string, relativePath: string | null): void => {
    setActivePanelId(panelId);
    setEditorPanels((previous) =>
      previous.map((panel) => (panel.id === panelId ? { ...panel, filePath: relativePath } : panel)),
    );
  }, []);

  const applySession = useCallback(
    async (session: ProjectSessionSnapshot): Promise<void> => {
      await playbackService.current.stop();
      lastEvaluatedPlaybackSignature.current = '';
      const filesByPath = createEditorFilesFromSession(session);
      const firstOpenFilePath = Object.values(filesByPath)[0]?.relativePath ?? null;
      const activePath = session.activeFilePath && filesByPath[session.activeFilePath]
        ? session.activeFilePath
        : firstOpenFilePath;

      setProject(session.project);
      setWorkspacePath(session.workspacePath);
      setOpenFilesByPath(filesByPath);
      setEditorPanels([{ id: defaultPanelId, filePath: activePath }]);
      setActivePanelId(defaultPanelId);
      setSplitDirection('vertical');
      setPlayback(stoppedPlaybackState);
      setOperationError(null);
      await refreshRecentProjects();
    },
    [refreshRecentProjects],
  );

  const handleNewProject = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const session = await newProjectFolder();
      if (session) {
        await applySession(session);
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [applySession]);

  const handleOpenProject = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const session = await openProjectFolder();
      if (session) {
        await applySession(session);
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [applySession]);

  const handleOpenRecentProject = useCallback(
    async (projectRoot: string): Promise<void> => {
      setBusy(true);
      try {
        const session = await openRecentProject(projectRoot);
        if (session) {
          await applySession(session);
        }
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [applySession],
  );

  const handleGoHome = useCallback(async (): Promise<void> => {
    await playbackService.current.stop();
    lastEvaluatedPlaybackSignature.current = '';
    setProject(null);
    setPlayback(stoppedPlaybackState);
    await refreshRecentProjects();
  }, [refreshRecentProjects]);

  const openFile = useCallback(
    async (relativePath: string, includedInPlayAll = false): Promise<EditorFile | null> => {
      if (!project) {
        return null;
      }

      const existing = openFilesByPath[relativePath];
      if (existing) {
        const nextFile = {
          ...existing,
          isOpen: true,
          includedInPlayAll: existing.includedInPlayAll || includedInPlayAll,
        };
        setOpenFilesByPath((previous) => ({ ...previous, [relativePath]: nextFile }));
        setPanelFile(activePanelId, relativePath);
        return nextFile;
      }

      const content = await readProjectFile(project.rootPath, relativePath);
      const editorFile = createEditorFile(project, relativePath, content, includedInPlayAll);
      setOpenFilesByPath((previous) => ({ ...previous, [relativePath]: editorFile }));
      setPanelFile(activePanelId, relativePath);
      return editorFile;
    },
    [activePanelId, openFilesByPath, project, setPanelFile],
  );

  const handleCreateFile = useCallback(async (): Promise<void> => {
    if (!project) {
      return;
    }

    const relativePath = normalizeNewFileName(newFileName);
    if (!relativePath) {
      return;
    }

    setBusy(true);
    try {
      const snapshot = await createStrudelFile({ projectRoot: project.rootPath, relativePath });
      setProject(snapshot);
      const createdFile = createEditorFile(snapshot, relativePath, '', true);
      setOpenFilesByPath((previous) => ({ ...previous, [relativePath]: createdFile }));
      setPanelFile(activePanelId, relativePath);
      setNewFileName('');
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [activePanelId, newFileName, project, setPanelFile]);

  const handleOpenFile = useCallback(
    async (relativePath: string): Promise<void> => {
      try {
        await openFile(relativePath);
        setOperationError(null);
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : String(error));
      }
    },
    [openFile],
  );

  const handleToggleIncluded = useCallback(
    async (relativePath: string, includedInPlayAll: boolean): Promise<void> => {
      if (!project) {
        return;
      }

      if (!openFilesByPath[relativePath]) {
        await openFile(relativePath, includedInPlayAll);
        return;
      }

      setOpenFilesByPath((previous) => {
        const existing = previous[relativePath];
        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [relativePath]: {
            ...existing,
            includedInPlayAll,
          },
        };
      });
    },
    [openFile, openFilesByPath, project],
  );

  const getReplacementOpenFilePath = useCallback(
    (closedRelativePath: string): string | null => {
      return openFiles.find((file) => file.relativePath !== closedRelativePath)?.relativePath ?? null;
    },
    [openFiles],
  );

  const handleCloseFile = useCallback(
    (relativePath: string): void => {
      const replacementPath = getReplacementOpenFilePath(relativePath);
      setOpenFilesByPath((previous) => {
        const existing = previous[relativePath];
        if (!existing) {
          return previous;
        }

        if (settings.keepPlayAllSelectionOnClose) {
          return {
            ...previous,
            [relativePath]: {
              ...existing,
              isOpen: false,
            },
          };
        }

        const next = { ...previous };
        delete next[relativePath];
        return next;
      });

      setEditorPanels((previous) =>
        previous.map((panel) =>
          panel.filePath === relativePath ? { ...panel, filePath: replacementPath } : panel,
        ),
      );
    },
    [getReplacementOpenFilePath, settings.keepPlayAllSelectionOnClose],
  );

  const handleChangeContent = useCallback((relativePath: string, content: string): void => {
    setOpenFilesByPath((previous) => {
      const file = previous[relativePath];
      if (!file) {
        return previous;
      }
      return {
        ...previous,
        [relativePath]: {
          ...file,
          content,
          dirty: true,
        },
      };
    });
  }, []);

  const saveFiles = useCallback(
    async (files: EditorFile[]): Promise<void> => {
      if (!project) {
        return;
      }

      for (const file of files) {
        await saveProjectFile({
          projectRoot: project.rootPath,
          relativePath: file.relativePath,
          content: file.content,
        });
      }

      setOpenFilesByPath((previous) => {
        const next = { ...previous };
        for (const file of files) {
          const existing = next[file.relativePath];
          if (existing) {
            next[file.relativePath] = { ...existing, dirty: false };
          }
        }
        return next;
      });
    },
    [project],
  );

  const handleSaveActive = useCallback(async (): Promise<void> => {
    if (!activeFile) {
      return;
    }
    try {
      await saveFiles([activeFile]);
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, [activeFile, saveFiles]);

  const handleSaveAll = useCallback(async (): Promise<void> => {
    try {
      await saveFiles(dirtyFiles);
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, [dirtyFiles, saveFiles]);

  const handleSaveWorkspace = useCallback(async (): Promise<void> => {
    if (!project) {
      return;
    }

    try {
      await saveFiles(dirtyFiles);
      const workspaceFiles = allTrackedFiles.filter((file) => file.isOpen || file.includedInPlayAll);
      const savedPath = await saveWorkspaceFile({
        projectRoot: project.rootPath,
        activeFilePath,
        openFiles: workspaceFiles.map((file) => ({
          relativePath: file.relativePath,
          includedInPlayAll: file.includedInPlayAll,
        })),
      });
      setWorkspacePath(savedPath);
      await refreshRecentProjects();
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, [activeFilePath, allTrackedFiles, dirtyFiles, project, refreshRecentProjects, saveFiles]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          void handleSaveAll();
        } else {
          void handleSaveActive();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveActive, handleSaveAll]);

  const setPlayingState = useCallback((mode: 'single' | 'all', files: EditorFile[]): void => {
    setPlayback({
      status: 'playing',
      mode,
      activeFilePaths: files.map((file) => file.relativePath),
      updatedAt: new Date().toISOString(),
      error: null,
    });
  }, []);

  const handlePlayActive = useCallback(async (): Promise<void> => {
    if (!activeFile) {
      return;
    }

    setPlayback((previous) => ({ ...previous, status: 'starting', error: null }));
    const result = await playbackService.current.playFiles([activeFile], true);
    if (result.ok) {
      lastEvaluatedPlaybackSignature.current = getPlaybackSignature([activeFile]);
      setPlayingState('single', [activeFile]);
    } else {
      setPlayback({
        status: 'error',
        mode: 'single',
        activeFilePaths: [activeFile.relativePath],
        updatedAt: new Date().toISOString(),
        error: result.error,
      });
    }
  }, [activeFile, setPlayingState]);

  const handlePlayAll = useCallback(async (): Promise<void> => {
    if (includedFiles.length === 0) {
      setOperationError('Check at least one file for Play All.');
      return;
    }

    setPlayback((previous) => ({ ...previous, status: 'starting', error: null }));
    const result = await playbackService.current.playFiles(includedFiles, true);
    if (result.ok) {
      lastEvaluatedPlaybackSignature.current = getPlaybackSignature(includedFiles);
      setPlayingState('all', includedFiles);
      setOperationError(null);
    } else {
      setPlayback({
        status: 'error',
        mode: 'all',
        activeFilePaths: includedFiles.map((file) => file.relativePath),
        updatedAt: new Date().toISOString(),
        error: result.error,
      });
    }
  }, [includedFiles, setPlayingState]);

  const handleStop = useCallback(async (): Promise<void> => {
    await playbackService.current.stop();
    lastEvaluatedPlaybackSignature.current = '';
    setPlayback(stoppedPlaybackState);
  }, []);

  const handlePanic = useCallback(async (): Promise<void> => {
    await playbackService.current.panic();
    lastEvaluatedPlaybackSignature.current = '';
    setPlayback(stoppedPlaybackState);
  }, []);

  const livePlaybackFiles = useMemo(() => {
    if (playback.status !== 'playing') {
      return [];
    }

    if (playback.mode === 'all') {
      return includedFiles;
    }

    return playback.activeFilePaths
      .map((relativePath) => openFilesByPath[relativePath])
      .filter((file): file is EditorFile => Boolean(file));
  }, [includedFiles, openFilesByPath, playback.activeFilePaths, playback.mode, playback.status]);

  const livePlaybackSignature = useMemo(() => {
    return getPlaybackSignature(livePlaybackFiles);
  }, [livePlaybackFiles]);

  useEffect(() => {
    if (playback.status !== 'playing') {
      return undefined;
    }

    if (livePlaybackFiles.length === 0) {
      void playbackService.current.stop().then(() => {
        lastEvaluatedPlaybackSignature.current = '';
        setPlayback(stoppedPlaybackState);
      });
      return undefined;
    }

    if (livePlaybackSignature === lastEvaluatedPlaybackSignature.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void playbackService.current.playFiles(livePlaybackFiles, false).then((result) => {
        if (result.ok) {
          lastEvaluatedPlaybackSignature.current = livePlaybackSignature;
          setPlayingState(playback.mode ?? 'all', livePlaybackFiles);
          return;
        }
        setPlayback({
          status: 'error',
          mode: playback.mode,
          activeFilePaths: livePlaybackFiles.map((file) => file.relativePath),
          updatedAt: new Date().toISOString(),
          error: result.error,
        });
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [livePlaybackFiles, livePlaybackSignature, playback.mode, playback.status, setPlayingState]);

  const handleSplit = useCallback(
    (direction: EditorSplitDirection): void => {
      setSplitDirection(direction);
      setEditorPanels((previous) => {
        const nextPanelId = `panel-${Date.now()}`;
        return [...previous, { id: nextPanelId, filePath: activeFilePath }];
      });
    },
    [activeFilePath],
  );

  const handleClosePanel = useCallback((): void => {
    if (editorPanels.length <= 1) {
      return;
    }

    const activeIndex = editorPanels.findIndex((panel) => panel.id === activePanelId);
    const nextPanels = editorPanels.filter((panel) => panel.id !== activePanelId);
    const fallbackPanel = nextPanels[Math.max(0, activeIndex - 1)] ?? nextPanels[0];
    setEditorPanels(nextPanels);
    if (fallbackPanel) {
      setActivePanelId(fallbackPanel.id);
    }
  }, [activePanelId, editorPanels]);

  const beginSidebarResize = useCallback(
    (side: 'left' | 'right', event: React.PointerEvent<HTMLDivElement>): void => {
      event.preventDefault();
      const startX = event.clientX;
      const startLeft = leftSidebarWidth;
      const startRight = rightSidebarWidth;

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        if (side === 'left') {
          setLeftSidebarWidth(clamp(startLeft + moveEvent.clientX - startX, sidebarMinWidth, sidebarMaxWidth));
          return;
        }

        setRightSidebarWidth(clamp(startRight - (moveEvent.clientX - startX), sidebarMinWidth, sidebarMaxWidth));
      };

      const handlePointerUp = (): void => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [leftSidebarWidth, rightSidebarWidth],
  );

  if (!project) {
    return (
      <>
        <WelcomeScreen
          recentProjects={recentProjects}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onOpenRecentProject={handleOpenRecentProject}
          busy={busy}
        />
        {operationError ? <div className="toast-error">{operationError}</div> : null}
      </>
    );
  }

  return (
    <div className="app-shell">
      <PlaybackControls
        playback={playback}
        settings={settings}
        activeFileName={activeFile?.name ?? null}
        includedCount={includedFiles.length}
        dirtyCount={dirtyFiles.length}
        panelCount={editorPanels.length}
        onPlayActive={handlePlayActive}
        onPlayAll={handlePlayAll}
        onStop={handleStop}
        onPanic={handlePanic}
        onSaveActive={handleSaveActive}
        onSaveAll={handleSaveAll}
        onSaveWorkspace={handleSaveWorkspace}
        onGoHome={handleGoHome}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSplitVertical={() => handleSplit('vertical')}
        onSplitHorizontal={() => handleSplit('horizontal')}
        onClosePanel={handleClosePanel}
        onToggleKeepSelectionOnClose={(enabled) =>
          setSettings((previous) => ({ ...previous, keepPlayAllSelectionOnClose: enabled }))
        }
        canPlayActive={Boolean(activeFile)}
        canPlayAll={includedFiles.length > 0}
        canSaveActive={Boolean(activeFile?.dirty)}
        canSaveAll={dirtyFiles.length > 0}
      />

      <div
        className="workspace-grid"
        style={{
          gridTemplateColumns: `${leftSidebarWidth}px 6px minmax(0, 1fr) 6px ${rightSidebarWidth}px`,
        }}
      >
        <FileExplorer
          projectName={project.name}
          projectRoot={project.rootPath}
          files={project.files}
          openFilesByPath={openFilesByPath}
          activeFilePath={activeFilePath}
          newFileName={newFileName}
          onNewFileNameChange={setNewFileName}
          onCreateFile={handleCreateFile}
          onOpenFile={handleOpenFile}
          onToggleIncluded={handleToggleIncluded}
          onOpenProject={handleOpenProject}
        />
        <div
          className="resize-handle resize-handle-left"
          role="separator"
          aria-label="Resize left sidebar"
          onPointerDown={(event) => beginSidebarResize('left', event)}
        />
        <EditorPane
          openFiles={openFiles}
          panels={editorPanels}
          activePanelId={activePanelId}
          splitDirection={splitDirection}
          onActivatePanel={setActivePanelId}
          onActivateFile={setPanelFile}
          onCloseFile={handleCloseFile}
          onChangeContent={handleChangeContent}
        />
        <div
          className="resize-handle resize-handle-right"
          role="separator"
          aria-label="Resize right sidebar"
          onPointerDown={(event) => beginSidebarResize('right', event)}
        />
        <InspectorPanel
          sampleServer={project.sampleServer}
          playbackError={playback.error}
          workspacePath={workspacePath}
        />
      </div>

      {operationError ? <div className="toast-error">{operationError}</div> : null}
    </div>
  );
};
