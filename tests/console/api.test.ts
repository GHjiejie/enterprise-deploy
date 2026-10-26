import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { request as httpRequest } from 'node:http';
import { buildPaths, parseAudit } from '../../build/audit/record';
import { loadPolicy } from '../../build/policy/manifest';
import { parseBootstrap, parseJob, parseStarted } from '../../build/console/contracts';
import { createBuildConsole } from '../../build/console/server';
import { sha256 } from '../../build/utils';
import { fixture } from '../helpers/fixture';

describe('local console API and real build', () => {
  const project = fixture();
  let app: Awaited<ReturnType<typeof createBuildConsole>>;
  let token = '';
  beforeAll(async () => {
    app = await createBuildConsole({ root: project.root, port: 0 });
    const data = parseBootstrap(await (await fetch(`${app.origin}/api/bootstrap`)).json());
    token = data.csrfToken;
  });
  afterAll(async () => {
    await app?.close();
    project.dispose();
  });
  const headers = () => ({
    Origin: app.origin,
    'X-Console-Token': token,
    'Content-Type': 'application/json',
  });

  it('exposes only structured configuration and rejects foreign origins, hosts and missing session tokens', async () => {
    const data = parseBootstrap(await (await fetch(`${app.origin}/api/bootstrap`)).json());
    expect(data.modules).toHaveLength(120);
    expect(data.modules.find((item) => item.id === 'order-notes')?.requires).toEqual([
      'order-detail',
    ]);
    expect(data.brands).toHaveLength(2);
    expect(data.enterprises).toHaveLength(3);
    expect(
      (
        await fetch(`${app.origin}/api/bootstrap`, {
          headers: { Origin: 'https://example.invalid' },
        })
      ).status,
    ).toBe(403);
    const foreignHost = await new Promise<number>((done, reject) => {
      const request = httpRequest(
        `${app.origin}/api/bootstrap`,
        { headers: { Host: 'example.invalid' } },
        (response) => {
          response.resume();
          done(response.statusCode ?? 0);
        },
      );
      request.once('error', reject);
      request.end();
    });
    expect(foreignHost).toBe(403);
    expect(
      (
        await fetch(`${app.origin}/api/enterprises`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    expect(
      (await fetch(`${app.origin}/@fs${project.root}/config/enterprises/enterprise-a.json`)).status,
    ).toBe(403);
  });

  it('saves valid profiles and refuses invalid bodies and stale revisions', async () => {
    const profile = {
      schemaVersion: 1,
      enterpriseId: 'api-company',
      enabledModules: ['orders'],
      brandingId: 'brand-b',
    };
    const create = await fetch(`${app.origin}/api/enterprises`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ profile, expectedRevision: null }),
    });
    expect(create.status).toBe(200);
    expect(
      JSON.parse(
        readFileSync(resolve(project.root, 'config/enterprises/api-company.json'), 'utf8'),
      ),
    ).toEqual(profile);
    const conflict = await fetch(`${app.origin}/api/enterprises`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ profile, expectedRevision: null }),
    });
    expect(conflict.status).toBe(409);
    const invalid = await fetch(`${app.origin}/api/builds`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        profile: { ...profile, enterpriseId: '../escape' },
        expectedRevision: null,
        mode: 'production',
      }),
    });
    expect(invalid.status).toBe(400);
  });

  it('builds an immutable snapshot, verifies downloads, previews it and retains history after restart', async () => {
    const data = parseBootstrap(await (await fetch(`${app.origin}/api/bootstrap`)).json());
    const entry = data.enterprises.find((item) => item.profile.enterpriseId === 'enterprise-b');
    if (!entry) throw new Error('fixture');
    const startedResponse = await fetch(`${app.origin}/api/builds`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        profile: entry.profile,
        expectedRevision: entry.revision,
        mode: 'production',
      }),
    });
    expect(startedResponse.status).toBe(202);
    const started = parseStarted(await startedResponse.json());
    const busy = await fetch(`${app.origin}/api/enterprises`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ profile: entry.profile, expectedRevision: started.entry.revision }),
    });
    expect(busy.status).toBe(409);
    writeFileSync(
      resolve(project.root, 'config/enterprises/enterprise-b.json'),
      JSON.stringify({ ...entry.profile, enabledModules: ['orders', 'reports'] }),
    );
    let job = started.job;
    const deadline = Date.now() + 30000;
    while (job.status === 'running' && Date.now() < deadline) {
      await new Promise<void>((done) => setTimeout(done, 100));
      job = parseJob(await (await fetch(`${app.origin}/api/builds/${job.id}`)).json());
    }
    expect(job.status, job.log).toBe('succeeded');
    expect(job.result?.enabledModules).toEqual(['orders']);
    expect(job.result?.excludedModules.slice().sort()).toEqual(
      loadPolicy(project.root, 'enterprise-a')
        .catalog.map((item) => item.id)
        .filter((id) => id !== 'orders')
        .sort(),
    );
    const archive = await fetch(`${app.origin}/api/builds/${job.id}/package`);
    expect(archive.status).toBe(200);
    expect(sha256(new Uint8Array(await archive.arrayBuffer()))).toBe(job.result?.packageHash);
    const report = await fetch(`${app.origin}/api/builds/${job.id}/report`);
    expect(report.status).toBe(200);
    const snapshotRoot = resolve(project.root, '.console/runs', job.id, 'project');
    const audit = parseAudit(
      await report.json(),
      loadPolicy(snapshotRoot, job.profile.enterpriseId),
    );
    expect(audit.enabledModules).toEqual(['orders']);
    expect(audit.sources.inputs.every((input) => !input.id.includes('build-console'))).toBe(true);
    const [preview, concurrentPreview] = await Promise.all([
      fetch(`${app.origin}/api/builds/${job.id}/preview`, { redirect: 'manual' }),
      fetch(`${app.origin}/api/builds/${job.id}/preview`, { redirect: 'manual' }),
    ]);
    expect(preview.status).toBe(302);
    expect(concurrentPreview.status).toBe(302);
    const location = preview.headers.get('Location');
    if (!location) throw new Error('preview');
    expect(concurrentPreview.headers.get('Location')).toBe(location);
    expect((await fetch(`${location}orders`, { headers: { Accept: 'text/html' } })).status).toBe(
      200,
    );
    expect(
      (await fetch(`${location}assets/missing.js`, { headers: { Accept: 'text/html' } })).status,
    ).toBe(404);
    await app.close();
    app = await createBuildConsole({ root: project.root, port: 0 });
    expect(
      parseBootstrap(await (await fetch(`${app.origin}/api/bootstrap`)).json()).jobs.find(
        (item) => item.id === job.id,
      )?.status,
    ).toBe('succeeded');
    expect((await fetch(`${app.origin}/api/builds/${job.id}/package`)).status).toBe(200);
    const site = resolve(
      buildPaths(resolve(project.root, '.console/runs', job.id, 'project'), 'enterprise-b', job.id)
        .release,
      'site/index.html',
    );
    writeFileSync(site, `${readFileSync(site, 'utf8')}\n<!-- altered -->`);
    expect((await fetch(`${app.origin}/api/builds/${job.id}/package`)).status).toBe(409);
    expect((await fetch(`${app.origin}/api/builds/${job.id}/preview`)).status).toBe(409);
  });
});
