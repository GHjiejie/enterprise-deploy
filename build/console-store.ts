import { randomUUID } from 'node:crypto';
import {
  constants,
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { BuildProfile } from '../shared/build-profile.ts';
import type { ProfileEntry } from '../shared/build-console.ts';
import { validateModuleAssembly } from './module-catalog.ts';
import { parseBuildProfile } from './load-profile.ts';
import { sha256 } from './release-record.ts';

export class ConsoleError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** Refuse symlinks in the directory path before reading or writing profiles. */
export function assertRegularDirectory(directory: string): void {
  const absolute = resolve(directory);
  const parent = dirname(absolute);
  if (parent !== absolute) assertRegularDirectory(parent);
  const stat = lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new ConsoleError(400, '配置或制品目录必须是普通目录，不能使用符号链接');
  }
}

function readRegularFile(path: string): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(descriptor).isFile()) {
      throw new ConsoleError(400, '企业配置必须是普通 JSON 文件');
    }
    return readFileSync(descriptor);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ELOOP') {
      throw new ConsoleError(400, '企业配置不能使用符号链接');
    }
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function validateConsoleProfile(value: unknown): BuildProfile {
  try {
    const id = typeof value === 'object' && value !== null && 'id' in value ? value.id : undefined;
    // The existing parser checks the id before any path is constructed.
    const profile = parseBuildProfile(value, id as string);
    validateModuleAssembly(profile);
    return profile;
  } catch (error) {
    throw new ConsoleError(400, error instanceof Error ? error.message : '企业配置无效');
  }
}

export interface ConsoleProfileStore {
  readonly directory: string;
  list(): ProfileEntry[];
  save(profile: unknown, expectedRevision: unknown): ProfileEntry;
  snapshot(directory: string): void;
}

export function createConsoleProfileStore(
  rootDir: string,
  profilesDirectory = join(rootDir, 'config/profiles'),
): ConsoleProfileStore {
  const directory = resolve(profilesDirectory);

  function readEntry(id: string): ProfileEntry | null {
    const path = join(directory, `${id}.json`);
    let bytes: Buffer;
    try {
      bytes = readRegularFile(path);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new ConsoleError(400, `企业配置 ${id} 不是有效 JSON`);
    }
    const profile = validateConsoleProfile(value);
    if (profile.id !== id) throw new ConsoleError(400, '配置 id 与文件名不一致');
    return { profile, revision: sha256(bytes) };
  }

  function list(): ProfileEntry[] {
    assertRegularDirectory(directory);
    return readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => {
        const id = name.slice(0, -5);
        // Validate file names too; listing must never accept an unsafe id.
        if (!/^[a-z][a-z0-9-]{0,63}$/u.test(id)) {
          throw new ConsoleError(400, `企业配置文件名无效：${name}`);
        }
        const entry = readEntry(id);
        if (!entry) throw new ConsoleError(409, '配置目录发生变化，请刷新后重试');
        return entry;
      });
  }

  function save(value: unknown, expectedRevision: unknown): ProfileEntry {
    const profile = validateConsoleProfile(value);
    if (
      expectedRevision !== null &&
      (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedRevision))
    ) {
      throw new ConsoleError(400, 'expectedRevision 必须是有效版本或 null');
    }
    assertRegularDirectory(directory);
    const current = readEntry(profile.id);
    if (
      current?.revision !== expectedRevision &&
      !(current === null && expectedRevision === null)
    ) {
      throw new ConsoleError(409, '企业配置已被修改或已存在，请刷新后重试');
    }

    const bytes = Buffer.from(`${JSON.stringify(profile, null, 2)}\n`);
    const target = join(directory, `${profile.id}.json`);
    const temporary = join(directory, `.console-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
      // Check again just before the atomic replacement.
      assertRegularDirectory(directory);
      const latest = readEntry(profile.id);
      if (latest?.revision !== current?.revision) {
        throw new ConsoleError(409, '企业配置已被修改，请刷新后重试');
      }
      renameSync(temporary, target);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    return { profile, revision: sha256(bytes) };
  }

  function snapshot(destination: string): void {
    const entries = list();
    mkdirSync(destination, { recursive: true });
    assertRegularDirectory(destination);
    for (const { profile } of entries) {
      writeFileSync(
        join(destination, `${profile.id}.json`),
        `${JSON.stringify(profile, null, 2)}\n`,
        {
          flag: 'wx',
          mode: 0o600,
        },
      );
    }
  }

  return { directory, list, save, snapshot };
}
