import { mkdir, readdir, rename } from 'node:fs/promises';
import { extname, join } from 'node:path';

const outputDirectory = 'build';
const binDirectory = join(outputDirectory, 'bin');
const distributableExtensions = new Set([
  '.appimage',
  '.deb',
  '.dmg',
  '.exe',
  '.msi',
  '.rpm',
  '.snap',
  '.zip',
]);

const isDistributable = (fileName) => {
  if (fileName.endsWith('.blockmap')) {
    return false;
  }

  return distributableExtensions.has(extname(fileName).toLowerCase());
};

const collectArtifacts = async () => {
  const entries = await readdir(outputDirectory, { withFileTypes: true }).catch(() => []);
  const artifacts = entries.filter((entry) => entry.isFile() && isDistributable(entry.name));

  if (artifacts.length === 0) {
    return;
  }

  await mkdir(binDirectory, { recursive: true });

  for (const artifact of artifacts) {
    await rename(join(outputDirectory, artifact.name), join(binDirectory, artifact.name));
  }
};

await collectArtifacts();
