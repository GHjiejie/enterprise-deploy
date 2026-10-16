import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { verifyPackage } from './package.ts';
import { buildPaths } from './audit/record.ts';
import { args, cli, isMain, PROJECT_ROOT, sha256 } from './utils.ts';
import type { AuditRecord } from './audit/types.ts';

const mime: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

/** Serve the frozen approved bytes. Missing static resources never receive an SPA fallback. */
export function staticServer(audit: AuditRecord, site: string) {
  const files = new Map(
    audit.files.map((item) => {
      const bytes = readFileSync(resolve(site, item.path));
      if (bytes.byteLength !== item.bytes || sha256(bytes) !== item.sha256)
        throw new Error(`PREVIEW_FILE_HASH_MISMATCH: ${item.path}`);
      return [item.path, bytes] as const;
    }),
  );
  return createServer((request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname).slice(1);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (
      path.includes('\\') ||
      path.split('/').some((part) => part.startsWith('.') || part.includes('\0'))
    ) {
      response.writeHead(404).end();
      return;
    }
    if (path === '') path = 'index.html';
    if (!files.has(path) && !extname(path) && request.headers.accept?.includes('text/html'))
      path = 'index.html';
    const bytes = files.get(path);
    if (!bytes) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    response.setHeader('Content-Length', bytes.byteLength);
    response.writeHead(200);
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
}

if (isMain(import.meta.url))
  await cli(async () => {
    const values = args(['enterprise', 'release-id', 'port']);
    if (!values.enterprise || !values['release-id'])
      throw new Error('REQUIRED: --enterprise <id> --release-id <id> [--port 5191]');
    const port = Number(values.port ?? '5191');
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('INVALID_PORT');
    const { audit } = verifyPackage(PROJECT_ROOT, values.enterprise, values['release-id']);
    const server = staticServer(
      audit,
      resolve(buildPaths(PROJECT_ROOT, values.enterprise, values['release-id']).release, 'site'),
    );
    await new Promise<void>((done, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', done);
    });
    console.log(`http://127.0.0.1:${port} · ${audit.enterpriseId}/${audit.releaseId}`);
  });
