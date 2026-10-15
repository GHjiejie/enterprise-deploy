import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { canonicalJson, sha256, RELEASE_RECORD_FILE } from './release-record.ts';
import { verifyConsoleArtifact } from './console-artifact.ts';
import { readConsoleFile, PACKAGE_LIMITS } from './console-package.ts';

const contentTypes: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

export interface ConsolePreview {
  readonly server: Server;
  readonly origin: string;
  close(): Promise<void>;
}

export async function createConsolePreview(siteDirectory: string): Promise<ConsolePreview> {
  const { record } = verifyConsoleArtifact(siteDirectory);
  const recordSha256 = sha256(
    readConsoleFile(join(siteDirectory, RELEASE_RECORD_FILE), PACKAGE_LIMITS.fileBytes),
  );
  const allowedFiles = new Set([
    ...record.artifacts.map((file) => file.path),
    'release-record.json',
  ]);
  let origin = '';
  const server = createServer((request, response) => {
    if (request.headers.host !== new URL(origin).host) {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', origin).pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (
      pathname.includes('\\') ||
      pathname.split('/').some((segment) => segment === '..' || segment.startsWith('.'))
    ) {
      response.writeHead(404).end();
      return;
    }
    const requestedFile = pathname.slice(1);
    const file = allowedFiles.has(requestedFile) ? requestedFile : 'index.html';
    if (
      file === 'index.html' &&
      requestedFile &&
      !allowedFiles.has(requestedFile) &&
      (pathname.startsWith('/assets/') || !(request.headers.accept ?? '').includes('text/html'))
    ) {
      response.writeHead(404).end();
      return;
    }
    try {
      const current = verifyConsoleArtifact(siteDirectory);
      if (canonicalJson(current.record) !== canonicalJson(record))
        throw new Error('固定构建快照已变化');
      const bytes = readConsoleFile(join(siteDirectory, file), PACKAGE_LIMITS.fileBytes);
      const expected =
        file === RELEASE_RECORD_FILE
          ? recordSha256
          : record.artifacts.find((entry) => entry.path === file)?.sha256;
      if (!expected || sha256(bytes) !== expected) throw new Error('固定构建文件已变化');
      response.writeHead(200, {
        'Content-Type': contentTypes[file.split('.').at(-1) ?? ''] ?? 'application/octet-stream',
        'Content-Length': bytes.length,
        'Cache-Control': file.startsWith('assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') response.end();
      else response.end(bytes);
    } catch {
      response
        .writeHead(409, { 'Cache-Control': 'no-store' })
        .end('固定构建快照验证失败，请重新构建');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('预览端口分配失败');
  origin = `http://127.0.0.1:${address.port}`;
  return {
    server,
    origin,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
