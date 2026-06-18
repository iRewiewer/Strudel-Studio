import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OpenFileState,
  ProjectFile,
  ProjectSessionSnapshot,
  ProjectSnapshot,
  RecentProject,
  StudioError,
  StudioPluginSummary,
  StudioTheme,
  WorkspaceEditorPanelNode,
} from '../../shared/types';
import { defaultStudioTheme } from '../../shared/theme';
import { EditorPane } from '../features/editor/EditorPane';
import { FileExplorer } from '../features/files/FileExplorer';
import { OptionsModal } from '../features/options/OptionsModal';
import { PlaybackControls } from '../features/playback/PlaybackControls';
import { PluginManagerModal, type PluginLoadState } from '../features/plugins/PluginManagerModal';
import { ExternalSamplesModal } from '../features/samples/ExternalSamplesModal';
import { InspectorPanel } from '../features/sidebar-right/InspectorPanel';
import { ThemeSelectorModal } from '../features/themes/ThemeSelectorModal';
import { WelcomeScreen } from '../features/workspace/WelcomeScreen';
import {
  createStrudelFile,
  addStudioPluginSource,
  deleteStudioPlugin,
  importStudioPluginFolder,
  listStudioPlugins,
  listRecentProjects,
  newProjectFolder,
  openProjectFolder,
  openRecentProject,
  readProjectFile,
  removeRecentProject,
  readStudioPluginScriptBundle,
  revealExternalSamplesDirectory,
  revealStudioPluginsDirectory,
  saveProjectFile,
  saveWorkspaceFile,
} from '../services/filesystem/studioFilesystem';
import { StrudelPlaybackService } from '../services/strudel/StrudelPlaybackService';
import {
  createCustomExternalSamplePack,
  externalSamplePacks,
  fetchExternalSamplePackIndex,
  getExternalSampleLoadSources,
  normalizeExternalSampleSource,
  prefetchExternalSampleFiles,
  type ExternalSampleGroup,
  type ExternalSamplePack,
  type ExternalSamplePackState,
} from '../services/strudel/externalSamplePacks';
import type { PlaybackHighlightRange } from '../services/strudel/playbackHighlights';
import {
  updateStrudelSliderArgument,
  type StrudelSliderArgumentName,
  type StrudelSliderDescriptor,
} from '../services/strudel/sliderScanner';
import { applyStudioTheme } from '../services/themes/applyTheme';
import type {
  EditorFile,
  EditorPanelLeaf,
  EditorPanelNode,
  EditorSplitDirection,
  PlaybackState,
  StudioSettings,
  WorkbenchProject,
} from '../types/workbench';
import { stoppedPlaybackState } from '../types/workbench';

const defaultPanelId = 'panel-1';
const leftSidebarMinWidth = 220;
const rightSidebarMinWidth = 280;
const sidebarMaxWidth = 520;
const collapsedSidebarWidth = 44;
const themeStorageKey = 'strudel-studio:active-theme';
const settingsStorageKey = 'strudel-studio:settings';

const defaultStudioSettings: StudioSettings = {
  keepPlayAllSelectionOnClose: true,
  openFileOnInclude: false,
  liveReevaluate: true,
};

const normalizeThemeText = (value: unknown, fallback: string): string => {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const normalizeThemeVersion = (value: unknown): string => {
  const version = normalizeThemeText(value, defaultStudioTheme.themeVersion);
  return version.replace(/^v\s*/i, '') || defaultStudioTheme.themeVersion;
};

const normalizeThemeFontSize = (value: unknown, fallback: number): number => {
  const size = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(size)) {
    return fallback;
  }

  return clamp(size, 10, 28);
};

const loadStoredTheme = (): StudioTheme => {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (!storedTheme) {
      return defaultStudioTheme;
    }

    const parsed = JSON.parse(storedTheme) as Partial<StudioTheme>;
    const themeName = normalizeThemeText(parsed.name, defaultStudioTheme.name);
    return {
      version: 1,
      name: themeName,
      author: normalizeThemeText(
        parsed.author,
        themeName === defaultStudioTheme.name ? defaultStudioTheme.author : 'Unknown',
      ),
      themeVersion: normalizeThemeVersion(parsed.themeVersion),
      colors: {
        ...defaultStudioTheme.colors,
        ...(parsed.colors ?? {}),
      },
      fonts: {
        ...defaultStudioTheme.fonts,
        ...(parsed.fonts ?? {}),
      },
      fontSizes: {
        ...defaultStudioTheme.fontSizes,
        interface: normalizeThemeFontSize(parsed.fontSizes?.interface, defaultStudioTheme.fontSizes.interface),
        editor: normalizeThemeFontSize(parsed.fontSizes?.editor, defaultStudioTheme.fontSizes.editor),
      },
    };
  } catch {
    return defaultStudioTheme;
  }
};

const loadStoredSettings = (): StudioSettings => {
  try {
    const storedSettings = window.localStorage.getItem(settingsStorageKey);
    if (!storedSettings) {
      return defaultStudioSettings;
    }

    const parsed = JSON.parse(storedSettings) as Partial<StudioSettings>;
    return {
      keepPlayAllSelectionOnClose:
        typeof parsed.keepPlayAllSelectionOnClose === 'boolean'
          ? parsed.keepPlayAllSelectionOnClose
          : defaultStudioSettings.keepPlayAllSelectionOnClose,
      openFileOnInclude:
        typeof parsed.openFileOnInclude === 'boolean'
          ? parsed.openFileOnInclude
          : defaultStudioSettings.openFileOnInclude,
      liveReevaluate:
        typeof parsed.liveReevaluate === 'boolean'
          ? parsed.liveReevaluate
          : defaultStudioSettings.liveReevaluate,
    };
  } catch {
    return defaultStudioSettings;
  }
};

const uniqueFilePaths = (filePaths: Array<string | null | undefined>): string[] => {
  return [...new Set(filePaths.filter((filePath): filePath is string => Boolean(filePath)))];
};

const createPanelLeaf = (id: string, filePath: string | null, filePaths?: string[]): EditorPanelLeaf => ({
  type: 'leaf',
  id,
  filePath,
  filePaths: uniqueFilePaths([...(filePaths ?? []), filePath]),
});

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
  playbackVolume = 1,
  isOpen = true,
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
    playbackVolume,
    isOpen,
  };
};

const createEditorFilesFromSession = (session: ProjectSessionSnapshot): Record<string, EditorFile> => {
  return session.openFiles.reduce<Record<string, EditorFile>>((accumulator, file: OpenFileState) => {
    accumulator[file.relativePath] = createEditorFile(
      session.project,
      file.relativePath,
      file.content,
      file.includedInPlayAll,
      file.playbackVolume,
      file.isOpen ?? true,
    );
    return accumulator;
  }, {});
};

const getPlaybackSignature = (files: EditorFile[]): string => {
  return files
    .map((file) => `${file.relativePath}\u0000${file.includedInPlayAll}\u0000${file.playbackVolume}\u0000${file.content}`)
    .join('\u0001');
};

const getSliderValueSignature = (files: EditorFile[], sliderValuesById: Record<string, number>): string => {
  const filePrefixes = files.map((file) => `studio:${file.relativePath}:slider:`);

  return Object.entries(sliderValuesById)
    .filter(([sliderId]) => filePrefixes.some((prefix) => sliderId.startsWith(prefix)))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sliderId, value]) => `${sliderId}\u0000${value}`)
    .join('\u0001');
};

const getPlaybackEvaluationSignature = (
  files: EditorFile[],
  sliderValuesById: Record<string, number>,
): string => {
  return `${getPlaybackSignature(files)}\u0002${getSliderValueSignature(files, sliderValuesById)}`;
};

const getWorkspaceSignature = (
  projectRoot: string,
  activeFilePath: string | null,
  files: EditorFile[],
  editorLayout: EditorPanelNode,
  activePanelId: string,
): string => {
  const workspaceFiles = files
    .filter((file) => file.isOpen || file.includedInPlayAll)
    .map((file) => ({
      relativePath: file.relativePath,
      includedInPlayAll: file.includedInPlayAll,
      playbackVolume: file.playbackVolume,
      isOpen: file.isOpen,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return JSON.stringify({
    projectRoot,
    activeFilePath,
    activePanelId,
    editorLayout,
    openFiles: workspaceFiles,
  });
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const findPanelLeaf = (node: EditorPanelNode, panelId: string): EditorPanelLeaf | null => {
  if (node.type === 'leaf') {
    return node.id === panelId ? node : null;
  }

  return findPanelLeaf(node.children[0], panelId) ?? findPanelLeaf(node.children[1], panelId);
};

const findFirstPanelLeaf = (node: EditorPanelNode): EditorPanelLeaf => {
  return node.type === 'leaf' ? node : findFirstPanelLeaf(node.children[0]);
};

const countPanelLeaves = (node: EditorPanelNode): number => {
  return node.type === 'leaf' ? 1 : countPanelLeaves(node.children[0]) + countPanelLeaves(node.children[1]);
};

const mapPanelLeaves = (
  node: EditorPanelNode,
  mapper: (leaf: EditorPanelLeaf) => EditorPanelLeaf,
): EditorPanelNode => {
  if (node.type === 'leaf') {
    return mapper(node);
  }

  return {
    ...node,
    children: [mapPanelLeaves(node.children[0], mapper), mapPanelLeaves(node.children[1], mapper)],
  };
};

const getPanelFilePaths = (panel: EditorPanelLeaf): string[] => {
  return uniqueFilePaths([...(panel.filePaths ?? []), panel.filePath]);
};

const getLayoutFilePaths = (node: EditorPanelNode): string[] => {
  if (node.type === 'leaf') {
    return getPanelFilePaths(node);
  }

  return uniqueFilePaths([
    ...getLayoutFilePaths(node.children[0]),
    ...getLayoutFilePaths(node.children[1]),
  ]);
};

const layoutHasFilePath = (node: EditorPanelNode, relativePath: string): boolean => {
  return getLayoutFilePaths(node).includes(relativePath);
};

const withPanelFile = (panel: EditorPanelLeaf, relativePath: string | null): EditorPanelLeaf => {
  if (!relativePath) {
    return { ...panel, filePath: null };
  }

  return {
    ...panel,
    filePath: relativePath,
    filePaths: uniqueFilePaths([...getPanelFilePaths(panel), relativePath]),
  };
};

const attachFilesToPanel = (
  node: EditorPanelNode,
  panelId: string,
  relativePaths: string[],
): EditorPanelNode => {
  if (relativePaths.length === 0) {
    return node;
  }

  return mapPanelLeaves(node, (panel) => {
    if (panel.id !== panelId) {
      return panel;
    }

    const nextFilePaths = uniqueFilePaths([...getPanelFilePaths(panel), ...relativePaths]);
    return {
      ...panel,
      filePath: panel.filePath ?? nextFilePaths[0] ?? null,
      filePaths: nextFilePaths,
    };
  });
};

const closeFileInPanel = (
  node: EditorPanelNode,
  panelId: string,
  relativePath: string,
): EditorPanelNode => {
  return mapPanelLeaves(node, (panel) => {
    if (panel.id !== panelId) {
      return panel;
    }

    const previousFilePaths = getPanelFilePaths(panel);
    const closedIndex = previousFilePaths.indexOf(relativePath);
    const nextFilePaths = previousFilePaths.filter((filePath) => filePath !== relativePath);
    const nextFilePath = panel.filePath === relativePath
      ? nextFilePaths[Math.min(Math.max(closedIndex, 0), nextFilePaths.length - 1)] ?? null
      : panel.filePath;

    return {
      ...panel,
      filePath: nextFilePath,
      filePaths: nextFilePaths,
    };
  });
};

const splitPanelLeaf = (
  node: EditorPanelNode,
  panelId: string,
  direction: EditorSplitDirection,
  newPanelId: string,
  filePath: string | null,
): EditorPanelNode => {
  if (node.type === 'leaf') {
    return node.id === panelId
      ? {
          type: 'split',
          id: `split-${Date.now()}`,
          direction,
          children: [node, createPanelLeaf(newPanelId, filePath)],
        }
      : node;
  }

  return {
    ...node,
    children: [
      splitPanelLeaf(node.children[0], panelId, direction, newPanelId, filePath),
      splitPanelLeaf(node.children[1], panelId, direction, newPanelId, filePath),
    ],
  };
};

const removePanelLeaf = (node: EditorPanelNode, panelId: string): EditorPanelNode | null => {
  if (node.type === 'leaf') {
    return node.id === panelId ? null : node;
  }

  const left = removePanelLeaf(node.children[0], panelId);
  const right = removePanelLeaf(node.children[1], panelId);

  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  return { ...node, children: [left, right] };
};

const sanitizeSavedLayout = (
  node: WorkspaceEditorPanelNode | null,
  knownFilePaths: Set<string>,
  fallbackFilePath: string | null,
): EditorPanelNode => {
  const sanitizeNode = (currentNode: WorkspaceEditorPanelNode | null): EditorPanelNode | null => {
    if (!currentNode) {
      return null;
    }

    if (currentNode.type === 'leaf') {
      const savedFilePaths = Array.isArray(currentNode.filePaths)
        ? currentNode.filePaths.filter((filePath) => knownFilePaths.has(filePath))
        : [];
      const filePath = currentNode.filePath && knownFilePaths.has(currentNode.filePath)
        ? currentNode.filePath
        : savedFilePaths[0] ?? null;

      return createPanelLeaf(
        currentNode.id || `panel-${Date.now()}`,
        filePath,
        savedFilePaths,
      );
    }

    const left = sanitizeNode(currentNode.children[0]);
    const right = sanitizeNode(currentNode.children[1]);
    if (!left) {
      return right;
    }
    if (!right) {
      return left;
    }

    return {
      type: 'split',
      id: currentNode.id || `split-${Date.now()}`,
      direction: currentNode.direction,
      children: [left, right],
    };
  };

  return sanitizeNode(node) ?? createPanelLeaf(defaultPanelId, fallbackFilePath);
};

export const App = (): JSX.Element => {
  const playbackService = useRef(new StrudelPlaybackService());
  const lastEvaluatedPlaybackSignature = useRef('');
  const [project, setProject] = useState<WorkbenchProject | null>(null);
  const [savedWorkspaceSignature, setSavedWorkspaceSignature] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [openFilesByPath, setOpenFilesByPath] = useState<Record<string, EditorFile>>({});
  const [sliderValuesById, setSliderValuesById] = useState<Record<string, number>>({});
  const [fileErrorsByPath, setFileErrorsByPath] = useState<Record<string, StudioError>>({});
  const [playbackHighlightRangesByPath, setPlaybackHighlightRangesByPath] = useState<
    Record<string, PlaybackHighlightRange[]>
  >({});
  const [editorLayout, setEditorLayout] = useState<EditorPanelNode>(createPanelLeaf(defaultPanelId, null));
  const [activePanelId, setActivePanelId] = useState(defaultPanelId);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(300);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(280);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(stoppedPlaybackState);
  const [activeTheme, setActiveTheme] = useState<StudioTheme>(() => loadStoredTheme());
  const [settings, setSettings] = useState<StudioSettings>(() => loadStoredSettings());
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [externalSamplesOpen, setExternalSamplesOpen] = useState(false);
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
  const [customExternalSamplePacks, setCustomExternalSamplePacks] = useState<ExternalSamplePack[]>([]);
  const [hiddenExternalSamplePackIds, setHiddenExternalSamplePackIds] = useState<Set<string>>(() => new Set());
  const [externalSamplePackStates, setExternalSamplePackStates] = useState<Record<string, ExternalSamplePackState>>({});
  const [plugins, setPlugins] = useState<StudioPluginSummary[]>([]);
  const [pluginsDirectory, setPluginsDirectory] = useState('');
  const [pluginStates, setPluginStates] = useState<Record<string, PluginLoadState>>({});

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
  const externalSampleGroups = useMemo<ExternalSampleGroup[]>(
    () =>
      Object.values(externalSamplePackStates)
        .filter((pack): pack is ExternalSamplePackState & { status: 'loaded' } => pack.status === 'loaded')
        .map((pack) => ({
          id: pack.id,
          title: pack.title,
          source: pack.source,
          names: pack.names,
          files: pack.files,
        })),
    [externalSamplePackStates],
  );
  const availableExternalSamplePacks = useMemo(
    () => [
      ...externalSamplePacks.filter((pack) => !hiddenExternalSamplePackIds.has(pack.id)),
      ...customExternalSamplePacks,
    ],
    [customExternalSamplePacks, hiddenExternalSamplePackIds],
  );
  const activePanel = findPanelLeaf(editorLayout, activePanelId) ?? findFirstPanelLeaf(editorLayout);
  const activeFilePath = activePanel?.filePath ?? null;
  const activeFile = activeFilePath ? openFilesByPath[activeFilePath] ?? null : null;
  const panelCount = countPanelLeaves(editorLayout);
  const currentWorkspaceSignature = useMemo(
    () => (project
      ? getWorkspaceSignature(project.rootPath, activeFilePath, allTrackedFiles, editorLayout, activePanelId)
      : null),
    [activeFilePath, activePanelId, allTrackedFiles, editorLayout, project],
  );
  const workspaceDirty = Boolean(
    project && currentWorkspaceSignature && currentWorkspaceSignature !== savedWorkspaceSignature,
  );
  const hasUnsavedChanges = dirtyFiles.length > 0;
  const hasUnsavedChangesRef = useRef(false);

  const refreshRecentProjects = useCallback(async (): Promise<void> => {
    setRecentProjects(await listRecentProjects());
  }, []);

  useEffect(() => {
    applyStudioTheme(activeTheme);
    try {
      window.localStorage.setItem(themeStorageKey, JSON.stringify(activeTheme));
    } catch {
      // Local storage can be unavailable in restricted environments; the live theme still applies.
    }
  }, [activeTheme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    } catch {
      // Local storage can be unavailable in restricted environments; the in-memory settings still apply.
    }
  }, [settings]);

  useEffect(() => {
    const service = playbackService.current;
    service.setPlaybackHighlightListener(setPlaybackHighlightRangesByPath);
    return () => service.setPlaybackHighlightListener(null);
  }, []);

  useEffect(() => {
    void refreshRecentProjects().catch((error) => {
      setOperationError(error instanceof Error ? error.message : String(error));
    });
  }, [refreshRecentProjects]);

  const saveCurrentWorkspace = useCallback(
    async (signatureToSave = currentWorkspaceSignature): Promise<void> => {
      if (!project || !signatureToSave) {
        return;
      }

      const workspaceFiles = allTrackedFiles.filter((file) => file.isOpen || file.includedInPlayAll);
      await saveWorkspaceFile({
        projectRoot: project.rootPath,
        activeFilePath,
        activePanelId,
        editorLayout,
        openFiles: workspaceFiles.map((file) => ({
          relativePath: file.relativePath,
          includedInPlayAll: file.includedInPlayAll,
          playbackVolume: file.playbackVolume,
          isOpen: file.isOpen,
        })),
      });

      setSavedWorkspaceSignature(signatureToSave);
      await refreshRecentProjects();
    },
    [activeFilePath, activePanelId, allTrackedFiles, currentWorkspaceSignature, editorLayout, project, refreshRecentProjects],
  );

  useEffect(() => {
    if (!workspaceDirty || !currentWorkspaceSignature) {
      return undefined;
    }

    const signatureToSave = currentWorkspaceSignature;
    const timeout = window.setTimeout(() => {
      void saveCurrentWorkspace(signatureToSave).catch((error) => {
        setOperationError(error instanceof Error ? error.message : String(error));
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [currentWorkspaceSignature, saveCurrentWorkspace, workspaceDirty]);

  useEffect(() => {
    playbackService.current.setSampleManifestUrl(project?.sampleServer?.manifestUrl ?? null);
  }, [project?.sampleServer?.manifestUrl]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    return window.studio.onCloseRequested(() => {
      void (async () => {
        const shouldClose =
          !hasUnsavedChangesRef.current ||
          window.confirm('You have unsaved changes. Are you sure you want to close Strudel Studio?');

        if (!shouldClose) {
          await window.studio.confirmClose(false);
          return;
        }

        try {
          if (workspaceDirty && currentWorkspaceSignature) {
            await saveCurrentWorkspace(currentWorkspaceSignature);
          }
          await window.studio.confirmClose(true);
        } catch (error) {
          setOperationError(error instanceof Error ? error.message : String(error));
          await window.studio.confirmClose(false);
        }
      })().catch((error) => {
        setOperationError(error instanceof Error ? error.message : String(error));
      });
    });
  }, [currentWorkspaceSignature, saveCurrentWorkspace, workspaceDirty]);

  const setPanelFile = useCallback((panelId: string, relativePath: string | null): void => {
    setActivePanelId(panelId);
    setEditorLayout((previous) =>
      mapPanelLeaves(previous, (panel) => (panel.id === panelId ? withPanelFile(panel, relativePath) : panel)),
    );
  }, []);

  const applySession = useCallback(
    async (session: ProjectSessionSnapshot): Promise<void> => {
      await playbackService.current.stop();
      lastEvaluatedPlaybackSignature.current = '';
      const filesByPath = createEditorFilesFromSession(session);
      const visibleFilePaths = Object.values(filesByPath)
        .filter((file) => file.isOpen)
        .map((file) => file.relativePath);
      const firstOpenFilePath = visibleFilePaths[0] ?? null;
      const activePath = session.activeFilePath && visibleFilePaths.includes(session.activeFilePath)
        ? session.activeFilePath
        : firstOpenFilePath;
      let nextEditorLayout = sanitizeSavedLayout(
        session.editorLayout,
        new Set(visibleFilePaths),
        activePath,
      );
      const nextActivePanelId = session.activePanelId && findPanelLeaf(nextEditorLayout, session.activePanelId)
        ? session.activePanelId
        : findFirstPanelLeaf(nextEditorLayout).id;
      const unassignedFilePaths = visibleFilePaths.filter(
        (relativePath) => !layoutHasFilePath(nextEditorLayout, relativePath),
      );
      nextEditorLayout = attachFilesToPanel(nextEditorLayout, nextActivePanelId, unassignedFilePaths);
      const nextActiveFilePath = findPanelLeaf(nextEditorLayout, nextActivePanelId)?.filePath ?? activePath;

      setProject(session.project);
      setOpenFilesByPath(filesByPath);
      setSliderValuesById({});
      setFileErrorsByPath({});
      setPlaybackHighlightRangesByPath({});
      setEditorLayout(nextEditorLayout);
      setActivePanelId(nextActivePanelId);
      setSavedWorkspaceSignature(
        getWorkspaceSignature(
          session.project.rootPath,
          nextActiveFilePath,
          Object.values(filesByPath),
          nextEditorLayout,
          nextActivePanelId,
        ),
      );
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

  const handleRemoveRecentProject = useCallback(async (projectRoot: string): Promise<void> => {
    try {
      setRecentProjects(await removeRecentProject(projectRoot));
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const handleGoHome = useCallback(async (): Promise<void> => {
    await playbackService.current.stop();
    try {
      if (workspaceDirty && currentWorkspaceSignature) {
        await saveCurrentWorkspace(currentWorkspaceSignature);
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
      return;
    }
    lastEvaluatedPlaybackSignature.current = '';
    setProject(null);
    setSliderValuesById({});
    setSavedWorkspaceSignature(null);
    setPlayback(stoppedPlaybackState);
    await refreshRecentProjects();
  }, [currentWorkspaceSignature, refreshRecentProjects, saveCurrentWorkspace, workspaceDirty]);

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

      const existing = openFilesByPath[relativePath];
      if (!existing) {
        const content = await readProjectFile(project.rootPath, relativePath);
        const trackedFile = createEditorFile(
          project,
          relativePath,
          content,
          includedInPlayAll,
          1,
          includedInPlayAll && settings.openFileOnInclude,
        );
        setOpenFilesByPath((previous) => ({ ...previous, [relativePath]: trackedFile }));
        if (trackedFile.isOpen) {
          setPanelFile(activePanelId, relativePath);
        }
        return;
      }

      const shouldOpenFile = includedInPlayAll && settings.openFileOnInclude;
      setOpenFilesByPath((previous) => {
        const current = previous[relativePath];
        if (!current) {
          return previous;
        }

        const nextFile = {
          ...current,
          includedInPlayAll,
          isOpen: current.isOpen || shouldOpenFile,
        };

        if (!nextFile.isOpen && !nextFile.includedInPlayAll && !nextFile.dirty) {
          const next = { ...previous };
          delete next[relativePath];
          return next;
        }

        return {
          ...previous,
          [relativePath]: nextFile,
        };
      });

      if (shouldOpenFile) {
        setPanelFile(activePanelId, relativePath);
      }
    },
    [activePanelId, openFilesByPath, project, setPanelFile, settings.openFileOnInclude],
  );

  const handleCloseFile = useCallback(
    (panelId: string, relativePath: string): void => {
      const nextLayout = closeFileInPanel(editorLayout, panelId, relativePath);
      const fileStillVisible = layoutHasFilePath(nextLayout, relativePath);

      setEditorLayout(nextLayout);

      if (fileStillVisible) {
        return;
      }

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
    },
    [editorLayout, settings.keepPlayAllSelectionOnClose],
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
    setFileErrorsByPath((previous) => {
      if (!previous[relativePath]) {
        return previous;
      }

      const next = { ...previous };
      delete next[relativePath];
      return next;
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

  const handlePlaybackVolumeChange = useCallback(
    async (relativePath: string, playbackVolume: number): Promise<void> => {
      if (!project) {
        return;
      }

      const existing = openFilesByPath[relativePath];
      if (existing) {
        setOpenFilesByPath((previous) => ({
          ...previous,
          [relativePath]: {
            ...existing,
            playbackVolume,
          },
        }));
        return;
      }

      try {
        const content = await readProjectFile(project.rootPath, relativePath);
        const trackedFile = {
          ...createEditorFile(project, relativePath, content, false, playbackVolume),
          isOpen: false,
        };
        setOpenFilesByPath((previous) => ({ ...previous, [relativePath]: trackedFile }));
        setOperationError(null);
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : String(error));
      }
    },
    [openFilesByPath, project],
  );

  const handleSliderArgumentChange = useCallback(
    (slider: StrudelSliderDescriptor, argumentName: StrudelSliderArgumentName, value: number): void => {
      if (!activeFile || !Number.isFinite(value)) {
        return;
      }

      const nextContent = updateStrudelSliderArgument(activeFile.content, slider, argumentName, value);
      if (nextContent === activeFile.content) {
        return;
      }

      if (argumentName === 'value') {
        playbackService.current.setSliderValue(slider.id, value);
        setSliderValuesById((previous) => ({ ...previous, [slider.id]: value }));
      }

      handleChangeContent(activeFile.relativePath, nextContent);
    },
    [activeFile, handleChangeContent],
  );


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

  const clearPlaybackErrorsForFiles = useCallback((files: EditorFile[]): void => {
    setFileErrorsByPath((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const file of files) {
        if (next[file.relativePath]) {
          delete next[file.relativePath];
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, []);

  const recordPlaybackError = useCallback((error: StudioError, fallbackFiles: EditorFile[]): void => {
    const relativePath = error.filePath ?? fallbackFiles[0]?.relativePath;
    if (!relativePath) {
      return;
    }

    setFileErrorsByPath((previous) => ({
      ...previous,
      [relativePath]: { ...error, filePath: relativePath },
    }));
  }, []);

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
      lastEvaluatedPlaybackSignature.current = getPlaybackEvaluationSignature([activeFile], sliderValuesById);
      clearPlaybackErrorsForFiles([activeFile]);
      setPlayingState('single', [activeFile]);
    } else {
      recordPlaybackError(result.error, [activeFile]);
      setPlayback({
        status: 'error',
        mode: 'single',
        activeFilePaths: [activeFile.relativePath],
        updatedAt: new Date().toISOString(),
        error: result.error,
      });
    }
  }, [activeFile, clearPlaybackErrorsForFiles, recordPlaybackError, setPlayingState, sliderValuesById]);

  const handlePlayAll = useCallback(async (): Promise<void> => {
    if (includedFiles.length === 0) {
      setOperationError('Check at least one file for Play All.');
      return;
    }

    setPlayback((previous) => ({ ...previous, status: 'starting', error: null }));
    const result = await playbackService.current.playFiles(includedFiles, true);
    if (result.ok) {
      lastEvaluatedPlaybackSignature.current = getPlaybackEvaluationSignature(includedFiles, sliderValuesById);
      clearPlaybackErrorsForFiles(includedFiles);
      setPlayingState('all', includedFiles);
      setOperationError(null);
    } else {
      recordPlaybackError(result.error, includedFiles);
      setPlayback({
        status: 'error',
        mode: 'all',
        activeFilePaths: includedFiles.map((file) => file.relativePath),
        updatedAt: new Date().toISOString(),
        error: result.error,
      });
    }
  }, [clearPlaybackErrorsForFiles, includedFiles, recordPlaybackError, setPlayingState, sliderValuesById]);

  const handleStop = useCallback(async (): Promise<void> => {
    await playbackService.current.panic();
    lastEvaluatedPlaybackSignature.current = '';
    setPlayback(stoppedPlaybackState);
  }, []);

  const handlePreviewSound = useCallback(async (soundName: string, volume: number): Promise<void> => {
    try {
      await playbackService.current.previewSound(soundName, volume);
      lastEvaluatedPlaybackSignature.current = '';
      setPlayback(stoppedPlaybackState);
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const handleLoadExternalSamplePack = useCallback(async (pack: ExternalSamplePack): Promise<void> => {
    setExternalSamplePackStates((previous) => ({
      ...previous,
      [pack.id]: {
        id: pack.id,
        title: pack.name,
        source: pack.source,
        names: previous[pack.id]?.names ?? [],
        files: previous[pack.id]?.files ?? [],
        status: 'loading',
        error: null,
        cacheStatus: previous[pack.id]?.cacheStatus ?? 'idle',
        cachedFileCount: previous[pack.id]?.cachedFileCount ?? 0,
        cacheError: null,
      },
    }));

    try {
      const sampleIndex = await fetchExternalSamplePackIndex(pack);
      let loadError: unknown = null;
      for (const source of getExternalSampleLoadSources(pack.source)) {
        try {
          await playbackService.current.loadExternalSamples(source, pack.source);
          loadError = null;
          break;
        } catch (error) {
          loadError = error;
        }
      }
      if (loadError) {
        throw loadError;
      }
      setExternalSamplePackStates((previous) => ({
        ...previous,
        [pack.id]: {
          id: pack.id,
          title: pack.name,
          source: pack.source,
          names: sampleIndex.names,
          files: sampleIndex.files,
          status: 'loaded',
          error: null,
          cacheStatus: 'idle',
          cachedFileCount: 0,
          cacheError: null,
        },
      }));
      setOperationError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExternalSamplePackStates((previous) => ({
        ...previous,
        [pack.id]: {
          id: pack.id,
          title: pack.name,
          source: pack.source,
          names: previous[pack.id]?.names ?? [],
          files: previous[pack.id]?.files ?? [],
          status: 'error',
          error: message,
          cacheStatus: previous[pack.id]?.cacheStatus ?? 'idle',
          cachedFileCount: previous[pack.id]?.cachedFileCount ?? 0,
          cacheError: previous[pack.id]?.cacheError ?? null,
        },
      }));
      setOperationError(message);
    }
  }, []);

  const handleAddExternalSamplePack = useCallback(
    async (source: string, name: string): Promise<void> => {
      const normalizedSource = normalizeExternalSampleSource(source);
      if (!normalizedSource) {
        throw new Error('Enter an external sample source.');
      }

      const existingPack = [...externalSamplePacks, ...customExternalSamplePacks]
        .find((pack) => normalizeExternalSampleSource(pack.source) === normalizedSource);
      const pack = existingPack ?? createCustomExternalSamplePack(normalizedSource, name);

      if (!existingPack) {
        setCustomExternalSamplePacks((previous) => [...previous, pack]);
      } else if (!existingPack.custom) {
        setHiddenExternalSamplePackIds((previous) => {
          const next = new Set(previous);
          next.delete(existingPack.id);
          return next;
        });
      }

      await handleLoadExternalSamplePack(pack);
    },
    [customExternalSamplePacks, handleLoadExternalSamplePack],
  );

  const handleDeleteExternalSamplePack = useCallback((pack: ExternalSamplePack): void => {
    playbackService.current.forgetExternalSamples(pack.source);
    setExternalSamplePackStates((previous) => {
      const next = { ...previous };
      delete next[pack.id];
      return next;
    });

    if (pack.custom) {
      setCustomExternalSamplePacks((previous) => previous.filter((item) => item.id !== pack.id));
    } else {
      setHiddenExternalSamplePackIds((previous) => new Set(previous).add(pack.id));
    }
  }, []);

  const handleUnloadExternalSamplePack = useCallback((pack: ExternalSamplePack): void => {
    playbackService.current.forgetExternalSamples(pack.source);
    setExternalSamplePackStates((previous) => {
      const next = { ...previous };
      delete next[pack.id];
      return next;
    });
  }, []);

  const handleCacheExternalSamplePack = useCallback(async (pack: ExternalSamplePack): Promise<void> => {
    const currentPackState = externalSamplePackStates[pack.id];
    if (!currentPackState || currentPackState.status !== 'loaded') {
      return;
    }

    if (currentPackState.files.length === 0) {
      setOperationError('No audio files were listed for this external sample pack.');
      return;
    }

    setExternalSamplePackStates((previous) => {
      const existing = previous[pack.id];
      if (!existing || existing.status !== 'loaded') {
        return previous;
      }

      return {
        ...previous,
        [pack.id]: {
          ...existing,
          cacheStatus: 'caching',
          cachedFileCount: 0,
          cacheError: null,
        },
      };
    });

    try {
      await prefetchExternalSampleFiles(currentPackState.files, (cachedFileCount) => {
        setExternalSamplePackStates((previous) => {
          const existing = previous[pack.id];
          if (!existing || existing.status !== 'loaded') {
            return previous;
          }

          return {
            ...previous,
            [pack.id]: {
              ...existing,
              cacheStatus: 'caching',
              cachedFileCount,
            },
          };
        });
      });

      setExternalSamplePackStates((previous) => {
        const existing = previous[pack.id];
        if (!existing || existing.status !== 'loaded') {
          return previous;
        }

        return {
          ...previous,
          [pack.id]: {
            ...existing,
            cacheStatus: 'cached',
            cachedFileCount: currentPackState.files.length,
            cacheError: null,
          },
        };
      });
      setOperationError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExternalSamplePackStates((previous) => {
        const existing = previous[pack.id];
        if (!existing || existing.status !== 'loaded') {
          return previous;
        }

        return {
          ...previous,
          [pack.id]: {
            ...existing,
            cacheStatus: 'error',
            cacheError: message,
          },
        };
      });
      setOperationError(message);
    }
  }, [externalSamplePackStates]);

  const refreshPlugins = useCallback(async (): Promise<StudioPluginSummary[]> => {
    const result = await listStudioPlugins();
    setPlugins(result.plugins);
    setPluginsDirectory(result.pluginsDirectory);
    setPluginStates((previous) => {
      const availablePluginIds = new Set(result.plugins.map((plugin) => plugin.id));
      return Object.fromEntries(
        Object.entries(previous).filter(([pluginId]) => availablePluginIds.has(pluginId)),
      );
    });
    return result.plugins;
  }, []);

  const handleOpenPluginManager = useCallback((): void => {
    setPluginManagerOpen(true);
    void refreshPlugins().catch((error) => {
      setOperationError(error instanceof Error ? error.message : String(error));
    });
  }, [refreshPlugins]);

  const handleLoadPlugin = useCallback(async (plugin: StudioPluginSummary): Promise<void> => {
    setPluginStates((previous) => ({
      ...previous,
      [plugin.id]: { status: 'loading', error: null },
    }));

    try {
      const bundle = await readStudioPluginScriptBundle(plugin.path);
      await playbackService.current.loadPlugin(plugin.id, bundle.code);
      setPluginStates((previous) => ({
        ...previous,
        [plugin.id]: { status: 'loaded', error: null },
      }));
      setOperationError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPluginStates((previous) => ({
        ...previous,
        [plugin.id]: { status: 'error', error: message },
      }));
      setOperationError(message);
    }
  }, []);

  const handleUnloadPlugin = useCallback((plugin: StudioPluginSummary): void => {
    playbackService.current.unloadPlugin(plugin.id);
    setPluginStates((previous) => ({
      ...previous,
      [plugin.id]: { status: 'idle', error: null },
    }));
  }, []);

  const handleAddPlugin = useCallback(
    async (source: string, name: string): Promise<void> => {
      const previousPluginIds = new Set(plugins.map((plugin) => plugin.id));
      const result = await addStudioPluginSource({ source, name });
      setPlugins(result.plugins);
      setPluginsDirectory(result.pluginsDirectory);

      const addedPlugin = result.plugins.find((plugin) => !previousPluginIds.has(plugin.id))
        ?? result.plugins.find((plugin) => plugin.source === source.trim());
      if (addedPlugin) {
        await handleLoadPlugin(addedPlugin);
      }
    },
    [handleLoadPlugin, plugins],
  );

  const handleImportPluginFolder = useCallback(async (): Promise<void> => {
    const previousPluginIds = new Set(plugins.map((plugin) => plugin.id));
    const result = await importStudioPluginFolder();
    if (!result) {
      return;
    }

    setPlugins(result.plugins);
    setPluginsDirectory(result.pluginsDirectory);

    const addedPlugin = result.plugins.find((plugin) => !previousPluginIds.has(plugin.id));
    if (addedPlugin) {
      await handleLoadPlugin(addedPlugin);
    }
  }, [handleLoadPlugin, plugins]);

  const handleDeletePlugin = useCallback(async (plugin: StudioPluginSummary): Promise<void> => {
    if (!window.confirm(`Remove "${plugin.name}"?`)) {
      return;
    }

    playbackService.current.unloadPlugin(plugin.id);
    const result = await deleteStudioPlugin({ pluginPath: plugin.path });
    setPlugins(result.plugins);
    setPluginsDirectory(result.pluginsDirectory);
    setPluginStates((previous) => {
      const next = { ...previous };
      delete next[plugin.id];
      return next;
    });
  }, []);

  const handleRefreshPlugins = useCallback(async (): Promise<void> => {
    try {
      await refreshPlugins();
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, [refreshPlugins]);

  const handleRevealPluginsDirectory = useCallback(async (): Promise<void> => {
    try {
      await revealStudioPluginsDirectory();
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const handleRevealExternalSamplesDirectory = useCallback(async (): Promise<void> => {
    try {
      await revealExternalSamplesDirectory();
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
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
    return getPlaybackEvaluationSignature(livePlaybackFiles, sliderValuesById);
  }, [livePlaybackFiles, sliderValuesById]);

  useEffect(() => {
    if (playback.status !== 'playing') {
      setPlaybackHighlightRangesByPath({});
    }
  }, [playback.status]);

  useEffect(() => {
    if (!settings.liveReevaluate || playback.status !== 'playing') {
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
          clearPlaybackErrorsForFiles(livePlaybackFiles);
          setPlayingState(playback.mode ?? 'all', livePlaybackFiles);
          return;
        }
        recordPlaybackError(result.error, livePlaybackFiles);
        setPlayback({
          status: 'error',
          mode: playback.mode,
          activeFilePaths: livePlaybackFiles.map((file) => file.relativePath),
          updatedAt: new Date().toISOString(),
          error: result.error,
        });
      });
    }, 75);

    return () => window.clearTimeout(timeout);
  }, [
    clearPlaybackErrorsForFiles,
    livePlaybackFiles,
    livePlaybackSignature,
    playback.mode,
    playback.status,
    recordPlaybackError,
    setPlayingState,
    settings.liveReevaluate,
  ]);

  const handleSplit = useCallback(
    (direction: EditorSplitDirection): void => {
      const nextPanelId = `panel-${Date.now()}`;
      setEditorLayout((previous) => splitPanelLeaf(previous, activePanelId, direction, nextPanelId, activeFilePath));
      setActivePanelId(nextPanelId);
    },
    [activeFilePath, activePanelId],
  );

  const handleClosePanel = useCallback((): void => {
    if (panelCount <= 1) {
      return;
    }

    const panelToClose = findPanelLeaf(editorLayout, activePanelId);
    const panelFilePaths = panelToClose ? getPanelFilePaths(panelToClose) : [];
    const nextLayout = removePanelLeaf(editorLayout, activePanelId);
    if (nextLayout) {
      setEditorLayout(nextLayout);
      setActivePanelId(findFirstPanelLeaf(nextLayout).id);

      const remainingFilePaths = new Set(getLayoutFilePaths(nextLayout));
      setOpenFilesByPath((previous) => {
        let changed = false;
        const next = { ...previous };

        for (const relativePath of panelFilePaths) {
          if (remainingFilePaths.has(relativePath)) {
            continue;
          }

          const existing = next[relativePath];
          if (!existing) {
            continue;
          }

          changed = true;
          if (settings.keepPlayAllSelectionOnClose) {
            next[relativePath] = { ...existing, isOpen: false };
          } else {
            delete next[relativePath];
          }
        }

        return changed ? next : previous;
      });
    }
  }, [activePanelId, editorLayout, panelCount, settings.keepPlayAllSelectionOnClose]);

  const beginSidebarResize = useCallback(
    (side: 'left' | 'right', event: React.PointerEvent<HTMLDivElement>): void => {
      event.preventDefault();
      const startX = event.clientX;
      const startLeft = leftSidebarWidth;
      const startRight = rightSidebarWidth;

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        if (side === 'left') {
          setLeftSidebarWidth(clamp(startLeft + moveEvent.clientX - startX, leftSidebarMinWidth, sidebarMaxWidth));
          return;
        }

        setRightSidebarWidth(clamp(startRight - (moveEvent.clientX - startX), rightSidebarMinWidth, sidebarMaxWidth));
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
          onRemoveRecentProject={handleRemoveRecentProject}
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
        activeFileName={activeFile?.name ?? null}
        includedCount={includedFiles.length}
        dirtyCount={dirtyFiles.length}
        panelCount={panelCount}
        onPlayActive={handlePlayActive}
        onPlayAll={handlePlayAll}
        onStop={handleStop}
        onSaveActive={handleSaveActive}
        onSaveAll={handleSaveAll}
        onGoHome={handleGoHome}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onOpenOptions={() => setOptionsOpen(true)}
        onOpenExternalSamples={() => setExternalSamplesOpen(true)}
        onOpenPluginManager={handleOpenPluginManager}
        onOpenThemeSelector={() => setThemeSelectorOpen(true)}
        onSplitVertical={() => handleSplit('vertical')}
        onSplitHorizontal={() => handleSplit('horizontal')}
        onClosePanel={handleClosePanel}
        canPlayActive={Boolean(activeFile)}
        canPlayAll={includedFiles.length > 0}
        canSaveActive={Boolean(activeFile?.dirty)}
        canSaveAll={dirtyFiles.length > 0}
      />

      <div
        className="workspace-grid"
        style={{
          gridTemplateColumns: [
            `${leftSidebarCollapsed ? collapsedSidebarWidth : leftSidebarWidth}px`,
            `${leftSidebarCollapsed ? 0 : 6}px`,
            'minmax(0, 1fr)',
            `${rightSidebarCollapsed ? 0 : 6}px`,
            `${rightSidebarCollapsed ? collapsedSidebarWidth : rightSidebarWidth}px`,
          ].join(' '),
        }}
      >
        <FileExplorer
          projectName={project.name}
          projectRoot={project.rootPath}
          files={project.files}
          openFilesByPath={openFilesByPath}
          fileErrorsByPath={fileErrorsByPath}
          activeFilePath={activeFilePath}
          newFileName={newFileName}
          onNewFileNameChange={setNewFileName}
          onCreateFile={handleCreateFile}
          onOpenFile={handleOpenFile}
          onToggleIncluded={handleToggleIncluded}
          onPlaybackVolumeChange={handlePlaybackVolumeChange}
          onOpenProject={handleOpenProject}
          collapsed={leftSidebarCollapsed}
          onToggleCollapsed={() => setLeftSidebarCollapsed((previous) => !previous)}
        />
        <div
          className={`resize-handle resize-handle-left ${leftSidebarCollapsed ? 'is-hidden' : ''}`}
          role="separator"
          aria-label="Resize left sidebar"
          onPointerDown={(event) => beginSidebarResize('left', event)}
        />
        <EditorPane
          openFiles={openFiles}
          layout={editorLayout}
          activePanelId={activePanelId}
          onActivatePanel={setActivePanelId}
          onActivateFile={setPanelFile}
          onCloseFile={handleCloseFile}
          onChangeContent={handleChangeContent}
          playbackHighlightRangesByPath={playbackHighlightRangesByPath}
          fileErrorsByPath={fileErrorsByPath}
        />
        <div
          className={`resize-handle resize-handle-right ${rightSidebarCollapsed ? 'is-hidden' : ''}`}
          role="separator"
          aria-label="Resize right sidebar"
          onPointerDown={(event) => beginSidebarResize('right', event)}
        />
        <InspectorPanel
          sampleServer={project.sampleServer}
          playbackError={playback.error}
          activeFile={activeFile}
          sliderValues={sliderValuesById}
          externalSampleGroups={externalSampleGroups}
          onSliderArgumentChange={handleSliderArgumentChange}
          onPreviewSound={handlePreviewSound}
          collapsed={rightSidebarCollapsed}
          onToggleCollapsed={() => setRightSidebarCollapsed((previous) => !previous)}
        />
      </div>

      <OptionsModal
        open={optionsOpen}
        settings={settings}
        onChangeSettings={setSettings}
        onClose={() => setOptionsOpen(false)}
      />

      <ThemeSelectorModal
        open={themeSelectorOpen}
        activeTheme={activeTheme}
        onApplyTheme={setActiveTheme}
        onClose={() => setThemeSelectorOpen(false)}
      />

      <ExternalSamplesModal
        open={externalSamplesOpen}
        packs={availableExternalSamplePacks}
        packStates={externalSamplePackStates}
        onLoadPack={handleLoadExternalSamplePack}
        onAddPack={handleAddExternalSamplePack}
        onDeletePack={handleDeleteExternalSamplePack}
        onUnloadPack={handleUnloadExternalSamplePack}
        onCachePack={handleCacheExternalSamplePack}
        onRevealSamplesDirectory={handleRevealExternalSamplesDirectory}
        onClose={() => setExternalSamplesOpen(false)}
      />

      <PluginManagerModal
        open={pluginManagerOpen}
        plugins={plugins}
        pluginStates={pluginStates}
        pluginsDirectory={pluginsDirectory}
        onAddPlugin={handleAddPlugin}
        onImportPluginFolder={handleImportPluginFolder}
        onDeletePlugin={handleDeletePlugin}
        onLoadPlugin={handleLoadPlugin}
        onUnloadPlugin={handleUnloadPlugin}
        onRefreshPlugins={handleRefreshPlugins}
        onRevealPluginsDirectory={handleRevealPluginsDirectory}
        onClose={() => setPluginManagerOpen(false)}
      />

      {operationError ? <div className="toast-error">{operationError}</div> : null}
    </div>
  );
};
