export type ExternalSamplePack = {
  id: string;
  name: string;
  source: string;
  description: string;
  custom?: boolean;
};

export type ExternalSampleFile = {
  name: string;
  index: number;
  url: string;
};

export type ExternalSamplePackIndex = {
  names: string[];
  files: ExternalSampleFile[];
};

export type ExternalSampleGroup = {
  id: string;
  title: string;
  source: string;
  names: string[];
  files: ExternalSampleFile[];
};

export type ExternalSamplePackState = ExternalSampleGroup & {
  status: 'loading' | 'loaded' | 'error';
  error: string | null;
  cacheStatus: 'idle' | 'caching' | 'cached' | 'error';
  cachedFileCount: number;
  cacheError: string | null;
};

export const externalSamplePacks: ExternalSamplePack[] = [
  {
    id: 'dirt-samples',
    name: 'Dirt Samples',
    source: 'github:tidalcycles/dirt-samples/master',
    description: 'SuperDirt and TidalCycles sample set.',
  },
];

const githubSampleMapUrl = (source: string): string => {
  const path = source.replace(/^github:/, '').replace(/\/+$/, '');
  const [owner, repo = 'samples', branch = 'main', ...rest] = path.split('/');
  const basePath = rest.length > 0 ? `${rest.join('/')}/` : '';

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}strudel.json`;
};

const githubSampleMapFallbackUrl = (source: string): string => {
  const path = source.replace(/^github:/, '').replace(/\/+$/, '');
  const [owner, repo = 'samples', branch = 'main', ...rest] = path.split('/');
  const basePath = rest.length > 0 ? `${rest.join('/')}/` : '';

  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${basePath}strudel.json`;
};

const externalSampleSourceHash = (source: string): string => {
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
};

const getSourceLabel = (source: string): string => {
  const normalized = source.replace(/^github:/, '').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? source;
};

const stripStrudelMapFile = (segments: string[]): string[] => {
  return segments.at(-1)?.toLowerCase() === 'strudel.json' ? segments.slice(0, -1) : segments;
};

const toGithubSource = (owner: string, repo: string, branch: string, segments: string[]): string => {
  return `github:${[owner, repo, branch, ...stripStrudelMapFile(segments)].filter(Boolean).join('/')}`;
};

const normalizeGitHubUrlSource = (source: string): string | null => {
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
      return toGithubSource(owner, repo, branch, rest);
    }

    return toGithubSource(owner, repo, 'main', []);
  }

  if (url.hostname === 'raw.githubusercontent.com') {
    const [owner, repo, branch, ...rest] = segments;
    if (!owner || !repo || !branch) {
      return null;
    }

    return toGithubSource(owner, repo, branch, rest);
  }

  return null;
};

export const normalizeExternalSampleSource = (source: string): string => {
  const trimmed = source.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  return normalizeGitHubUrlSource(trimmed) ?? trimmed;
};

export const createCustomExternalSamplePack = (source: string, name: string): ExternalSamplePack => {
  const normalizedSource = normalizeExternalSampleSource(source);
  return {
    id: `custom-${externalSampleSourceHash(normalizedSource)}`,
    name: name.trim() || getSourceLabel(normalizedSource) || 'External Samples',
    source: normalizedSource,
    description: 'Custom external sample source.',
    custom: true,
  };
};

const externalSampleMapUrls = (source: string): string[] => {
  if (source.startsWith('github:')) {
    return [githubSampleMapUrl(source), githubSampleMapFallbackUrl(source)];
  }

  if (/^https?:\/\//i.test(source)) {
    return [source.toLowerCase().endsWith('.json') ? source : `${source.replace(/\/+$/, '')}/strudel.json`];
  }

  throw new Error('External sources need to be a github: source or an http(s) URL to a strudel.json map.');
};

export const getExternalSampleLoadSources = (source: string): string[] => {
  if (source.startsWith('github:')) {
    return [source, githubSampleMapFallbackUrl(source)];
  }

  return [source];
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toSamplePathList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return typeof value === 'string' ? [value] : [];
};

const getSampleIndex = (sampleMap: unknown, mapUrl: string): ExternalSamplePackIndex => {
  if (!isObject(sampleMap)) {
    throw new Error('External sample index is not a valid sample map.');
  }

  const baseUrl = typeof sampleMap._base === 'string'
    ? sampleMap._base
    : mapUrl.split('/').slice(0, -1).join('/');
  const names = Object.keys(sampleMap)
    .filter((name) => name !== '_base')
    .sort((left, right) => left.localeCompare(right));
  const files = names.flatMap((name) =>
    toSamplePathList(sampleMap[name]).map((path, index) => ({
      name,
      index,
      url: /^https?:\/\//i.test(path) ? path : `${baseUrl}${path}`,
    })),
  );

  return { names, files };
};

export const fetchExternalSamplePackIndex = async (pack: ExternalSamplePack): Promise<ExternalSamplePackIndex> => {
  let lastError: Error | null = null;

  for (const url of externalSampleMapUrls(pack.source)) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`Could not load ${pack.name} index (${response.status}).`);
      }

      const text = await response.text();
      try {
        return getSampleIndex(JSON.parse(text), url);
      } catch (parseError) {
        if (text.trimStart().startsWith('<')) {
          throw new Error(
            `Could not load ${pack.name} index because the source returned HTML instead of strudel.json.`,
          );
        }

        throw parseError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Could not load ${pack.name} index.`);
};

export const prefetchExternalSampleFiles = async (
  files: ExternalSampleFile[],
  onProgress: (cachedFileCount: number) => void,
): Promise<void> => {
  const workerCount = Math.min(4, files.length);
  let cachedFileCount = 0;
  let nextFileIndex = 0;

  const cacheNextFile = async (): Promise<void> => {
    while (nextFileIndex < files.length) {
      const file = files[nextFileIndex];
      nextFileIndex += 1;
      if (!file) {
        return;
      }

      const response = await fetch(file.url, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`Could not cache ${file.name}:${file.index} (${response.status}).`);
      }

      await response.arrayBuffer();
      cachedFileCount += 1;
      onProgress(cachedFileCount);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => cacheNextFile()));
};
