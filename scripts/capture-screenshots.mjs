import { app, BrowserWindow } from 'electron';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, 'docs', 'screenshots');
const rendererEntry = join(root, 'out', 'renderer', 'index.html');

const projectRoot = 'C:\\Music\\Strudel Studio Demo';

const files = {
  'drums.strudel': `stack(
  s("bd*4, [~ sd]*2, hh*8")
    .gain(slider(0.85, 0, 1.4, 0.01))
    .room(0.18),
  s("cp*2").delay(0.08)
)`,
  'bass.strudel': `note("c2 eb2 g2 bb1")
  .s("sawtooth")
  .lpf(slider(650, 100, 2400, 10))
  .legato(0.9)`,
  'pads.strudel': `note("<c4 eb4 g4 bb4>")
  .s("swpad")
  .slow(2)
  .gain(0.45)`,
};

const project = {
  rootPath: projectRoot,
  name: 'Strudel Studio Demo',
  sampleServer: {
    baseUrl: 'http://127.0.0.1:41000/',
    manifestUrl: 'http://127.0.0.1:41000/strudel.json',
    samplesRoot: `${projectRoot}\\samples`,
    sampleCount: 24,
  },
  files: Object.entries(files).map(([relativePath, content]) => ({
    id: relativePath,
    absolutePath: `${projectRoot}\\${relativePath}`,
    relativePath,
    name: relativePath,
    extension: '.strudel',
    size: content.length,
    modifiedAt: '2026-06-18T12:00:00.000Z',
  })),
};

const recentProjects = [
  {
    rootPath: project.rootPath,
    name: project.name,
    workspacePath: `${projectRoot}\\.strudel-studio\\workspace.json`,
    lastOpenedAt: '2026-06-18T12:00:00.000Z',
  },
  {
    rootPath: 'C:\\Music\\Midnight Breaks',
    name: 'Midnight Breaks',
    workspacePath: 'C:\\Music\\Midnight Breaks\\.strudel-studio\\workspace.json',
    lastOpenedAt: '2026-06-17T21:30:00.000Z',
  },
  {
    rootPath: 'C:\\Music\\Ambient Sketchbook',
    name: 'Ambient Sketchbook',
    workspacePath: 'C:\\Music\\Ambient Sketchbook\\.strudel-studio\\workspace.json',
    lastOpenedAt: '2026-06-16T18:15:00.000Z',
  },
];

const screenshotThemeFonts = {
  interface: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  editor: '"Cascadia Code", "Fira Code", Consolas, monospace',
};

const screenshotThemeFontSizes = {
  interface: 16,
  editor: 15,
};

const createScreenshotTheme = (name, colors) => ({
  version: 1,
  name,
  author: 'Strudel Studio',
  themeVersion: '1.0.0',
  colors: {
    recentPanel: colors.panel,
    playbackHighlight: colors.primary,
    ...colors,
  },
  fonts: screenshotThemeFonts,
  fontSizes: screenshotThemeFontSizes,
});

const screenshotThemes = [
  [
    createScreenshotTheme('Strudel Studio Light', {
      background: '#f6f8f3',
      surface: '#ffffff',
      panel: '#eef3ec',
      border: '#cad4c6',
      primary: '#2f7d55',
      primaryText: '#f7fff8',
      text: '#17211a',
      mutedText: '#68766c',
      warning: '#b46a18',
      danger: '#c93c3c',
      editorBackground: '#ffffff',
      editorText: '#17211a',
    }),
    'theme-light-main',
  ],
  [
    createScreenshotTheme('Strudel Studio Blue', {
      background: '#07111f',
      surface: '#0d1d31',
      panel: '#0a1829',
      border: '#1d3b5d',
      primary: '#6bb8ff',
      primaryText: '#031222',
      text: '#eef7ff',
      mutedText: '#87a4bd',
      warning: '#f2bd68',
      danger: '#ff7070',
      editorBackground: '#06101c',
      editorText: '#eef7ff',
    }),
    'theme-blue-main',
  ],
  [
    createScreenshotTheme('Strudel Studio Purple', {
      background: '#100b1d',
      surface: '#1b1230',
      panel: '#170f29',
      border: '#352458',
      primary: '#c59cff',
      primaryText: '#1a0736',
      text: '#f6f0ff',
      mutedText: '#a99abd',
      warning: '#e9b563',
      danger: '#f36f86',
      editorBackground: '#0d0918',
      editorText: '#f6f0ff',
    }),
    'theme-purple-main',
  ],
];

const session = {
  project,
  openFiles: [
    {
      absolutePath: `${projectRoot}\\drums.strudel`,
      relativePath: 'drums.strudel',
      content: files['drums.strudel'],
      includedInPlayAll: true,
      playbackVolume: 0.95,
      isOpen: true,
    },
    {
      absolutePath: `${projectRoot}\\bass.strudel`,
      relativePath: 'bass.strudel',
      content: files['bass.strudel'],
      includedInPlayAll: true,
      playbackVolume: 0.82,
      isOpen: true,
    },
    {
      absolutePath: `${projectRoot}\\pads.strudel`,
      relativePath: 'pads.strudel',
      content: files['pads.strudel'],
      includedInPlayAll: true,
      playbackVolume: 0.6,
      isOpen: true,
    },
  ],
  activeFilePath: 'drums.strudel',
  activePanelId: 'panel-left',
  editorLayout: {
    type: 'split',
    id: 'split-demo',
    direction: 'vertical',
    children: [
      {
        type: 'leaf',
        id: 'panel-left',
        filePath: 'drums.strudel',
        filePaths: ['drums.strudel'],
      },
      {
        type: 'split',
        id: 'split-right',
        direction: 'horizontal',
        children: [
          {
            type: 'leaf',
            id: 'panel-right-top',
            filePath: 'bass.strudel',
            filePaths: ['bass.strudel'],
          },
          {
            type: 'leaf',
            id: 'panel-right-bottom',
            filePath: 'pads.strudel',
            filePaths: ['pads.strudel'],
          },
        ],
      },
    ],
  },
  savedAt: '2026-06-18T12:00:00.000Z',
  workspacePath: `${projectRoot}\\.strudel-studio\\workspace.json`,
};

const preloadSource = `
const { contextBridge } = require('electron');
const session = ${JSON.stringify(session)};
const recentProjects = ${JSON.stringify(recentProjects)};
const files = ${JSON.stringify(files)};

contextBridge.exposeInMainWorld('studio', {
  onCloseRequested: () => () => {},
  confirmClose: async () => {},
  newProjectFolder: async () => session,
  openProjectFolder: async () => session,
  openRecentProject: async () => session,
  listRecentProjects: async () => recentProjects,
  removeRecentProject: async () => [],
  createStrudelFile: async () => session.project,
  readFile: async ({ relativePath }) => files[relativePath] || '',
  saveFile: async () => {},
  saveWorkspace: async () => session.workspacePath,
  loadWorkspace: async () => session,
  listThemes: async () => ({ themes: [], themesDirectory: 'C:\\\\Users\\\\Demo\\\\AppData\\\\Roaming\\\\Strudel Studio\\\\themes' }),
  importThemeFile: async () => null,
  saveTheme: async ({ theme }) => ({ theme: { id: 'mock', name: theme.name, path: null, theme }, themesDirectory: '' }),
  deleteTheme: async () => ({ themes: [], themesDirectory: '' }),
  revealThemesDirectory: async () => {},
  listSystemFonts: async () => ['Inter', 'Cascadia Code', 'Fira Code', 'Consolas', 'Arial'],
  listPlugins: async () => ({ plugins: [], pluginsDirectory: 'C:\\\\Users\\\\Demo\\\\AppData\\\\Roaming\\\\Strudel Studio\\\\plugins' }),
  addPluginSource: async () => ({ plugins: [], pluginsDirectory: '' }),
  importPluginFolder: async () => null,
  deletePlugin: async () => ({ plugins: [], pluginsDirectory: '' }),
  readPluginScriptBundle: async () => ({ pluginId: 'mock', scriptNames: [], code: '' }),
  revealPluginsDirectory: async () => {},
  revealExternalSamplesDirectory: async () => {},
});
`;

const waitForSelector = async (window, selector) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = await window.webContents.executeJavaScript(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    );
    if (found) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${selector}`);
};

const waitForExpression = async (window, expression, description) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = await window.webContents.executeJavaScript(`Boolean(${expression})`);
    if (found) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
};

const clickTextButton = async (window, text) => {
  await window.webContents.executeJavaScript(`
    (() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.textContent && candidate.textContent.includes(${JSON.stringify(text)}));
      if (!button) {
        throw new Error('Button not found: ${text}');
      }
      button.click();
    })();
  `);
};

const clickAriaButton = async (window, label) => {
  await window.webContents.executeJavaScript(`
    (() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)});
      if (!button) {
        throw new Error('Button not found: ${label}');
      }
      button.click();
    })();
  `);
};

const closeModal = async (window, selector) => {
  await window.webContents.executeJavaScript(`
    (() => {
      const modal = document.querySelector(${JSON.stringify(selector)});
      const closeButton = [...(modal?.querySelectorAll('button') ?? [])]
        .find((button) => button.title === 'Close' || button.getAttribute('aria-label') === 'Close');
      if (!closeButton) {
        throw new Error('Close button not found for ${selector}');
      }
      closeButton.click();
    })();
  `);
  await waitForExpression(
    window,
    `!document.querySelector(${JSON.stringify(selector)}) && !document.querySelector('.modal-backdrop')`,
    `${selector} closed`,
  );
};

const openFileMenu = async (window) => {
  await window.webContents.executeJavaScript(`
    document.querySelector('.menu-dropdown > summary')?.click();
  `);
  await waitForSelector(window, '.menu-panel');
};

const applyScreenshotTheme = async (window, theme) => {
  await window.webContents.executeJavaScript(`
    (() => {
      const theme = ${JSON.stringify(theme)};
      const cssVariableByColor = {
        background: '--studio-background',
        surface: '--studio-surface',
        panel: '--studio-panel',
        recentPanel: '--studio-recent-panel',
        border: '--studio-border',
        primary: '--studio-primary',
        primaryText: '--studio-primary-text',
        text: '--studio-text',
        mutedText: '--studio-muted-text',
        warning: '--studio-warning',
        danger: '--studio-danger',
        editorBackground: '--studio-editor-background',
        editorText: '--studio-editor-text',
        playbackHighlight: '--studio-playback-highlight',
      };
      const root = document.documentElement;
      for (const [key, variableName] of Object.entries(cssVariableByColor)) {
        root.style.setProperty(variableName, theme.colors[key]);
      }
      root.style.setProperty('--studio-interface-font', theme.fonts.interface);
      root.style.setProperty('--studio-editor-font', theme.fonts.editor);
      root.style.setProperty('--studio-interface-font-size', theme.fontSizes.interface + 'px');
      root.style.setProperty('--studio-editor-font-size', theme.fontSizes.editor + 'px');
      window.localStorage.setItem('strudel-studio:active-theme', JSON.stringify(theme));
    })();
  `);
};

const capture = async (window, name) => {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  const image = await window.webContents.capturePage();
  await writeFile(join(outputDirectory, `${name}.png`), image.toPNG());
};

const removeTemporaryDirectory = async (temporaryDirectory) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(temporaryDirectory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 7) {
        throw error;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
  }
};

const main = async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'strudel-studio-screenshots-'));
  const preloadPath = join(temporaryDirectory, 'preload.cjs');
  const userDataDirectory = join(temporaryDirectory, 'user-data');
  await writeFile(preloadPath, preloadSource, 'utf8');
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  try {
    app.setPath('userData', userDataDirectory);
    await app.whenReady();
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      backgroundColor: '#111517',
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    window.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
      console.error(`[load failed] ${errorCode} ${errorDescription}: ${validatedUrl}`);
    });
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer gone] ${details.reason}`);
    });

    await window.loadFile(rendererEntry);
    await waitForSelector(window, '.welcome-screen');
    await waitForExpression(
      window,
      "document.querySelectorAll('.recent-project-row').length === 3",
      'three recent projects',
    );
    await capture(window, 'main-menu');

    await clickTextButton(window, 'Strudel Studio Demo');
    await waitForSelector(window, '.workspace-grid');
    await clickAriaButton(window, 'Sliders');
    await waitForSelector(window, '.sidebar-tab-panel[data-tab-id="sliders"]');
    await capture(window, 'app-overview');

    await clickAriaButton(window, 'Docs');
    await waitForSelector(window, '.sidebar-tab-panel[data-tab-id="instructions"]');
    await openFileMenu(window);
    await clickTextButton(window, 'Theme Selector');
    await waitForSelector(window, '.theme-modal');
    await capture(window, 'theme-selector-docs');

    await window.webContents.executeJavaScript(`
      document.querySelector('.theme-modal .icon-button')?.click();
    `);
    await clickAriaButton(window, 'Sounds');
    await waitForSelector(window, '.sidebar-tab-panel[data-tab-id="sounds"]');
    await openFileMenu(window);
    await clickTextButton(window, 'External Samples');
    await waitForSelector(window, '.external-samples-modal');
    await capture(window, 'external-samples-sounds');

    await closeModal(window, '.external-samples-modal');
    for (const [theme, screenshotName] of screenshotThemes) {
      await applyScreenshotTheme(window, theme);
      await clickAriaButton(window, 'Sliders');
      await waitForSelector(window, '.sidebar-tab-panel[data-tab-id="sliders"]');
      await capture(window, screenshotName);
    }
  } finally {
    app.quit();
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    await removeTemporaryDirectory(temporaryDirectory);
  }
};

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
