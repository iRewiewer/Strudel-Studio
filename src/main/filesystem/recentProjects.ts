import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { RecentProject } from '../../shared/types';
import { getWorkspacePath } from './projectFiles';

const getRecentProjectsPath = (): string => {
  return join(app.getPath('userData'), 'recent-projects.json');
};

export const listRecentProjects = async (): Promise<RecentProject[]> => {
  const recentPath = getRecentProjectsPath();
  const raw = await readFile(recentPath, 'utf8').catch(() => '[]');
  const parsed = JSON.parse(raw) as RecentProject[];
  return parsed
    .filter((project) => typeof project.rootPath === 'string' && typeof project.lastOpenedAt === 'string')
    .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    .slice(0, 12);
};

export const rememberRecentProject = async (projectRoot: string): Promise<void> => {
  const recentPath = getRecentProjectsPath();
  const existing = await listRecentProjects();
  const nextProject: RecentProject = {
    rootPath: projectRoot,
    name: basename(projectRoot),
    workspacePath: getWorkspacePath(projectRoot),
    lastOpenedAt: new Date().toISOString(),
  };
  const next = [
    nextProject,
    ...existing.filter((project) => project.rootPath !== projectRoot),
  ].slice(0, 12);

  await mkdir(dirname(recentPath), { recursive: true });
  await writeFile(recentPath, JSON.stringify(next, null, 2), 'utf8');
};

export const forgetRecentProject = async (projectRoot: string): Promise<RecentProject[]> => {
  const recentPath = getRecentProjectsPath();
  const existing = await listRecentProjects();
  const next = existing.filter((project) => project.rootPath !== projectRoot);

  await mkdir(dirname(recentPath), { recursive: true });
  await writeFile(recentPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
};
