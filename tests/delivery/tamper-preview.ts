import { createServer } from 'node:http';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import type { ModuleId } from '../../shared/build-profile.ts';
import type { ReleaseRecord } from '../../build/release-record.ts';

/** An explicitly unverified local copy for the UI tampering regression, never a release path. */
export async function startTamperedPreview(
  source: string,
  record: ReleaseRecord,
  disabled: readonly ModuleId[],
): Promise<{ origin: string; close: () => Promise<void> }> {
  const root = mkdtempSync(join(tmpdir(), 'enterprise-tampered-preview-'));
  const site = join(root, 'site');
  cpSync(source, site, { recursive: true });
  let changed = 0;
  for (const file of record.artifacts.filter((item) => item.path.endsWith('.js'))) {
    const path = join(site, file.path);
    let code = readFileSync(path, 'utf8');
    for (const id of disabled)
      code = code.replace(
        new RegExp(`(${id}:)(?:!1|false)(?=[,}])`, 'gu'),
        (_match, prefix: string) => {
          changed++;
          return `${prefix}!0`;
        },
      );
    writeFileSync(path, code);
  }
  if (changed < disabled.length) {
    rmSync(root, { recursive: true, force: true });
    throw new Error('Tamper fixture did not find all embedded disabled switches');
  }
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const path = resolve(site, `.${decodeURIComponent(url.pathname)}`);
    if (!path.startsWith(`${site}/`) && path !== site) {
      response.writeHead(404).end();
      return;
    }
    const actual =
      existsSync(path) && lstatSync(path).isFile()
        ? path
        : extname(path)
          ? null
          : join(site, 'index.html');
    if (!actual) {
      response.writeHead(404).end();
      return;
    }
    const type =
      (
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
        } as Record<string, string>
      )[extname(actual)] ?? 'application/octet-stream';
    response
      .writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
      .end(readFileSync(actual));
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing tamper preview address');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
      rmSync(root, { recursive: true, force: true });
    },
  };
}
