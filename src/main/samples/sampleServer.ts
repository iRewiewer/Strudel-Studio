import { createServer, type Server } from 'node:http';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import type { SampleServerInfo } from '../../shared/types';

type RunningSampleServer = {
  server: Server;
  info: SampleServerInfo;
};

const serversByRoot = new Map<string, RunningSampleServer>();
const audioExtensions = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aiff', '.aif']);

const contentTypes: Record<string, string> = {
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
};

const collectSamples = async (samplesRoot: string): Promise<Record<string, string | string[]>> => {
  const sampleMap = new Map<string, string[]>();

  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile() || !audioExtensions.has(extname(entry.name).toLowerCase())) {
        continue;
      }

      const relativePath = relative(samplesRoot, absolutePath).replaceAll('\\', '/');
      const parentRelative = relative(samplesRoot, directory).replaceAll('\\', '/');
      const sampleName = parentRelative === '' ? basename(entry.name, extname(entry.name)) : parentRelative.split('/').at(-1) ?? parentRelative;
      const existing = sampleMap.get(sampleName) ?? [];
      existing.push(relativePath);
      sampleMap.set(sampleName, existing);
    }
  };

  await visit(samplesRoot);

  const manifest: Record<string, string | string[]> = {};
  for (const [name, paths] of sampleMap.entries()) {
    const sorted = paths.sort((a, b) => a.localeCompare(b));
    const firstSample = sorted[0];
    if (!firstSample) {
      continue;
    }
    manifest[name] = sorted.length === 1 ? firstSample : sorted;
  }
  return manifest;
};

const createManifest = async (samplesRoot: string, baseUrl: string): Promise<Record<string, string | string[]>> => {
  const manifest = await collectSamples(samplesRoot);
  return {
    _base: `${baseUrl}/`,
    ...manifest,
  };
};

const listen = async (server: Server): Promise<number> => {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolveListen(address.port);
      } else {
        reject(new Error('Could not bind local sample server.'));
      }
    });
  });
};

export const ensureSampleServer = async (projectRoot: string): Promise<SampleServerInfo | null> => {
  const samplesRoot = resolve(projectRoot, 'samples');
  const rootMetadata = await stat(samplesRoot).catch(() => null);
  if (!rootMetadata?.isDirectory()) {
    return null;
  }

  const existing = serversByRoot.get(samplesRoot);
  if (existing) {
    return existing.info;
  }

  let baseUrl = '';
  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');

    if (!request.url) {
      response.writeHead(404);
      response.end();
      return;
    }

    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/strudel.json') {
      const manifest = await createManifest(samplesRoot, baseUrl);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(manifest, null, 2));
      return;
    }

    const requestedPath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ''));
    const absolutePath = resolve(samplesRoot, requestedPath);
    if (absolutePath !== samplesRoot && !absolutePath.startsWith(samplesRoot + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }

    const metadata = await stat(absolutePath).catch(() => null);
    if (!metadata?.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(absolutePath).toLowerCase()] ?? 'application/octet-stream',
    });
    createReadStream(absolutePath).pipe(response);
  });

  const port = await listen(server);
  baseUrl = `http://127.0.0.1:${port}`;
  const sampleCount = Object.keys(await collectSamples(samplesRoot)).length;
  const info: SampleServerInfo = {
    baseUrl,
    manifestUrl: `${baseUrl}/strudel.json`,
    samplesRoot,
    sampleCount,
  };
  serversByRoot.set(samplesRoot, { server, info });
  return info;
};
