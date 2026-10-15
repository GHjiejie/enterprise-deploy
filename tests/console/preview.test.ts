import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { get } from 'node:http';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createConsolePreview, type ConsolePreview } from '../../build/console-preview.ts';
import { writeReleaseRecord } from '../../build/release-record.ts';
import type { BuildProfile } from '../../shared/build-profile.ts';
import { writeFixturePruningReport } from '../helpers/pruned-artifact.ts';

const directories: string[] = [];
const servers: ConsolePreview[] = [];
const profile: BuildProfile = {
  schemaVersion: 1,
  id: 'preview-example',
  modules: { modelCatalog: true, chat: false, imageStudio: false, videoStudio: false },
  defaultModule: 'modelCatalog',
};

function artifact() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'enterprise-preview-')));
  directories.push(directory);
  mkdirSync(join(directory, 'assets'));
  writeFileSync(
    join(directory, 'index.html'),
    '<html><script type="module" src="/assets/main-12345678.js"></script></html>',
  );
  writeFileSync(join(directory, 'assets/main-12345678.js'), 'export const value = 1;');
  writeReleaseRecord({
    outDir: directory,
    profile,
    mode: 'production',
    buildId: 'preview-fixture',
    pruning: writeFixturePruningReport(directory, profile, 'production', 'preview-fixture'),
    backendCompatibility: {
      policyVersion: 'demo-v1',
      contractVersion: 'demo-contract-v1',
      requiredCapabilities: [],
    },
  });
  return directory;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('isolated build result preview', () => {
  it('serves the verified snapshot with module MIME types and SPA deep links', async () => {
    const server = await createConsolePreview(artifact());
    servers.push(server);
    const html = await fetch(`${server.origin}/`, { headers: { Accept: 'text/html' } });
    expect(html.status).toBe(200);
    expect(html.headers.get('content-type')).toContain('text/html');
    expect(html.headers.get('cache-control')).toBe('no-cache');
    const script = await fetch(`${server.origin}/assets/main-12345678.js`);
    expect(script.headers.get('content-type')).toContain('text/javascript');
    expect(script.headers.get('cache-control')).toContain('immutable');
    expect(await script.text()).toContain('export const value');
    const deepLink = await fetch(`${server.origin}/playground/image/tasks/demo-id`, {
      headers: { Accept: 'text/html' },
    });
    expect(deepLink.status).toBe(200);
    expect(await deepLink.text()).toContain('<html>');
  });

  it('does not serve missing assets, hidden files, wrong hosts or mutation methods', async () => {
    const server = await createConsolePreview(artifact());
    servers.push(server);
    expect(
      (await fetch(`${server.origin}/assets/missing.js`, { headers: { Accept: 'text/html' } }))
        .status,
    ).toBe(404);
    expect((await fetch(`${server.origin}/.env`)).status).toBe(404);
    expect((await fetch(`${server.origin}/`, { method: 'POST' })).status).toBe(405);
    // fetch normalizes Host; use an actual HTTP request to exercise a mismatched header.
    const wrongHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(server.origin, { headers: { Host: 'example.invalid' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      }).on('error', reject);
    });
    expect(wrongHostStatus).toBe(403);
  });

  it('rejects modified snapshots before starting a preview server', async () => {
    const directory = artifact();
    writeFileSync(join(directory, 'assets/main-12345678.js'), 'tampered');
    await expect(createConsolePreview(directory)).rejects.toThrow('完整性');
  });

  it('revalidates each request and refuses snapshots changed after server startup', async () => {
    const directory = artifact();
    const server = await createConsolePreview(directory);
    servers.push(server);
    expect((await fetch(`${server.origin}/assets/main-12345678.js`)).status).toBe(200);
    writeFileSync(join(directory, 'assets/main-12345678.js'), 'tampered later');
    expect((await fetch(`${server.origin}/assets/main-12345678.js`)).status).toBe(409);
    expect((await fetch(`${server.origin}/`, { headers: { Accept: 'text/html' } })).status).toBe(
      409,
    );
  });
});
