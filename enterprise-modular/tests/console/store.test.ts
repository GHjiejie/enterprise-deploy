import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { createProfileStore, enterpriseJson } from '../../build/console/store';
import { createJobManager } from '../../build/console/jobs';
import { fixture } from '../helpers/fixture';

let project: ReturnType<typeof fixture>;
afterEach(() => project?.dispose());

describe('visual configuration store', () => {
  it('creates and updates manifests with revision checks and repository formatting', async () => {
    project = fixture();
    const store = createProfileStore(project.root);
    const profile = {
      schemaVersion: 1,
      enterpriseId: 'new-company',
      enabledModules: ['orders'],
      brandingId: 'brand-b',
    };
    const first = store.save(profile, null);
    const file = resolve(project.root, 'config/enterprises/new-company.json');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(first.profile);
    expect(await format(readFileSync(file, 'utf8'), { parser: 'json', printWidth: 100 })).toBe(
      readFileSync(file, 'utf8'),
    );
    const updated = store.save(
      { ...profile, enabledModules: ['orders', 'reports'] },
      first.revision,
    );
    expect(updated.revision).not.toBe(first.revision);
    expect(() => store.save(profile, first.revision)).toThrow('配置已被其他页面');
    expect(() => store.save(profile, null)).toThrow('配置已被其他页面');
    expect(store.read('new-company')).toEqual(updated);
    expect(store.list().map((item) => item.profile.enterpriseId)).toContain('new-company');
    expect(await format(enterpriseJson(updated.profile), { parser: 'json', printWidth: 100 })).toBe(
      enterpriseJson(updated.profile),
    );
  });

  it('rejects path traversal, missing dependencies, unknown modules and foreign brands without writing', () => {
    project = fixture();
    const store = createProfileStore(project.root);
    const profile = {
      schemaVersion: 1,
      enterpriseId: 'invalid',
      enabledModules: ['orders'],
      brandingId: 'brand-b',
    };
    expect(() => store.save({ ...profile, enterpriseId: '../escape' }, null)).toThrow(
      'INVALID_IDENTIFIER',
    );
    expect(() => store.save({ ...profile, enabledModules: ['order-export'] }, null)).toThrow(
      'MISSING_DEPENDENCY',
    );
    expect(() => store.save({ ...profile, enabledModules: ['unknown'] }, null)).toThrow(
      'UNKNOWN_MODULE',
    );
    expect(() => store.save({ ...profile, brandingId: 'unknown' }, null)).toThrow('UNKNOWN_BRAND');
    expect(() => store.save({ ...profile, extra: 'shell' }, null)).toThrow('INVALID_FIELDS');
    expect(existsSync(resolve(project.root, 'config/enterprises/invalid.json'))).toBe(false);
  });

  it('rejects symlink configuration files and detects an external editor change', () => {
    project = fixture();
    const store = createProfileStore(project.root);
    const original = store.read('enterprise-b');
    if (!original) throw new Error('fixture');
    writeFileSync(
      resolve(project.root, 'config/enterprises/enterprise-b.json'),
      JSON.stringify({ ...original.profile, brandingId: 'brand-a' }),
    );
    expect(() => store.save(original.profile, original.revision)).toThrow('配置已被其他页面');
    symlinkSync(
      resolve(project.root, 'config/enterprises/enterprise-a.json'),
      resolve(project.root, 'config/enterprises/symlink.json'),
    );
    expect(() => store.read('symlink')).toThrow('软链接');
  });
});

describe('build task boundaries', () => {
  it('does not turn a zero exit code or forged stage log into a successful artifact', async () => {
    project = fixture();
    const store = createProfileStore(project.root);
    const manager = createJobManager(project.root, store, async (_root, _request, output) => {
      output('@@console-stage verifying\nall success\n');
      return 0;
    });
    try {
      const entry = store.read('enterprise-b');
      if (!entry) throw new Error('fixture');
      const { job } = manager.start(entry.profile, entry.revision, 'production');
      await new Promise<void>((done) => setTimeout(done, 20));
      expect(manager.get(job.id)?.status).toBe('failed');
      expect(manager.get(job.id)?.result).toBeNull();
      expect(() => manager.verified(job.id)).toThrow('尚无通过复验');
      expect(existsSync(resolve(project.root, '.console/operation.lock'))).toBe(false);
    } finally {
      await manager.close();
    }
  });

  it('serializes saves and builds and unwinds the process lock on shutdown', async () => {
    project = fixture();
    const store = createProfileStore(project.root);
    const manager = createJobManager(
      project.root,
      store,
      async (_root, _request, _output, signal) =>
        new Promise<number>((done) =>
          signal.addEventListener('abort', () => done(1), { once: true }),
        ),
    );
    const entry = store.read('enterprise-b');
    if (!entry) throw new Error('fixture');
    const { job } = manager.start(entry.profile, entry.revision, 'production');
    expect(() => manager.start(entry.profile, entry.revision, 'production')).toThrow(
      '已有打包任务',
    );
    expect(() => manager.save(entry.profile, entry.revision)).toThrow('已有打包任务');
    const second = createJobManager(project.root, store);
    try {
      expect(() => second.save(entry.profile, entry.revision)).toThrow('其他控制台');
    } finally {
      await second.close();
    }
    await manager.close();
    expect(manager.get(job.id)?.status).toBe('failed');
    expect(existsSync(resolve(project.root, '.console/operation.lock'))).toBe(false);
  });
});
