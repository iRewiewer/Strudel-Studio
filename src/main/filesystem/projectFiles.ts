import { readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import type { ProjectFile, ProjectSnapshot } from '../../shared/types';
import { ensureSampleServer } from '../samples/sampleServer';

const ignoredDirectories = new Set(['.git', 'node_modules', '.strudel-studio', 'dist', 'out']);
const acceptedExtensions = new Set(['.strudel', '.str', '.std']);

export const workspaceDirectoryName = '.strudel-studio';
export const workspaceFileName = 'workspace.json';

export const assertInsideProject = (projectRoot: string, relativePath: string): string => {
  const root = resolve(projectRoot);
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error('Path must stay inside the selected project folder.');
  }
  return target;
};

export const listProjectFiles = async (projectRoot: string): Promise<ProjectFile[]> => {
  const files: ProjectFile[] = [];

  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await visit(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (!acceptedExtensions.has(extension)) {
        continue;
      }

      const metadata = await stat(absolutePath);
      const relativePath = relative(projectRoot, absolutePath).replaceAll('\\', '/');
      files.push({
        id: relativePath,
        absolutePath,
        relativePath,
        name: basename(absolutePath),
        extension,
        size: metadata.size,
        modifiedAt: metadata.mtime.toISOString(),
      });
    }
  };

  await visit(projectRoot);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
};

export const createProjectSnapshot = async (projectRoot: string): Promise<ProjectSnapshot> => {
  const rootPath = resolve(projectRoot);
  const [files, sampleServer] = await Promise.all([
    listProjectFiles(rootPath),
    ensureSampleServer(rootPath),
  ]);

  return {
    rootPath,
    name: basename(rootPath),
    files,
    sampleServer,
  };
};

export const getWorkspacePath = (projectRoot: string): string => {
  return join(resolve(projectRoot), workspaceDirectoryName, workspaceFileName);
};
