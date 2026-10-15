import { afterEach, describe, expect, it } from 'vitest';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { generateActiveModuleSource } from '../../build/active-modules-plugin.ts';
import { runEnterpriseBuild } from '../../build/build-enterprise.ts';
import { moduleEntries } from '../../build/module-catalog.ts';
import {
  MODULE_ROOTS,
  PRUNING_REPORT_FILE,
  verifyPruningArtifact,
  type PruningReport,
} from '../../build/pruning.ts';
import { RELEASE_RECORD_FILE, type ReleaseRecord } from '../../build/release-record.ts';
import { MODULE_IDS, type BuildProfile, type ModuleId } from '../../shared/build-profile.ts';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const roots: string[] = [];
const videoOnly = makeProfile(['videoStudio']);

function makeProfile(enabled: readonly ModuleId[], id = 'pruning-fixture'): BuildProfile {
  const defaultModule = enabled[0];
  if (!defaultModule) throw new Error('Fixture must enable at least one module');
  return {
    schemaVersion: 1,
    id,
    modules: {
      modelCatalog: enabled.includes('modelCatalog'),
      chat: enabled.includes('chat'),
      imageStudio: enabled.includes('imageStudio'),
      videoStudio: enabled.includes('videoStudio'),
    },
    defaultModule,
  };
}

/** Actual application sources and locked dependencies, isolated from working-tree artifacts. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'enterprise-pruning-'));
  roots.push(root);
  for (const path of [
    'src',
    'shared',
    'package.json',
    'package-lock.json',
    'index.html',
    '.env.development',
    '.env.staging',
    '.env.production',
  ]) {
    if (existsSync(join(projectRoot, path)))
      cpSync(join(projectRoot, path), join(root, path), { recursive: true });
  }
  mkdirSync(join(root, 'config'), { recursive: true });
  cpSync(
    join(projectRoot, 'config/backend-compatibility.json'),
    join(root, 'config/backend-compatibility.json'),
  );
  symlinkSync(join(projectRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
  return root;
}

function output(root: string, profile = videoOnly, mode = 'production'): string {
  return join(root, 'dist', profile.id, mode);
}

function appendPage(root: string, source: string, id: ModuleId = 'videoStudio'): void {
  appendFileSync(join(root, moduleEntries[id].page), `\n${source}\n`);
}

async function buildFixture(
  root: string,
  profile = videoOnly,
  plugins: Plugin[] = [],
): Promise<ReleaseRecord> {
  return runEnterpriseBuild('production', { rootDir: root, profile, plugins, quiet: true });
}

function bytesByKind(root: string, report: PruningReport, kind: 'script' | 'style'): string {
  return report.files
    .filter((file) => file.kind === kind)
    .map((file) => readFileSync(join(root, file.path), 'utf8'))
    .join('\n');
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('real enterprise pruning build', () => {
  it('generates business imports only for explicitly enabled modules', () => {
    const source = generateActiveModuleSource(videoOnly);
    expect(source).toContain('/src/modules/video-studio/module.ts');
    expect(source).toContain('/src/modules/video-studio/page.tsx');
    for (const id of MODULE_IDS.filter((id) => id !== 'videoStudio')) {
      expect(source).not.toContain(moduleEntries[id].metadata);
      expect(source).not.toContain(moduleEntries[id].page);
    }
    expect(source).toContain('export const activatorLoaders = {}');
    expect(source).not.toContain('import.meta.glob');
  });

  it('keeps owned CSS, inlined media, and emitted ?url assets in the evidence', async () => {
    const root = fixture();
    const directory = join(root, MODULE_ROOTS.videoStudio);
    // A real one-pixel PNG is small enough for Vite's CSS data-URL inlining.
    writeFileSync(
      join(directory, 'tiny.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    writeFileSync(join(directory, 'large.png'), Buffer.alloc(12 * 1024, 7));
    appendFileSync(
      join(directory, 'styles.css'),
      '\n.asset-probe { background-image: url("./tiny.png"); }\n',
    );
    appendPage(
      root,
      'import largeUrl from "./large.png?url"; console.info("OWNED_ASSET_PROBE", largeUrl);',
    );
    const record = await buildFixture(root);
    const report = verifyPruningArtifact(output(root), record);
    expect(record.schemaVersion).toBe(2);
    expect(report.emittedModuleIds).toEqual(['videoStudio']);
    expect(report.excludedModules).toEqual(['modelCatalog', 'chat', 'imageStudio']);
    expect(bytesByKind(output(root), report, 'style')).toContain('data:image/png;base64,');
    expect(
      report.files.some((file) => file.kind === 'style' && file.owners.includes('videoStudio')),
    ).toBe(true);
    expect(
      report.files.some(
        (file) =>
          file.kind === 'asset' &&
          file.path.includes('large-') &&
          file.owners.includes('videoStudio'),
      ),
    ).toBe(true);
    const scripts = bytesByKind(output(root), report, 'script');
    expect(scripts).toContain('OWNED_ASSET_PROBE');
    expect(scripts).not.toContain('chat-page');
    expect(scripts).not.toContain('image-studio-page');
    expect(scripts).not.toContain('catalog-page');
    expect(bytesByKind(output(root), report, 'style')).not.toContain('.model-grid');
    expect(JSON.stringify(report)).not.toContain(root);
  }, 30_000);

  it('keeps a fixed owned new URL asset with import.meta.url in the checked bundle', async () => {
    const root = fixture();
    writeFileSync(
      join(root, MODULE_ROOTS.videoStudio, 'url-owned.png'),
      Buffer.from('OWNED_URL_ASSET_BYTES'),
    );
    appendPage(
      root,
      'console.info("OWNED_URL_PROBE", new URL("./url-owned.png", import.meta.url).href);',
    );
    const record = await buildFixture(root);
    const report = verifyPruningArtifact(output(root), record);
    const scripts = bytesByKind(output(root), report, 'script');
    expect(scripts).toContain('OWNED_URL_PROBE');
    expect(scripts).toContain(Buffer.from('OWNED_URL_ASSET_BYTES').toString('base64'));
    expect(
      report.files.some((file) => file.kind === 'script' && file.owners.includes('videoStudio')),
    ).toBe(true);
  }, 30_000);

  it.each([
    ['disabled asset', ['videoStudio'] as const, '../image-studio/url-private.png', false],
    [
      'another active module asset',
      ['imageStudio', 'videoStudio'] as const,
      '../image-studio/url-private.png',
      false,
    ],
    [
      'shared-to-private asset',
      ['imageStudio', 'videoStudio'] as const,
      '../modules/image-studio/url-private.png',
      true,
    ],
  ])(
    'rejects new URL/import.meta.url access to %s',
    async (_label, enabled, url, fromShared) => {
      const root = fixture();
      writeFileSync(
        join(root, MODULE_ROOTS.imageStudio, 'url-private.png'),
        Buffer.from('PRIVATE_URL_ASSET_BYTES'),
      );
      const source = `console.info(new URL(${JSON.stringify(url)}, import.meta.url).href);`;
      if (fromShared) {
        writeFileSync(join(root, 'src/shared/url-leak.ts'), source);
        appendPage(root, 'import "../../shared/url-leak.ts";');
      } else appendPage(root, source);
      await expect(buildFixture(root, makeProfile(enabled))).rejects.toThrow(
        /Disabled module|Private .*dependency forbidden/,
      );
    },
    30_000,
  );

  it('rejects computed runtime imports with no approved local module target', async () => {
    const root = fixture();
    appendPage(
      root,
      'const runtimeEntry = window.location.hash.slice(1); void import(/* @vite-ignore */ runtimeEntry);',
    );
    await expect(buildFixture(root)).rejects.toThrow(
      /dynamic.*import|runtime.*import|ownership adapter|unapproved/i,
    );
  }, 30_000);

  it('rejects dynamic import.meta.url asset paths whose ownership cannot be proven', async () => {
    const root = fixture();
    appendPage(
      root,
      'const untrustedAsset = window.location.hash; console.info(new URL(untrustedAsset, import.meta.url).href);',
    );
    await expect(buildFixture(root)).rejects.toThrow(/Dynamic|dynamic|ownership|Unsupported.*URL/);
  }, 30_000);

  it.each([
    ['uppercase URL function', 'url-private.png', 'URL("../image-studio/url-private.png")'],
    [
      'quoted filename containing a space',
      'url private.png',
      'url("../image-studio/url private.png")',
    ],
    [
      'image-set string resource',
      'url-private.png',
      'image-set("../image-studio/url-private.png" 1x)',
    ],
  ])(
    'rejects a disabled inlined CSS asset using %s',
    async (_label, fileName, cssValue) => {
      const root = fixture();
      writeFileSync(
        join(root, MODULE_ROOTS.imageStudio, fileName),
        Buffer.from('PRIVATE_CSS_URL_BYTES'),
      );
      appendFileSync(
        join(root, MODULE_ROOTS.videoStudio, 'styles.css'),
        `\n.bypass-probe { background-image: ${cssValue}; }\n`,
      );
      await expect(buildFixture(root)).rejects.toThrow(
        /Disabled module|Private .*dependency forbidden|Unsupported CSS/,
      );
    },
    30_000,
  );

  it('rejects an unapproved external runtime script with an unquoted HTML URL', async () => {
    const root = fixture();
    const htmlPath = join(root, 'index.html');
    writeFileSync(
      htmlPath,
      readFileSync(htmlPath, 'utf8').replace(
        '</body>',
        '<script src=https://example.invalid/feature.js></script></body>',
      ),
    );
    await expect(buildFixture(root)).rejects.toThrow(
      /External HTML|external.*resource|unapproved/i,
    );
  }, 30_000);

  it('rejects unknown virtual implementations even when their ID names an existing shared file', async () => {
    const root = fixture();
    const realFile = join(root, 'src/shared/virtual-spoof.ts');
    writeFileSync(realFile, 'export const publicValue = "disk implementation";');
    const virtualId = `\0${realFile}`;
    appendPage(root, 'import value from "virtual:spoof-shared"; console.info(value);');
    const plugin: Plugin = {
      name: 'unknown-virtual-probe',
      resolveId(id) {
        if (id === 'virtual:spoof-shared') return virtualId;
      },
      load(id) {
        if (id === virtualId) return 'export default "UNDECLARED_VIRTUAL_IMPLEMENTATION";';
      },
    };
    await expect(buildFixture(root, videoOnly, [plugin])).rejects.toThrow(
      /Unknown|unowned|virtual/,
    );
  }, 30_000);

  it('rejects disabled private code before successful delivery, even if it could be tree-shaken', async () => {
    const root = fixture();
    appendPage(root, 'import "../chat/page.tsx";');
    await expect(buildFixture(root)).rejects.toThrow(/Disabled module chat/);
    expect(existsSync(join(output(root), RELEASE_RECORD_FILE))).toBe(false);
  }, 30_000);

  it.each([
    ['shared source', 'src/shared/private-leak.ts', 'import "../modules/video-studio/page.tsx";'],
    [
      'another enabled module',
      'src/modules/video-studio/private-leak.ts',
      'import "../chat/page.tsx";',
    ],
  ])(
    'rejects a private import from %s',
    async (_label, path, source) => {
      const root = fixture();
      writeFileSync(join(root, path), source);
      const relativeImport = path.startsWith('src/shared')
        ? '../../shared/private-leak.ts'
        : './private-leak.ts';
      appendPage(root, `import ${JSON.stringify(relativeImport)};`);
      const profile = makeProfile(['chat', 'videoStudio']);
      await expect(buildFixture(root, profile)).rejects.toThrow(
        /Private module dependency forbidden/,
      );
      expect(existsSync(join(output(root, profile), RELEASE_RECORD_FILE))).toBe(false);
    },
    30_000,
  );

  it.each([
    [
      'disabled CSS resource',
      'src/modules/video-studio/styles.css',
      '../image-studio/private.png',
      ['videoStudio'] as const,
    ],
    [
      'cross-private CSS resource',
      'src/modules/video-studio/styles.css',
      '../image-studio/private.png',
      ['imageStudio', 'videoStudio'] as const,
    ],
    [
      'shared CSS resource',
      'src/shared/resource-leak.css',
      '../modules/image-studio/private.png',
      ['imageStudio', 'videoStudio'] as const,
    ],
  ])(
    'rejects %s imported through CSS url()',
    async (_label, cssPath, url, enabled) => {
      const root = fixture();
      writeFileSync(
        join(root, 'src/modules/image-studio/private.png'),
        Buffer.from('private-media'),
      );
      appendFileSync(join(root, cssPath), `\n.leak { background: url(${JSON.stringify(url)}); }\n`);
      if (cssPath.startsWith('src/shared'))
        appendPage(root, 'import "../../shared/resource-leak.css";');
      const profile = makeProfile(enabled);
      await expect(buildFixture(root, profile)).rejects.toThrow(
        /Disabled module|Private (?:module|CSS resource) dependency forbidden/,
      );
    },
    30_000,
  );

  it('uses real symlink targets when checking shared-to-private imports', async () => {
    const root = fixture();
    symlinkSync(
      join(root, 'src/modules/video-studio/page.tsx'),
      join(root, 'src/shared/symlink-leak.tsx'),
    );
    writeFileSync(join(root, 'src/shared/private-leak.ts'), 'import "./symlink-leak.tsx";');
    appendPage(root, 'import "../../shared/private-leak.ts";');
    await expect(buildFixture(root)).rejects.toThrow(/Private module dependency forbidden/);
  }, 30_000);

  it('rejects plugin assets without an approved source', async () => {
    const root = fixture();
    const plugin: Plugin = {
      name: 'unowned-output-probe',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'assets/unowned.txt',
          source: 'UNKNOWN_PLUGIN_OUTPUT',
        });
      },
    };
    await expect(buildFixture(root, videoOnly, [plugin])).rejects.toThrow(/Unowned|provenance/);
    expect(existsSync(join(output(root), RELEASE_RECORD_FILE))).toBe(false);
  }, 30_000);

  it('invalidates an old successful record even when pre-compilation validation fails', async () => {
    const root = fixture();
    await buildFixture(root);
    const recordPath = join(output(root), RELEASE_RECORD_FILE);
    expect(existsSync(recordPath)).toBe(true);
    writeFileSync(join(root, 'config/backend-compatibility.json'), '{}');
    await expect(buildFixture(root)).rejects.toThrow(/compatibility|fields|Missing|backend/i);
    expect(existsSync(recordPath)).toBe(false);
  }, 30_000);

  it('waits for closeBundle and rejects changed final bytes instead of issuing a record', async () => {
    const root = fixture();
    // Begin with a successful output to verify a later failure cannot reuse its record.
    await buildFixture(root);
    const plugin: Plugin = {
      name: 'late-write-probe',
      closeBundle() {
        appendFileSync(join(output(root), 'index.html'), '\n<!-- LATE_MUTATION -->\n');
      },
    };
    await expect(buildFixture(root, videoOnly, [plugin])).rejects.toThrow(
      /changed after bundle inspection/,
    );
    expect(existsSync(join(output(root), RELEASE_RECORD_FILE))).toBe(false);
  }, 30_000);

  it('rejects extra files written by a late plugin hook', async () => {
    const root = fixture();
    const plugin: Plugin = {
      name: 'late-extra-output-probe',
      closeBundle() {
        writeFileSync(join(output(root), 'assets/old-feature.js'), 'OLD_MODULE_IMPLEMENTATION');
      },
    };
    await expect(buildFixture(root, videoOnly, [plugin])).rejects.toThrow(/missing or extra files/);
    expect(existsSync(join(output(root), RELEASE_RECORD_FILE))).toBe(false);
  }, 30_000);

  it.each([
    [
      'worker constructor',
      'new Worker(new URL("./probe-worker.ts", import.meta.url), { type: "module" });',
    ],
    [
      'worker query',
      'import WorkerProbe from "./probe-worker.ts?worker"; console.info(WorkerProbe);',
    ],
    ['WASM asset', 'import wasmUrl from "./probe.wasm?url"; console.info(wasmUrl);'],
  ])(
    'explicitly rejects unsupported %s delivery',
    async (_label, source) => {
      const root = fixture();
      const directory = join(root, MODULE_ROOTS.videoStudio);
      writeFileSync(join(directory, 'probe-worker.ts'), 'self.postMessage("worker");');
      writeFileSync(join(directory, 'probe.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
      appendPage(root, source);
      await expect(buildFixture(root)).rejects.toThrow(/Worker\/WASM|ownership adapter/);
    },
    30_000,
  );

  it('serializes writes to the same enterprise and environment with an output lock', async () => {
    const root = fixture();
    let enter: () => void = () => undefined;
    let release: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const plugin: Plugin = {
      name: 'hold-build-probe',
      async buildStart() {
        enter();
        await released;
      },
    };
    const first = buildFixture(root, videoOnly, [plugin]);
    try {
      await entered;
      await expect(buildFixture(root)).rejects.toThrow(/已有构建|输出锁/);
    } finally {
      release();
    }
    const record = await first;
    expect(verifyPruningArtifact(output(root), record).enabledModules).toEqual(['videoStudio']);
    expect(existsSync(join(root, 'dist/.locks', `${videoOnly.id}-production.lock`))).toBe(false);
  }, 30_000);

  it('keeps concurrent different enterprise builds isolated', async () => {
    const root = fixture();
    const chat = makeProfile(['chat'], 'parallel-chat');
    const video = makeProfile(['videoStudio'], 'parallel-video');
    const records = await Promise.all([buildFixture(root, chat), buildFixture(root, video)]);
    for (const [index, profile] of [chat, video].entries()) {
      const record = records[index];
      if (!record) throw new Error('Missing concurrent build result');
      expect(verifyPruningArtifact(output(root, profile), record).enabledModules).toEqual([
        profile.defaultModule,
      ]);
    }
  }, 30_000);

  it('rejects unexpected empty directories added to a verified artifact', async () => {
    const root = fixture();
    const record = await buildFixture(root);
    mkdirSync(join(output(root), 'assets/unexpected-empty'), { recursive: true });
    expect(() => verifyPruningArtifact(output(root), record)).toThrow(/director|changed|extra/i);
  }, 30_000);

  it('revalidates reports and exact disk contents when an artifact is reused', async () => {
    const root = fixture();
    const record = await buildFixture(root);
    const reportPath = join(output(root), PRUNING_REPORT_FILE);
    const original = readFileSync(reportPath);
    const altered = JSON.parse(original.toString('utf8')) as PruningReport;
    altered.enabledModules = ['chat'];
    writeFileSync(reportPath, JSON.stringify(altered));
    expect(() => verifyPruningArtifact(output(root), record)).toThrow(/checksum mismatch/);
    writeFileSync(reportPath, original);
    writeFileSync(join(output(root), 'assets/stale-page.js'), 'STALE_CHAT_SOURCE');
    expect(() => verifyPruningArtifact(output(root), record)).toThrow(/changed, missing or extra/);
    rmSync(join(output(root), 'assets/stale-page.js'));
    expect(verifyPruningArtifact(output(root), record).enabledModules).toEqual(['videoStudio']);
  }, 30_000);
});

const combinations = Array.from({ length: 15 }, (_, index) => {
  const mask = index + 1;
  return MODULE_IDS.filter((_id, bit) => (mask & (1 << bit)) !== 0);
});
const matrix = combinations.flatMap((enabled) =>
  (['staging', 'production'] as const).map((mode) => ({
    name: `${enabled.join('+')} / ${mode}`,
    enabled,
    mode,
  })),
);

describe('all supported module combinations', () => {
  it.each(matrix)(
    '$name emits exactly its enabled implementations and owned resources',
    async ({ enabled, mode }) => {
      const root = fixture();
      const profile = makeProfile(enabled);
      for (const id of MODULE_IDS) {
        const page = join(root, moduleEntries[id].page);
        const marker = `PRIVATE_IMPLEMENTATION_SENTINEL_${id}`;
        if (profile.modules[id])
          appendFileSync(page, `\nconsole.info(${JSON.stringify(marker)});\n`);
        // If a disabled page is ever resolved, its invalid syntax makes a successful build impossible.
        else writeFileSync(page, `DISABLED_PAGE_MUST_NOT_BE_PARSED @@@ ${marker}`);
      }
      const record = await runEnterpriseBuild(mode, { rootDir: root, profile, quiet: true });
      const outDir = output(root, profile, mode);
      const report = verifyPruningArtifact(outDir, record);
      expect(report.enabledModules).toEqual(enabled);
      expect(report.emittedModuleIds).toEqual(enabled);
      expect(report.excludedModules).toEqual(MODULE_IDS.filter((id) => !enabled.includes(id)));
      const scripts = bytesByKind(outDir, report, 'script');
      for (const id of MODULE_IDS) {
        const marker = `PRIVATE_IMPLEMENTATION_SENTINEL_${id}`;
        if (profile.modules[id]) expect(scripts).toContain(marker);
        else {
          expect(scripts).not.toContain(marker);
          expect(report.files.every((file) => !file.owners.includes(id))).toBe(true);
        }
      }
      expect(report.files.every((file) => !/\.(?:map|tsx?|jsx)$/u.test(file.path))).toBe(true);
      expect(existsSync(join(outDir, RELEASE_RECORD_FILE))).toBe(true);
      expect(existsSync(join(root, 'dist/.locks', `${profile.id}-${mode}.lock`))).toBe(false);
    },
    30_000,
  );
});
