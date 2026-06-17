import { app } from 'electron';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, join, parse, resolve, sep } from 'node:path';
import type { SaveThemeRequest, SaveThemeResult, StudioTheme, StudioThemeSummary, ThemeColorKey, ThemeFontKey } from '../../shared/types';
import { defaultStudioTheme, themeColorKeys, themeFontKeys } from '../../shared/theme';

const fontExtensions = new Set(['.otf', '.ttc', '.ttf', '.woff', '.woff2']);

const getThemesDirectory = (): string => {
  return join(app.getPath('userData'), 'themes');
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

  return slug || 'theme';
};

const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((character) => `${character}${character}`)
      .join('')}`.toLowerCase();
  }

  return fallback;
};

const normalizeTheme = (raw: unknown, fallbackName: string): StudioTheme => {
  const source = isObject(raw) ? raw : {};
  const sourceColors = isObject(source.colors) ? source.colors : {};
  const sourceFonts = isObject(source.fonts) ? source.fonts : {};
  const colors = themeColorKeys.reduce<Record<ThemeColorKey, string>>((accumulator, key) => {
    accumulator[key] = normalizeHexColor(sourceColors[key], defaultStudioTheme.colors[key]);
    return accumulator;
  }, {} as Record<ThemeColorKey, string>);
  const fonts = themeFontKeys.reduce<Record<ThemeFontKey, string>>((accumulator, key) => {
    const value = sourceFonts[key];
    accumulator[key] = typeof value === 'string' && value.trim()
      ? value.trim()
      : defaultStudioTheme.fonts[key];
    return accumulator;
  }, {} as Record<ThemeFontKey, string>);

  return {
    version: 1,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallbackName,
    colors,
    fonts,
  };
};

const getUniqueThemePath = async (themeName: string): Promise<string> => {
  const directory = getThemesDirectory();
  const slug = toSlug(themeName);

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const candidate = join(directory, `${slug}${suffix}.json`);
    const exists = await stat(candidate).then(() => true).catch(() => false);
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Could not find a free theme file name.');
};

const assertInsideThemesDirectory = (themePath: string): string => {
  const directory = resolve(getThemesDirectory());
  const target = resolve(themePath);
  if (target !== directory && !target.startsWith(directory + sep)) {
    throw new Error('Theme files must stay inside the Strudel Studio themes directory.');
  }
  return target;
};

const readThemeFile = async (themePath: string): Promise<StudioTheme> => {
  const raw = await readFile(themePath, 'utf8');
  return normalizeTheme(JSON.parse(raw), parse(themePath).name);
};

const toThemeSummary = (themePath: string, theme: StudioTheme): StudioThemeSummary => ({
  id: themePath,
  name: theme.name,
  path: themePath,
  theme,
});

export const listThemeFiles = async (): Promise<{ themes: StudioThemeSummary[]; themesDirectory: string }> => {
  const themesDirectory = getThemesDirectory();
  await mkdir(themesDirectory, { recursive: true });
  const entries = await readdir(themesDirectory, { withFileTypes: true });
  const themes: StudioThemeSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.json') {
      continue;
    }

    const themePath = join(themesDirectory, entry.name);
    const theme = await readThemeFile(themePath).catch(() => null);
    if (theme) {
      themes.push(toThemeSummary(themePath, theme));
    }
  }

  return {
    themes: themes.sort((left, right) => left.name.localeCompare(right.name)),
    themesDirectory,
  };
};

export const saveThemeFile = async (request: SaveThemeRequest): Promise<SaveThemeResult> => {
  const themesDirectory = getThemesDirectory();
  await mkdir(themesDirectory, { recursive: true });

  const theme = normalizeTheme(request.theme, request.theme.name || defaultStudioTheme.name);
  const themePath = request.saveAsNew || !request.targetPath
    ? await getUniqueThemePath(theme.name)
    : assertInsideThemesDirectory(request.targetPath);

  await writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, 'utf8');

  return {
    theme: toThemeSummary(themePath, theme),
    themesDirectory,
  };
};

export const importThemeFile = async (sourcePath: string): Promise<SaveThemeResult> => {
  const sourceTheme = await readThemeFile(sourcePath);
  return saveThemeFile({ theme: sourceTheme, saveAsNew: true });
};

const prettyFontName = (fileName: string): string => {
  return basename(fileName, extname(fileName))
    .replace(/[-_]+/g, ' ')
    .replace(/\b(regular|bold|italic|light|medium|semibold|black|thin|condensed|oblique)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const collectFontNames = async (directory: string, names: Set<string>): Promise<void> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFontNames(entryPath, names);
      continue;
    }

    if (!entry.isFile() || !fontExtensions.has(extname(entry.name).toLowerCase())) {
      continue;
    }

    const name = prettyFontName(entry.name);
    if (name) {
      names.add(name);
    }
  }
};

export const listSystemFontNames = async (): Promise<string[]> => {
  const names = new Set<string>([
    'Inter',
    'Arial',
    'Helvetica',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Cascadia Code',
    'Fira Code',
    'Menlo',
    'Monaco',
    'Consolas',
  ]);

  const home = homedir();
  const directories = process.platform === 'win32'
    ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'Fonts'), join(home, 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts')]
    : process.platform === 'darwin'
      ? ['/System/Library/Fonts', '/Library/Fonts', join(home, 'Library', 'Fonts')]
      : ['/usr/share/fonts', '/usr/local/share/fonts', join(home, '.fonts'), join(home, '.local', 'share', 'fonts')];

  for (const directory of directories) {
    await collectFontNames(directory, names);
  }

  return [...names].sort((left, right) => left.localeCompare(right));
};

export const themesDirectoryPath = getThemesDirectory;
