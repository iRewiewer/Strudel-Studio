import { app } from 'electron';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, parse, resolve, sep } from 'node:path';
import type {
  AddPluginSourceRequest,
  PluginScriptBundle,
  StudioPluginSummary,
} from '../../shared/types';

type PluginManifest = {
  version: 1;
  name: string;
  author: string;
  pluginVersion: string;
  description: string;
  source: string | null;
  scripts: string[];
};

type GitHubSource = {
  owner: string;
  repo: string;
  branch: string;
  segments: string[];
  pointsToFile: boolean;
};

type RemotePluginPackage = {
  name: string;
  author: string;
  pluginVersion: string;
  description: string;
  source: string;
  scripts: string[];
  files: Array<{
    relativePath: string;
    content: string;
  }>;
};

const pluginManifestFileName = 'plugin.json';
const scriptExtensions = new Set(['.strudel', '.js', '.mjs']);
const remoteManifestCandidates = ['strudel-studio-plugin.json', 'plugin.json'];
const remoteScriptCandidates = ['prebake.strudel', 'index.strudel', 'index.js', 'main.js', 'allscripts(deprecated).js'];

const getPluginsDirectory = (): string => {
  return join(app.getPath('userData'), 'plugins');
};

export const externalSamplesDirectoryPath = (): string => {
  return join(app.getPath('userData'), 'external-samples');
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toSlug = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'plugin';
};

const normalizeText = (value: unknown, fallback: string): string => {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const normalizeVersion = (value: unknown): string => {
  const version = normalizeText(value, '1.0.0').replace(/^v\s*/i, '');
  return version || '1.0.0';
};

const normalizeScriptPath = (scriptPath: string): string | null => {
  const normalized = scriptPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').includes('..')) {
    return null;
  }

  return scriptExtensions.has(extname(normalized).toLowerCase()) ? normalized : null;
};

const normalizeScriptList = (value: unknown, fallbackScripts: string[]): string[] => {
  const rawScripts = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : fallbackScripts;

  return [
    ...new Set(
      rawScripts
        .filter((script): script is string => typeof script === 'string')
        .map((script) => normalizeScriptPath(script))
        .filter((script): script is string => Boolean(script)),
    ),
  ];
};

const collectRootScripts = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && scriptExtensions.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const readPluginManifest = async (pluginDirectory: string): Promise<PluginManifest> => {
  const fallbackScripts = await collectRootScripts(pluginDirectory);
  const manifestPath = join(pluginDirectory, pluginManifestFileName);
  const rawManifest = await readFile(manifestPath, 'utf8')
    .then((raw) => JSON.parse(raw) as unknown)
    .catch(() => ({}));
  const manifest = isObject(rawManifest) ? rawManifest : {};
  const folderName = basename(pluginDirectory);
  const name = normalizeText(manifest.name, folderName.replace(/[-_]+/g, ' '));

  return {
    version: 1,
    name,
    author: normalizeText(manifest.author, 'Unknown'),
    pluginVersion: normalizeVersion(manifest.pluginVersion ?? manifest.version),
    description: normalizeText(manifest.description, 'Strudel runtime plugin.'),
    source: typeof manifest.source === 'string' && manifest.source.trim() ? manifest.source.trim() : null,
    scripts: normalizeScriptList(manifest.scripts ?? manifest.main, fallbackScripts),
  };
};

const ensurePluginManifest = async (
  pluginDirectory: string,
  overrides: Partial<PluginManifest> = {},
): Promise<PluginManifest> => {
  const current = await readPluginManifest(pluginDirectory);
  const manifest: PluginManifest = {
    ...current,
    ...overrides,
    version: 1,
    scripts: overrides.scripts ?? current.scripts,
  };

  await writeFile(join(pluginDirectory, pluginManifestFileName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
};

const toPluginSummary = (pluginDirectory: string, manifest: PluginManifest): StudioPluginSummary => ({
  id: pluginDirectory,
  name: manifest.name,
  path: pluginDirectory,
  source: manifest.source,
  description: manifest.description,
  author: manifest.author,
  pluginVersion: manifest.pluginVersion,
  scripts: manifest.scripts,
});

const getUniquePluginDirectory = async (name: string): Promise<string> => {
  const pluginsDirectory = getPluginsDirectory();
  const slug = toSlug(name);

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const candidate = join(pluginsDirectory, `${slug}${suffix}`);
    const exists = await stat(candidate).then(() => true).catch(() => false);
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Could not find a free plugin folder name.');
};

const assertInsidePluginsDirectory = (pluginPath: string): string => {
  const pluginsDirectory = resolve(getPluginsDirectory());
  const target = resolve(pluginPath);
  if (target !== pluginsDirectory && !target.startsWith(pluginsDirectory + sep)) {
    throw new Error('Plugin folders must stay inside the Strudel Studio plugins directory.');
  }

  return target;
};

const assertPluginScriptPath = (pluginDirectory: string, scriptPath: string): string => {
  const normalized = normalizeScriptPath(scriptPath);
  if (!normalized) {
    throw new Error(`Invalid plugin script path: ${scriptPath}`);
  }

  const target = resolve(pluginDirectory, normalized);
  const root = resolve(pluginDirectory);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Plugin script must stay inside its plugin folder: ${scriptPath}`);
  }

  return target;
};

export const listPluginFolders = async (): Promise<{ plugins: StudioPluginSummary[]; pluginsDirectory: string }> => {
  const pluginsDirectory = getPluginsDirectory();
  await mkdir(pluginsDirectory, { recursive: true });
  const entries = await readdir(pluginsDirectory, { withFileTypes: true });
  const plugins: StudioPluginSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const pluginDirectory = join(pluginsDirectory, entry.name);
    const manifest = await readPluginManifest(pluginDirectory).catch(() => null);
    if (manifest) {
      plugins.push(toPluginSummary(pluginDirectory, manifest));
    }
  }

  return {
    plugins: plugins.sort((left, right) => left.name.localeCompare(right.name)),
    pluginsDirectory,
  };
};

export const importPluginFolder = async (
  sourceDirectory: string,
): Promise<{ plugins: StudioPluginSummary[]; pluginsDirectory: string }> => {
  const sourceStats = await stat(sourceDirectory).catch(() => null);
  if (!sourceStats?.isDirectory()) {
    throw new Error('Select a plugin folder.');
  }

  const sourceManifest = await readPluginManifest(sourceDirectory);
  if (sourceManifest.scripts.length === 0) {
    throw new Error('Plugin folders need at least one .strudel, .js, or .mjs script.');
  }

  const targetDirectory = await getUniquePluginDirectory(sourceManifest.name || basename(sourceDirectory));
  await mkdir(dirname(targetDirectory), { recursive: true });
  await cp(sourceDirectory, targetDirectory, { recursive: true, force: false, errorOnExist: true });
  await ensurePluginManifest(targetDirectory, sourceManifest);

  return listPluginFolders();
};

const parseGitHubSource = (source: string): GitHubSource | null => {
  if (source.startsWith('github:')) {
    const parts = source.replace(/^github:/, '').replace(/\/+$/, '').split('/').filter(Boolean);
    const [owner, repo, branch = 'main', ...segments] = parts;
    if (!owner || !repo) {
      return null;
    }

    return {
      owner,
      repo,
      branch,
      segments,
      pointsToFile: scriptExtensions.has(extname(segments.at(-1) ?? '').toLowerCase()),
    };
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'github.com') {
    const [owner, repo, mode, branch, ...rest] = segments;
    if (!owner || !repo) {
      return null;
    }

    if ((mode === 'blob' || mode === 'tree') && branch) {
      return {
        owner,
        repo,
        branch,
        segments: rest,
        pointsToFile: mode === 'blob',
      };
    }

    return {
      owner,
      repo,
      branch: 'main',
      segments: [],
      pointsToFile: false,
    };
  }

  if (url.hostname === 'raw.githubusercontent.com') {
    const [owner, repo, branch, ...rest] = segments;
    if (!owner || !repo || !branch) {
      return null;
    }

    return {
      owner,
      repo,
      branch,
      segments: rest,
      pointsToFile: scriptExtensions.has(extname(rest.at(-1) ?? '').toLowerCase()),
    };
  }

  return null;
};

const githubUrls = (source: GitHubSource, relativePath = ''): string[] => {
  const segments = [...source.segments, ...relativePath.split('/').filter(Boolean)];
  const rawPath = segments.map((segment) => encodeURIComponent(segment)).join('/');
  const cdnPath = segments.map((segment) => encodeURIComponent(segment)).join('/');

  return [
    `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch}/${rawPath}`,
    `https://cdn.jsdelivr.net/gh/${source.owner}/${source.repo}@${source.branch}/${cdnPath}`,
  ];
};

const fetchText = async (urls: string[]): Promise<string> => {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { Accept: 'text/plain, application/json' } });
      if (!response.ok) {
        throw new Error(`Could not load ${url} (${response.status}).`);
      }

      const text = await response.text();
      if (text.trimStart().startsWith('<')) {
        throw new Error(`Could not load ${url} because it returned HTML.`);
      }

      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Could not load plugin source.');
};

const readRemoteManifest = async (
  source: GitHubSource,
): Promise<{ manifest: Record<string, unknown>; manifestPath: string } | null> => {
  if (source.pointsToFile) {
    return null;
  }

  for (const manifestPath of remoteManifestCandidates) {
    try {
      const text = await fetchText(githubUrls(source, manifestPath));
      return {
        manifest: JSON.parse(text) as Record<string, unknown>,
        manifestPath,
      };
    } catch {
      continue;
    }
  }

  return null;
};

const createRemotePluginPackage = async (
  request: AddPluginSourceRequest,
): Promise<RemotePluginPackage> => {
  const source = request.source.trim();
  const githubSource = parseGitHubSource(source);
  if (!githubSource) {
    throw new Error('Plugin sources need to be a GitHub repo, GitHub file URL, raw file URL, or github: source.');
  }

  const manifestResult = await readRemoteManifest(githubSource);
  if (manifestResult) {
    const manifest = isObject(manifestResult.manifest) ? manifestResult.manifest : {};
    const scripts = normalizeScriptList(manifest.scripts ?? manifest.main, []);
    if (scripts.length === 0) {
      throw new Error('Plugin manifest does not list any .strudel, .js, or .mjs scripts.');
    }

    const files = await Promise.all(
      scripts.map(async (script) => ({
        relativePath: script,
        content: await fetchText(githubUrls(githubSource, script)),
      })),
    );

    return {
      name: normalizeText(request.name, normalizeText(manifest.name, githubSource.repo)),
      author: normalizeText(manifest.author, 'Unknown'),
      pluginVersion: normalizeVersion(manifest.pluginVersion ?? manifest.version),
      description: normalizeText(manifest.description, 'Strudel runtime plugin.'),
      source,
      scripts,
      files,
    };
  }

  if (githubSource.pointsToFile) {
    const scriptName = githubSource.segments.at(-1);
    if (!scriptName) {
      throw new Error('GitHub plugin file path is missing a script name.');
    }

    return {
      name: normalizeText(request.name, parse(scriptName).name.replace(/[-_]+/g, ' ')),
      author: 'Unknown',
      pluginVersion: '1.0.0',
      description: 'Strudel runtime plugin.',
      source,
      scripts: [scriptName],
      files: [{ relativePath: scriptName, content: await fetchText(githubUrls(githubSource)) }],
    };
  }

  for (const script of remoteScriptCandidates) {
    try {
      const content = await fetchText(githubUrls(githubSource, script));
      return {
        name: normalizeText(request.name, githubSource.repo.replace(/[-_]+/g, ' ')),
        author: githubSource.owner,
        pluginVersion: '1.0.0',
        description: 'Strudel runtime plugin.',
        source,
        scripts: [script],
        files: [{ relativePath: script, content }],
      };
    } catch {
      continue;
    }
  }

  throw new Error('Could not find a plugin manifest or known Strudel script in that source.');
};

export const addPluginFromSource = async (
  request: AddPluginSourceRequest,
): Promise<{ plugins: StudioPluginSummary[]; pluginsDirectory: string }> => {
  const remotePlugin = await createRemotePluginPackage(request);
  const targetDirectory = await getUniquePluginDirectory(remotePlugin.name);
  await mkdir(targetDirectory, { recursive: true });

  for (const file of remotePlugin.files) {
    const target = assertPluginScriptPath(targetDirectory, file.relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }

  await ensurePluginManifest(targetDirectory, {
    name: remotePlugin.name,
    author: remotePlugin.author,
    pluginVersion: remotePlugin.pluginVersion,
    description: remotePlugin.description,
    source: remotePlugin.source,
    scripts: remotePlugin.scripts,
  });

  return listPluginFolders();
};

export const deletePluginFolder = async (
  pluginPath: string,
): Promise<{ plugins: StudioPluginSummary[]; pluginsDirectory: string }> => {
  const target = assertInsidePluginsDirectory(pluginPath);
  const stats = await stat(target).catch(() => null);
  if (!stats?.isDirectory()) {
    throw new Error('Only plugin folders can be deleted.');
  }

  await rm(target, { recursive: true, force: false });
  return listPluginFolders();
};

export const readPluginScriptBundle = async (pluginPath: string): Promise<PluginScriptBundle> => {
  const pluginDirectory = assertInsidePluginsDirectory(pluginPath);
  const manifest = await readPluginManifest(pluginDirectory);
  if (manifest.scripts.length === 0) {
    throw new Error('Plugin does not contain any runnable scripts.');
  }

  const scripts = await Promise.all(
    manifest.scripts.map(async (scriptName) => ({
      scriptName,
      code: await readFile(assertPluginScriptPath(pluginDirectory, scriptName), 'utf8'),
    })),
  );

  return {
    pluginId: pluginDirectory,
    scriptNames: scripts.map((script) => script.scriptName),
    code: scripts
      .map((script) => `\n/* Strudel Studio plugin: ${script.scriptName} */\n${script.code}`)
      .join('\n'),
  };
};

export const pluginsDirectoryPath = getPluginsDirectory;
