import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OpenFileState,
  ProjectFile,
  ProjectSnapshot,
  WorkspaceSnapshot,
} from '../../shared/types';
import { EditorPane } from '../features/editor/EditorPane';
import { FileExplorer } from '../features/files/FileExplorer';
import { PlaybackControls } from '../features/playback/PlaybackControls';
import { InspectorPanel } from '../features/sidebar-right/InspectorPanel';
import { WelcomeScreen } from '../features/workspace/WelcomeScreen';
import {
  createStrudelFile,
  loadWorkspaceFile,
  openProjectFolder,
  readProjectFile,
  saveProjectFile,
  saveWorkspaceFile,
} from '../services/filesystem/studioFilesystem';
import { StrudelPlaybackService } from '../services/strudel/StrudelPlaybackService';
import type { EditorFile, PlaybackState, WorkbenchProject } from '../types/workbench';
import { stoppedPlaybackState } from '../types/workbench';

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

const getPlaybackSignature = (files: EditorFile[]): string => {
  return files
    .map((file) => `${file.relativePath}\u0000${file.includedInPlayAll}\u0000${file.content}`)
    .join('\u0001');
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

const createEditorFilesFromWorkspace = (workspace: WorkspaceSnapshot): Record<string, EditorFile> => {
  return workspace.openFiles.reduce<Record<string, EditorFile>>((accumulator, file: OpenFileState) => {
    accumulator[file.relativePath] = createEditorFile(
      workspace.project,
      file.relativePath,
      file.content,
      file.includedInPlayAll,
    );
    return accumulator;
  }, {});
};

export const App = (): JSX.Element => {
  const playbackService = useRef(new StrudelPlaybackService());
  const lastEvaluatedPlaybackSignature = useRef('');
  const [project, setProject] = useState<WorkbenchProject | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [openFilesByPath, setOpenFilesByPath] = useState<Record<string, EditorFile>>({});
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(stoppedPlaybackState);

  const openFiles = useMemo(
    () => Object.values(openFilesByPath).filter((file) => file.isOpen),
    [openFilesByPath],
  );
  const activeFile = activeFilePath ? openFilesByPath[activeFilePath] ?? null : null;
  const includedFiles = openFiles.filter((file) => file.includedInPlayAll);
  const dirtyFiles = openFiles.filter((file) => file.dirty);

  useEffect(() => {
    playbackService.current.setSampleManifestUrl(project?.sampleServer?.manifestUrl ?? null);
  }, [project?.sampleServer?.manifestUrl]);

  const resetWorkbench = useCallback(async (snapshot: ProjectSnapshot): Promise<void> => {
    await playbackService.current.stop();
    setProject(snapshot);
    setWorkspacePath(null);
    setOpenFilesByPath({});
    setActiveFilePath(null);
    setPlayback(stoppedPlaybackState);
    setOperationError(null);
  }, []);

  const handleOpenProject = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const snapshot = await openProjectFolder();
      if (snapshot) {
        await resetWorkbench(snapshot);
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [resetWorkbench]);

  const handleLoadWorkspace = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const workspace = await loadWorkspaceFile();
      if (!workspace) {
        return;
      }

      await playbackService.current.stop();
      setProject(workspace.project);
      setWorkspacePath(workspace.workspacePath);
      setOpenFilesByPath(createEditorFilesFromWorkspace(workspace));
      setActiveFilePath(workspace.activeFilePath);
      setPlayback(stoppedPlaybackState);
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const openFile = useCallback(
    async (relativePath: string, includedInPlayAll = false): Promise<EditorFile | null> => {
      if (!project) {
        return null;
      }

      const existing = openFilesByPath[relativePath];
      if (existing) {
        const nextFile = { ...existing, isOpen: true, includedInPlayAll: existing.includedInPlayAll || includedInPlayAll };
        setOpenFilesByPath((previous) => ({ ...previous, [relativePath]: nextFile }));
        setActiveFilePath(relativePath);
        return nextFile;
      }

      const content = await readProjectFile(project.rootPath, relativePath);
      const editorFile = createEditorFile(project, relativePath, content, includedInPlayAll);
      setOpenFilesByPath((previous) => ({ ...previous, [relativePath]: editorFile }));
      setActiveFilePath(relativePath);
      return editorFile;
    },
    [openFilesByPath, project],
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
      setActiveFilePath(relativePath);
      setNewFileName('');
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [newFileName, project]);

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

  const handleCloseFile = useCallback(
    (relativePath: string): void => {
      setOpenFilesByPath((previous) => {
        const next = { ...previous };
        delete next[relativePath];
        return next;
      });

      if (activeFilePath === relativePath) {
        const remaining = openFiles.filter((file) => file.relativePath !== relativePath);
        setActiveFilePath(remaining[0]?.relativePath ?? null);
      }
    },
    [activeFilePath, openFiles],
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
      const savedPath = await saveWorkspaceFile({
        projectRoot: project.rootPath,
        activeFilePath,
        openFiles: openFiles.map((file) => ({
          relativePath: file.relativePath,
          includedInPlayAll: file.includedInPlayAll,
        })),
      });
      setWorkspacePath(savedPath);
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, [activeFilePath, dirtyFiles, openFiles, project, saveFiles]);

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

    setPlayback({ ...playback, status: 'starting', error: null });
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
  }, [activeFile, playback, setPlayingState]);

  const handlePlayAll = useCallback(async (): Promise<void> => {
    if (includedFiles.length === 0) {
      setOperationError('Check at least one open file for Play All.');
      return;
    }

    setPlayback({ ...playback, status: 'starting', error: null });
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
  }, [includedFiles, playback, setPlayingState]);

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
      return openFiles.filter((file) => file.includedInPlayAll);
    }

    return playback.activeFilePaths
      .map((relativePath) => openFilesByPath[relativePath])
      .filter((file): file is EditorFile => Boolean(file));
  }, [openFiles, openFilesByPath, playback.activeFilePaths, playback.mode, playback.status]);

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

  if (!project) {
    return (
      <>
        <WelcomeScreen onOpenProject={handleOpenProject} onLoadWorkspace={handleLoadWorkspace} busy={busy} />
        {operationError ? <div className="toast-error">{operationError}</div> : null}
      </>
    );
  }

  return (
    <div className="app-shell">
      <PlaybackControls
        playback={playback}
        activeFileName={activeFile?.name ?? null}
        includedCount={includedFiles.length}
        dirtyCount={dirtyFiles.length}
        onPlayActive={handlePlayActive}
        onPlayAll={handlePlayAll}
        onStop={handleStop}
        onPanic={handlePanic}
        onSaveActive={handleSaveActive}
        onSaveAll={handleSaveAll}
        onSaveWorkspace={handleSaveWorkspace}
        canPlayActive={Boolean(activeFile)}
        canPlayAll={includedFiles.length > 0}
        canSaveActive={Boolean(activeFile?.dirty)}
        canSaveAll={dirtyFiles.length > 0}
      />

      <div className="workspace-grid">
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
        <EditorPane
          openFiles={openFiles}
          activeFile={activeFile}
          onActivateFile={setActiveFilePath}
          onCloseFile={handleCloseFile}
          onChangeContent={handleChangeContent}
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
