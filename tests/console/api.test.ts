import { createServer, request as httpRequest, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BuildProfile } from '../../shared/build-profile.ts';
import { handleConsoleRequest } from '../../build/console-api.ts';
import {
  createConsoleJobManager,
  type ConsoleBuildRunner,
  type ConsoleJobManager,
} from '../../build/console-jobs.ts';
import { createConsoleProfileStore } from '../../build/console-store.ts';

const roots: string[] = [];
const servers: Server[] = [];
const managers: ConsoleJobManager[] = [];
const releaseRunners: Array<() => void> = [];

function profile(id = 'enterprise-a'): BuildProfile {
  return {
    schemaVersion: 1,
    id,
    modules: { modelCatalog: true, chat: true, imageStudio: false, videoStudio: false },
    defaultModule: 'modelCatalog',
  };
}

async function fixture(runner: ConsoleBuildRunner = async () => 1) {
  const rootDir = mkdtempSync(join(realpathSync(tmpdir()), 'enterprise-console-api-'));
  roots.push(rootDir);
  const directory = join(rootDir, 'config/profiles');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'enterprise-a.json'), JSON.stringify(profile()));
  const store = createConsoleProfileStore(rootDir);
  const jobs = createConsoleJobManager({ rootDir, store, runner });
  managers.push(jobs);
  let origin = '';
  const server = createServer((request, response) => {
    void handleConsoleRequest(request, response, { origin, store, jobs }).then((handled) => {
      if (!handled) {
        response.writeHead(404);
        response.end();
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP address');
  origin = `http://127.0.0.1:${address.port}`;

  function request(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      rawBody?: string;
      chunked?: boolean;
      headers?: Record<string, string>;
    } = {},
  ): Promise<{ status: number; body: string; headers: Record<string, unknown>; json: unknown }> {
    return new Promise((resolve, reject) => {
      const body =
        options.rawBody ?? (options.body === undefined ? '' : JSON.stringify(options.body));
      const outgoing = httpRequest(
        new URL(path, origin),
        {
          method: options.method ?? 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.chunked
              ? { 'Transfer-Encoding': 'chunked' }
              : { 'Content-Length': Buffer.byteLength(body) }),
            ...options.headers,
          },
        },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
          incoming.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString();
            let json: unknown;
            try {
              json = JSON.parse(responseBody);
            } catch {
              json = undefined;
            }
            resolve({
              status: incoming.statusCode ?? 0,
              body: responseBody,
              headers: incoming.headers,
              json,
            });
          });
        },
      );
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  }
  return { request, store, jobs, rootDir, origin };
}

afterEach(async () => {
  for (const release of releaseRunners.splice(0)) release();
  await Promise.all(managers.splice(0).map((jobs) => jobs.dispose()));
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('local build console API', () => {
  it('returns dynamic profile/module metadata and saves a newly named enterprise', async () => {
    const { request } = await fixture();
    const bootstrap = await request('/api/bootstrap');
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.json).toMatchObject({
      modules: [
        { id: 'modelCatalog', label: '模型广场', entryPath: '/models' },
        { id: 'chat', label: '智能对话', entryPath: '/chat' },
        { id: 'imageStudio', label: '图片生成' },
        { id: 'videoStudio', label: '视频生成' },
      ],
      profiles: [{ profile: profile() }],
      activeJob: null,
    });
    expect(bootstrap.headers['access-control-allow-origin']).toBeUndefined();
    const saved = await request('/api/profiles/enterprise-c', {
      method: 'PUT',
      body: { profile: profile('enterprise-c'), expectedRevision: null },
    });
    expect(saved.status).toBe(200);
    expect(saved.json).toMatchObject({ profile: profile('enterprise-c') });
  });

  it('detects concurrent edits and refuses mismatched path ids', async () => {
    const { request, store } = await fixture();
    const revision = store.list()[0]!.revision;
    const changed = { ...profile(), modules: { ...profile().modules, imageStudio: true } };
    expect(
      (
        await request('/api/profiles/enterprise-a', {
          method: 'PUT',
          body: { profile: changed, expectedRevision: revision },
        })
      ).status,
    ).toBe(200);
    const stale = await request('/api/profiles/enterprise-a', {
      method: 'PUT',
      body: { profile: profile(), expectedRevision: revision },
    });
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ error: { code: 'conflict' } });
    expect(
      (
        await request('/api/profiles/enterprise-d', {
          method: 'PUT',
          body: { profile: profile('enterprise-c'), expectedRevision: null },
        })
      ).status,
    ).toBe(400);
    expect(store.list()[0]!.profile).toEqual(changed);
  });

  it('blocks saves and second builds while a build is active', async () => {
    let release: (() => void) | undefined;
    const { request, store } = await fixture(
      () =>
        new Promise<number>((resolve) => {
          release = () => resolve(1);
          releaseRunners.push(release);
        }),
    );
    const body = {
      profile: profile(),
      expectedRevision: store.list()[0]!.revision,
      mode: 'production',
    };
    const started = await request('/api/builds', { method: 'POST', body });
    expect(started.status).toBe(202);
    const id = (started.json as { job: { id: string } }).job.id;
    expect((await request(`/api/builds/${id}`)).json).toMatchObject({ status: 'running' });
    expect(
      (
        await request('/api/profiles/enterprise-c', {
          method: 'PUT',
          body: { profile: profile('enterprise-c'), expectedRevision: null },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request('/api/builds', {
          method: 'POST',
          body: { profile: profile('enterprise-d'), expectedRevision: null, mode: 'production' },
        })
      ).status,
    ).toBe(409);
    expect(store.list().map((entry) => entry.profile.id)).toEqual(['enterprise-a']);
    expect((await request(`/api/builds/${id}/package`)).status).toBe(409);
    release!();
    await expect
      .poll(() => request(`/api/builds/${id}`).then((result) => result.json))
      .toMatchObject({
        status: 'failed',
        result: null,
      });
    expect((await request(`/api/builds/${id}/package`)).status).toBe(409);
  });

  it.each([
    {
      profile: { ...profile('new-enterprise'), defaultModule: 'imageStudio' },
      expectedRevision: null,
      mode: 'production',
    },
    { profile: profile('new-enterprise'), expectedRevision: null, mode: 'development' },
    { profile: profile('../escape'), expectedRevision: null, mode: 'production' },
    {
      profile: profile('new-enterprise'),
      expectedRevision: null,
      mode: 'production',
      command: 'echo injected',
    },
  ])('rejects invalid build requests without saving or executing: %j', async (body) => {
    let calls = 0;
    const { request, store } = await fixture(async () => {
      calls++;
      return 0;
    });
    expect((await request('/api/builds', { method: 'POST', body })).status).toBe(400);
    expect(store.list().map((entry) => entry.profile.id)).toEqual(['enterprise-a']);
    expect(calls).toBe(0);
  });

  it.each([
    { Origin: 'https://external.example' },
    { Origin: 'null' },
    { Host: 'external.example' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])('rejects cross-origin or unexpected Host requests %j', async (headers) => {
    const { request, rootDir } = await fixture();
    const before = readFileSync(join(rootDir, 'config/profiles/enterprise-a.json'), 'utf8');
    const result = await request('/api/profiles/enterprise-a', {
      method: 'PUT',
      headers,
      body: { profile: profile(), expectedRevision: null },
    });
    expect(result.status).toBe(403);
    expect(result.headers['access-control-allow-origin']).toBeUndefined();
    expect(readFileSync(join(rootDir, 'config/profiles/enterprise-a.json'), 'utf8')).toBe(before);
  });

  it('rejects non-JSON, oversized and malformed requests', async () => {
    const { request } = await fixture();
    expect(
      (
        await request('/api/builds', {
          method: 'POST',
          rawBody: '{}',
          headers: { 'Content-Type': 'text/plain' },
        })
      ).status,
    ).toBe(415);
    expect(
      (await request('/api/builds', { method: 'POST', rawBody: 'x'.repeat(1024 * 1024 + 1) }))
        .status,
    ).toBe(413);
    expect(
      (
        await request('/api/builds', {
          method: 'POST',
          rawBody: 'x'.repeat(1024 * 1024 + 1),
          chunked: true,
        })
      ).status,
    ).toBe(413);
    expect((await request('/api/builds', { method: 'POST', rawBody: '{broken' })).status).toBe(400);
    expect((await request('/api/builds', { method: 'POST', body: [] })).status).toBe(400);
    expect((await request('/api/builds/unknown')).status).toBe(404);
    expect((await request('/api/bootstrap', { method: 'POST', body: {} })).status).toBe(405);
  });
});
