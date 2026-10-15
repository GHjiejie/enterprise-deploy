import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PACKAGE_LIMITS,
  verifyConsolePackage,
  writeConsolePackage,
} from '../../build/console-package.ts';
import {
  parseReleaseRecord,
  writeReleaseRecord,
  sha256,
  canonicalJson,
} from '../../build/release-record.ts';
import { writeFixturePruningReport } from '../helpers/pruned-artifact.ts';
import type { BuildProfile } from '../../shared/build-profile.ts';

const roots: string[] = [];
interface TarInput {
  name: string;
  type?: string;
  bytes?: string;
  size?: number;
  link?: string;
}

/** Tiny independent fixture writer for corrupt/hostile tar inputs, not production extraction. */
function tarEntry(input: TarInput): Buffer {
  const data = Buffer.from(input.bytes ?? '');
  const header = Buffer.alloc(512);
  header.write(input.name, 0, 100);
  for (const [offset, length, value] of [
    [100, 8, 0o644],
    [108, 8, 0],
    [116, 8, 0],
    [124, 12, input.size ?? data.length],
    [136, 12, 0],
  ]) {
    header.write(value!.toString(8).padStart(length! - 1, '0'), offset!, length! - 1, 'ascii');
  }
  header.write(input.type ?? '0', 156, 1);
  header.write(input.link ?? '', 157, 100);
  header.write('ustar\0', 257, 6);
  header.write('00', 263, 2);
  header.fill(32, 148, 156);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

function packageFile(entries: TarInput[], transform?: (tar: Buffer) => Buffer): string {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'enterprise-tar-fixture-'));
  roots.push(root);
  const packagePath = join(root, 'package.tar.gz');
  const tar = Buffer.concat([...entries.map(tarEntry), Buffer.alloc(1024)]);
  writeFileSync(packagePath, gzipSync(transform ? transform(tar) : tar));
  return packagePath;
}

const base: TarInput[] = [
  { name: './index.html', bytes: '<html>fixture</html>' },
  { name: './release-record.json', bytes: '{}' },
];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('strict console package validation', () => {
  it('preflights a valid record count and padded tar size before reading business files', () => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'enterprise-package-writer-'));
    roots.push(root);
    const profile: BuildProfile = {
      schemaVersion: 1,
      id: 'package-preflight',
      modules: { modelCatalog: true, chat: false, imageStudio: false, videoStudio: false },
      defaultModule: 'modelCatalog',
    };
    writeFileSync(join(root, 'index.html'), 'fixture');
    const record = writeReleaseRecord({
      outDir: root,
      profile,
      mode: 'production',
      buildId: 'package-preflight',
      pruning: writeFixturePruningReport(root, profile, 'production', 'package-preflight'),
      backendCompatibility: {
        policyVersion: 'v1',
        contractVersion: 'v1',
        requiredCapabilities: [],
      },
    });
    const records = [
      {
        ...record,
        directories: Array.from(
          { length: PACKAGE_LIMITS.entries },
          (_, index) => `directory-${String(index).padStart(5, '0')}`,
        ),
      },
      {
        ...record,
        artifacts: record.artifacts
          .map((file) => ({ ...file, bytes: PACKAGE_LIMITS.fileBytes }))
          .concat(
            Array.from({ length: 4 }, (_, index) => ({
              path: `large-${index}.bin`,
              bytes: PACKAGE_LIMITS.fileBytes,
              sha256: 'a'.repeat(64),
            })),
          )
          .sort((a, b) => a.path.localeCompare(b.path)),
      },
    ];
    for (const value of records) {
      const files = { artifacts: value.artifacts, directories: value.directories };
      const valid = parseReleaseRecord({ ...value, artifactDigest: sha256(canonicalJson(files)) });
      if (valid.schemaVersion !== 2) throw new Error('fixture must be V2');
      // Most declared files do not exist; a read-before-limit implementation would fail ENOENT.
      expect(() => writeConsolePackage(root, join(root, 'oversize.tar.gz'), valid)).toThrow(
        /数量|大小/u,
      );
    }
    expect(() => readFileSync(join(root, 'oversize.tar.gz'))).toThrow();
  });

  it('checks inventory before extraction, verifies in an isolated directory and cleans up', () => {
    const file = packageFile([
      ...base,
      { name: './assets/', type: '5' },
      { name: './assets/app.js', bytes: 'export const ok = true;' },
    ]);
    let unpacked = '';
    const packageBytes = verifyConsolePackage(file, (directory) => {
      unpacked = directory;
      expect(readFileSync(join(directory, 'assets/app.js'), 'utf8')).toContain('export const ok');
    });
    expect(packageBytes).toEqual(readFileSync(file));
    expect(() => readFileSync(join(unpacked, 'index.html'))).toThrow();
  });

  it.each([
    { name: '/absolute', bytes: 'bad' },
    { name: '/', type: '5' },
    { name: '', type: '5' },
    { name: '../escaped', bytes: 'bad' },
    { name: './nested/../../escaped', bytes: 'bad' },
    { name: 'C:/escaped', bytes: 'bad' },
    { name: './nested\\escaped', bytes: 'bad' },
    { name: './nested//file', bytes: 'bad' },
    { name: './nested/./file', bytes: 'bad' },
    { name: './bad\nname', bytes: 'bad' },
    { name: './index.html', bytes: 'duplicate' },
    { name: 'index.html', bytes: 'canonical duplicate' },
    { name: './link', type: '1', link: 'index.html' },
    { name: './link', type: '2', link: '/tmp/outside' },
    { name: './fifo', type: '6' },
    { name: './device', type: '3' },
    { name: './extended', type: 'x', bytes: 'path=../escaped' },
    { name: './longname', type: 'L', bytes: '../escaped' },
    { name: './sparse', type: 'S' },
    { name: './plain-with-link', link: '../escaped' },
    { name: './directory/', type: '5', bytes: 'directory data' },
    { name: './oversize', size: PACKAGE_LIMITS.fileBytes + 1 },
  ])('rejects unsafe tar entry %j without running the verifier', (entry) => {
    const file = packageFile([...base, entry]);
    let verified = false;
    expect(() =>
      verifyConsolePackage(file, () => {
        verified = true;
      }),
    ).toThrow();
    expect(verified).toBe(false);
  });

  it('rejects file/parent conflicts regardless of entry order', () => {
    for (const entries of [
      [
        { name: './parent/child', bytes: 'x' },
        { name: './parent', bytes: 'x' },
      ],
      [
        { name: './parent', bytes: 'x' },
        { name: './parent/child', bytes: 'x' },
      ],
    ])
      expect(() => verifyConsolePackage(packageFile([...base, ...entries]), () => {})).toThrow(
        '目录冲突',
      );
  });

  it('rejects corrupt checksums, missing terminators, trailing payload and truncated entries', () => {
    const transforms = [
      (tar: Buffer) => {
        const bytes = Buffer.from(tar);
        bytes[1] = 120;
        return bytes;
      },
      (tar: Buffer) => tar.subarray(0, tar.length - 1024),
      (tar: Buffer) => Buffer.concat([tar, tarEntry({ name: './hidden', bytes: 'payload' })]),
      (tar: Buffer) => tar.subarray(0, 513),
    ];
    for (const transform of transforms)
      expect(() => verifyConsolePackage(packageFile(base, transform), () => {})).toThrow();
  });

  it('enforces compressed size and inventory count limits before extraction', () => {
    const file = packageFile(base);
    truncateSync(file, PACKAGE_LIMITS.compressedBytes + 1);
    expect(() => verifyConsolePackage(file, () => {})).toThrow('大小');
    const entries = Array.from({ length: PACKAGE_LIMITS.entries }, (_, index) => ({
      name: `./file-${index}`,
    }));
    expect(() => verifyConsolePackage(packageFile([...base, ...entries]), () => {})).toThrow(
      '数量',
    );
  });

  it('cleans the isolated extraction directory even if final V2 verification fails', () => {
    let directory = '';
    expect(() =>
      verifyConsolePackage(packageFile(base), (path) => {
        directory = path;
        mkdirSync(join(path, 'verification-touched'));
        throw new Error('fixture V2 rejection');
      }),
    ).toThrow('fixture V2 rejection');
    expect(() => readFileSync(join(directory, 'release-record.json'))).toThrow();
  });
});
