import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, rmSync, symlinkSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { buildEnterprise } from '../../build/enterprise';
import { loadPolicy } from '../../build/policy/manifest';
import { scanSources } from '../../build/policy/scan';
import { createEnterpriseConfig } from '../../build/config';
import { auditBuild, buildPaths, qualifyOutputs } from '../../build/audit/record';
import type { AuditRecord, Collector } from '../../build/audit/types';
import { packageBuild, verifyPackage } from '../../build/package';
import { publishRelease } from '../../build/publish';
import { staticServer } from '../../build/preview';
import { filesIn, readJson } from '../../build/utils';
import { append, changeJson, fixture } from '../helpers/fixture';

describe('production delivery', () => {
  const project = fixture();
  let a: AuditRecord;
  let b: AuditRecord;
  beforeAll(async () => {
    [a, b] = await Promise.all([
      buildEnterprise(project.root, 'enterprise-a', 'production', 'test-a'),
      buildEnterprise(project.root, 'enterprise-b', 'production', 'test-b'),
    ]);
    packageBuild(project.root, 'enterprise-a', 'test-a');
    packageBuild(project.root, 'enterprise-b', 'test-b');
  });
  afterAll(project.dispose);

  it('builds A and B concurrently without mixed registries, brands or outputs', () => {
    expect(a.enabledModules).toEqual(['orders', 'order-export', 'reports']);
    expect(b.enabledModules).toEqual(['orders']);
    expect(a.contexts.filter((item) => item.kind === 'worker')).toHaveLength(1);
    expect(b.contexts.filter((item) => item.kind === 'worker')).toHaveLength(0);
    expect(a.files.some((item) => item.producer === 'worker')).toBe(true);
    expect(
      a.files.some((item) => item.inputs.some((input) => input.id.endsWith('/revenue.svg'))),
    ).toBe(true);
    for (const item of b.contexts)
      for (const input of item.modules)
        expect(['reports', 'order-export', 'brand-a']).not.toContain(input.owner);
    for (const file of b.files)
      for (const input of file.inputs)
        expect(['reports', 'order-export', 'brand-a']).not.toContain(input.owner);
    expect(auditBuild(project.root, 'enterprise-b', 'test-b').siteHash).toBe(b.siteHash);
    const businessText = b.files
      .filter((file) => file.path.endsWith('.js') || file.path.endsWith('.css'))
      .map((file) =>
        readFileSync(
          resolve(buildPaths(project.root, 'enterprise-b', 'test-b').site, file.path),
          'utf8',
        ),
      )
      .join('\n');
    expect(businessText).not.toMatch(/经营报表|导出订单|report\.read|order\.export/u);
    const site = resolve(buildPaths(project.root, 'enterprise-b', 'test-b').release, 'site');
    expect(filesIn(site).every((file) => !file.includes('audit') && !file.endsWith('.map'))).toBe(
      true,
    );
    expect(filesIn(site)).toHaveLength(b.files.length);
  });

  it.each(['unexpected.js', 'old.js.map', 'stale.js.gz', 'stale.js.br', 'src.ts'])(
    'blocks an extra delivered %s',
    (name) => {
      const site = buildPaths(project.root, 'enterprise-b', 'test-b').site;
      const extra = resolve(site, name);
      writeFileSync(extra, 'unexpected');
      try {
        expect(() => auditBuild(project.root, 'enterprise-b', 'test-b')).toThrow(
          'FILE_SET_MISMATCH',
        );
      } finally {
        rmSync(extra);
      }
    },
  );

  it('blocks changed bytes and inline source maps', () => {
    const site = buildPaths(project.root, 'enterprise-b', 'test-b').site;
    const file = resolve(site, b.files.find((item) => item.kind === 'chunk')?.path ?? 'missing');
    const original = readFileSync(file);
    try {
      writeFileSync(file, Buffer.concat([original, Buffer.from('\n// modified')]));
      expect(() => auditBuild(project.root, 'enterprise-b', 'test-b')).toThrow(
        'FILE_HASH_MISMATCH',
      );
      writeFileSync(
        file,
        Buffer.concat([
          original,
          Buffer.from('\n//# sourceMappingURL=data:application/json;base64,e30='),
        ]),
      );
      expect(() => auditBuild(project.root, 'enterprise-b', 'test-b')).toThrow('SOURCE_MAP_OUTPUT');
    } finally {
      writeFileSync(file, original);
    }
  });

  it('blocks symbolic links in final output', () => {
    const site = buildPaths(project.root, 'enterprise-b', 'test-b').site;
    const link = resolve(site, 'link.js');
    symlinkSync(resolve(site, 'index.html'), link);
    try {
      expect(() => auditBuild(project.root, 'enterprise-b', 'test-b')).toThrow('SYMLINK_OUTPUT');
    } finally {
      rmSync(link);
    }
  });

  it('does not trust zero counters or forged source ownership', () => {
    const auditFile = resolve(
      buildPaths(project.root, 'enterprise-b', 'test-b').audit,
      'audit.json',
    );
    const original = readFileSync(auditFile);
    const forged = JSON.parse(original.toString()) as { contexts: { modules: unknown[] }[] };
    forged.contexts[0]?.modules.push({
      id: 'src/modules/reports/api.ts',
      kind: 'business',
      owner: 'reports',
      sha256: '0'.repeat(64),
      imports: [],
      dynamicImports: [],
      entry: false,
    });
    writeFileSync(auditFile, JSON.stringify(forged));
    try {
      expect(() => auditBuild(project.root, 'enterprise-b', 'test-b')).toThrow('FORBIDDEN_MODULE');
    } finally {
      writeFileSync(auditFile, original);
    }
  });

  it('rechecks both sealed directory and archive hashes', () => {
    const paths = buildPaths(project.root, 'enterprise-b', 'test-b');
    expect(verifyPackage(project.root, 'enterprise-b', 'test-b').audit.siteHash).toBe(b.siteHash);
    const original = readFileSync(paths.archive);
    writeFileSync(paths.archive, Buffer.concat([original, Buffer.from('tampered')]));
    try {
      expect(() => verifyPackage(project.root, 'enterprise-b', 'test-b')).toThrow(
        'PACKAGE_HASH_MISMATCH',
      );
    } finally {
      writeFileSync(paths.archive, original);
    }
    expect(() => packageBuild(project.root, 'enterprise-b', 'test-b')).toThrow(
      'PACKAGE_ALREADY_EXISTS',
    );
  });

  it('publishes only to a registered enterprise target and honors its independent module ceiling', () => {
    expect(() => publishRelease(project.root, '../somewhere', 'test-a')).toThrow(
      'INVALID_IDENTIFIER',
    );
    expect(() => publishRelease(project.root, 'unknown', 'test-a')).toThrow(
      'UNKNOWN_DELIVERY_TARGET',
    );
    const targetFile = resolve(project.root, 'config/delivery-targets.json');
    const original = readFileSync(targetFile);
    changeJson(project.root, 'config/delivery-targets.json', (value) => {
      value['local-enterprise-a'] = {
        enterpriseId: 'enterprise-a',
        allowedModules: ['orders'],
        brandingId: 'brand-a',
      };
    });
    try {
      expect(() => publishRelease(project.root, 'local-enterprise-a', 'test-a')).toThrow(
        'TARGET_LICENSE_MISMATCH',
      );
    } finally {
      writeFileSync(targetFile, original);
    }
    const current = publishRelease(project.root, 'local-enterprise-b', 'test-b');
    expect(readFileSync(resolve(current, 'index.html'), 'utf8')).toContain('<!doctype html>');
    expect(readdirSync(resolve(project.root, 'deployments/local-enterprise-b'))).toEqual([
      'current',
    ]);
  });

  it('distinguishes HTML routes from missing JS and private audit downloads', async () => {
    const server = staticServer(
      b,
      resolve(buildPaths(project.root, 'enterprise-b', 'test-b').release, 'site'),
    );
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('address');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      expect((await fetch(`${url}/reports`, { headers: { Accept: 'text/html' } })).status).toBe(
        200,
      );
      expect(
        (await fetch(`${url}/assets/reports-missing.js`, { headers: { Accept: 'text/html' } }))
          .status,
      ).toBe(404);
      expect((await fetch(`${url}/.audit/audit.json`)).status).toBe(404);
      expect((await fetch(`${url}/audit.json`)).status).toBe(404);
    } finally {
      await new Promise<void>((done) => server.close(() => done()));
    }
  });

  it('replaces the complete public generation on license contraction and refuses the old full release', async () => {
    publishRelease(project.root, 'local-enterprise-a', 'test-a');
    const configFile = resolve(project.root, 'config/enterprises/enterprise-a.json');
    const targetFile = resolve(project.root, 'config/delivery-targets.json');
    const config = readFileSync(configFile);
    const target = readFileSync(targetFile);
    try {
      changeJson(project.root, 'config/enterprises/enterprise-a.json', (value) => {
        value.enabledModules = ['orders'];
      });
      changeJson(project.root, 'config/delivery-targets.json', (value) => {
        value['local-enterprise-a'] = {
          enterpriseId: 'enterprise-a',
          allowedModules: ['orders'],
          brandingId: 'brand-a',
        };
      });
      expect(() => publishRelease(project.root, 'local-enterprise-a', 'test-a')).toThrow(
        /AUDIT_(?:MODULE|POLICY)_MISMATCH/u,
      );
      const reduced = await buildEnterprise(
        project.root,
        'enterprise-a',
        'production',
        'test-a-reduced',
      );
      packageBuild(project.root, 'enterprise-a', 'test-a-reduced');
      const current = publishRelease(project.root, 'local-enterprise-a', 'test-a-reduced');
      const filenames = filesIn(current).map((file) => file.slice(current.length + 1));
      expect(filenames.sort()).toEqual(reduced.files.map((file) => file.path).sort());
      const removed = a.files
        .filter((file) =>
          file.inputs.some((input) => input.owner === 'reports' || input.owner === 'order-export'),
        )
        .map((file) => file.path);
      expect(removed.length).toBeGreaterThan(0);
      expect(filenames.some((file) => removed.includes(file))).toBe(false);
      expect(readdirSync(resolve(project.root, 'deployments/local-enterprise-a'))).toEqual([
        'current',
      ]);
    } finally {
      writeFileSync(configFile, config);
      writeFileSync(targetFile, target);
    }
  });
});

describe('actual graph guard and post-build gate', () => {
  let project: ReturnType<typeof fixture>;
  afterEach(() => project?.dispose());

  it.each([
    ['app', `import '../modules/reports/api';`],
    [
      'worker',
      `new Worker(new URL('../modules/reports/api.ts', import.meta.url), { type: 'module' });`,
    ],
  ])(
    'rejects a disabled implementation in the %s graph even without source scanning',
    async (_kind, code) => {
      project = fixture();
      append(project.root, 'src/composition/main.ts', code);
      const policy = loadPolicy(project.root, 'enterprise-b');
      const collector: Collector = { contexts: [] };
      await expect(
        build(
          createEnterpriseConfig(
            policy,
            'production',
            'bad',
            resolve(project.root, '.work/negative'),
            collector,
          ),
        ),
      ).rejects.toThrow('FORBIDDEN_MODULE');
    },
  );

  it('rejects unowned emitted assets and files copied after graph collection', async () => {
    project = fixture();
    const policy = loadPolicy(project.root, 'enterprise-b');
    const sources = scanSources(policy);
    const collector: Collector = { contexts: [] };
    const site = resolve(project.root, '.work/negative');
    const config = createEnterpriseConfig(policy, 'production', 'bad', site, collector);
    config.plugins?.push({
      name: 'unknown-emitter',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'prebuilt.js', source: 'alert(1)' });
      },
    });
    await expect(build(config)).rejects.toThrow('UNOWNED_ASSET');
    const copied: Collector = { contexts: [] };
    const valid = createEnterpriseConfig(policy, 'production', 'copied', site, copied);
    valid.plugins?.push({
      name: 'unknown-copy',
      writeBundle() {
        writeFileSync(resolve(site, 'copied.js'), 'alert(1)');
      },
    });
    await build(valid);
    expect(() => qualifyOutputs(policy, copied, sources, site)).toThrow('FILE_SET_MISMATCH');
  });

  it('disables public copying and local environment overrides', async () => {
    project = fixture();
    const policy = loadPolicy(project.root, 'enterprise-b');
    expect(
      createEnterpriseConfig(policy, 'production', 'x', '.work/x', { contexts: [] }).publicDir,
    ).toBe(false);
    writeFileSync(resolve(project.root, '.env.local'), 'PUBLIC_TOKEN=wrong');
    expect(() =>
      createEnterpriseConfig(policy, 'production', 'x', '.work/x', { contexts: [] }),
    ).toThrow('LOCAL_ENV_OVERRIDE');
  });

  it('tracks multiple Vue style subresources through the same business source', async () => {
    project = fixture();
    append(
      project.root,
      'src/modules/orders/OrdersPage.vue',
      '<style scoped>.style-one { color: #123456; }</style>\n<style>.style-two { color: #654321; }</style>',
    );
    const audit = await buildEnterprise(project.root, 'enterprise-b', 'production', 'vue-styles');
    const styles = audit.files.filter((file) => file.kind === 'style');
    expect(styles.some((file) => file.inputs.some((input) => input.owner === 'orders'))).toBe(true);
    expect(auditBuild(project.root, 'enterprise-b', 'vue-styles').siteHash).toBe(audit.siteHash);
  });
});

describe('HTML output boundary', () => {
  it.each([
    ['inline', '<script>console.log("injected")</script>', 'UNAPPROVED_INLINE_SCRIPT'],
    [
      'remote',
      '<script src="https://example.invalid/remote.js"></script>',
      'UNAPPROVED_RESOURCE_REFERENCE',
    ],
    [
      'missing',
      '<link rel="stylesheet" href="/assets/unregistered.css" />',
      'UNAPPROVED_RESOURCE_REFERENCE',
    ],
  ])('rejects %s HTML injection outside the module graph', async (_label, injection, error) => {
    const project = fixture();
    try {
      const policy = loadPolicy(project.root, 'enterprise-b');
      const sources = scanSources(policy);
      const collector: Collector = { contexts: [] };
      const site = resolve(project.root, '.work/injected');
      const config = createEnterpriseConfig(policy, 'production', 'injected', site, collector);
      config.plugins?.push({
        name: 'html-injection',
        transformIndexHtml: (html) => html.replace('</head>', `${injection}</head>`),
      });
      await build(config);
      expect(() => qualifyOutputs(policy, collector, sources, site)).toThrow(error);
    } finally {
      project.dispose();
    }
  });
});

describe('feature combinations and environment isolation', () => {
  it('builds every valid nonempty capability combination and both release modes', async () => {
    const combinations = [
      ['orders'],
      ['reports'],
      ['orders', 'reports'],
      ['orders', 'order-export'],
      ['orders', 'reports', 'order-export'],
    ];
    for (const [index, modules] of combinations.entries()) {
      const project = fixture();
      try {
        changeJson(project.root, 'config/enterprises/enterprise-a.json', (value) => {
          value.enabledModules = modules;
        });
        const audit = await buildEnterprise(
          project.root,
          'enterprise-a',
          'production',
          `combination-${index}`,
        );
        expect(audit.enabledModules.slice().sort()).toEqual(modules.slice().sort());
        const allowed = new Set(modules);
        expect(
          audit.contexts
            .flatMap((item) => item.modules)
            .filter((item) => item.kind === 'business')
            .every((item) => allowed.has(item.owner)),
        ).toBe(true);
      } finally {
        project.dispose();
      }
    }
    const project = fixture();
    try {
      const staging = await buildEnterprise(project.root, 'enterprise-b', 'staging', 'stage-b');
      expect(staging.mode).toBe('staging');
      expect(staging.notApplicable.map((item) => item.context)).toContain('worker');
      expect(
        readJson(resolve(buildPaths(project.root, 'enterprise-b', 'stage-b').audit, 'audit.json')),
      ).toBeTruthy();
      await expect(
        buildEnterprise(project.root, 'enterprise-b', 'staging', 'stage-b'),
      ).rejects.toThrow('RELEASE_ID_ALREADY_USED');
    } finally {
      project.dispose();
    }
  });
});
