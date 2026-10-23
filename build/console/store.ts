import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadBrands, parseEnterprise, selectModules, validateCatalog } from '../policy/manifest.ts';
import type { Enterprise } from '../policy/types.ts';
import { identifier, readJson, sha256 } from '../utils.ts';
import type { BrandSummary, ModuleSummary, ProfileEntry } from './contracts.ts';

export class ConsoleError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'invalid_request',
  ) {
    super(message);
  }
}

export function regularDirectory(directory: string): void {
  const parent = dirname(directory);
  if (parent !== directory) regularDirectory(parent);
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new ConsoleError(400, '目录必须是普通目录，不能使用软链接');
}

export function readRegularFile(file: string): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(descriptor).isFile()) throw new ConsoleError(400, '配置必须是普通 JSON 文件');
    return readFileSync(descriptor);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ELOOP')
      throw new ConsoleError(400, '配置不能使用软链接');
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

const labels: Readonly<Record<string, { title: string; description: string }>> = {
  orders: { title: '订单管理', description: '订单列表、搜索、选择与基础业务能力。' },
  reports: { title: '经营报表', description: '独立报表页面、数据适配与专属图表资源。' },
  'order-export': { title: '订单导出', description: '订单工具栏扩展、CSV 转换与独立 Worker。' },
};

/** Keep the saved pure-data manifest compatible with the repository's 100-column JSON format. */
export function enterpriseJson(profile: Enterprise): string {
  const selected = profile.enabledModules.map((id) => JSON.stringify(id));
  const inline = `  "enabledModules": [${selected.join(', ')}],`;
  const modules =
    inline.length <= 100
      ? inline
      : [
          '  "enabledModules": [',
          ...selected.map((id, index) => `    ${id}${index === selected.length - 1 ? '' : ','}`),
          '  ],',
        ].join('\n');
  return [
    '{',
    '  "schemaVersion": 1,',
    `  "enterpriseId": ${JSON.stringify(profile.enterpriseId)},`,
    modules,
    `  "brandingId": ${JSON.stringify(profile.brandingId)}`,
    '}',
    '',
  ].join('\n');
}

export function createProfileStore(root: string) {
  const directory = resolve(root, 'config/enterprises');
  function definition() {
    return {
      catalog: validateCatalog(readJson(resolve(root, 'config/module-catalog.json')), root).modules,
      brands: loadBrands(root),
    };
  }
  function validate(value: unknown): Enterprise {
    try {
      const rawId =
        value && typeof value === 'object' && 'enterpriseId' in value
          ? value.enterpriseId
          : undefined;
      const id = identifier(rawId, 'enterpriseId');
      const profile = parseEnterprise(value, id);
      const data = definition();
      selectModules(data.catalog, profile);
      if (!data.brands.some((item) => item.id === profile.brandingId))
        throw new Error('UNKNOWN_BRAND');
      return profile;
    } catch (error) {
      throw new ConsoleError(400, error instanceof Error ? error.message : '企业配置无效');
    }
  }
  function read(id: string): ProfileEntry | null {
    identifier(id, 'enterpriseId');
    const file = resolve(directory, `${id}.json`);
    let bytes: Buffer;
    try {
      bytes = readRegularFile(file);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
    const profile = validate(JSON.parse(bytes.toString('utf8')));
    if (profile.enterpriseId !== id) throw new ConsoleError(400, '企业标识与文件名不一致');
    return { profile, revision: sha256(bytes) };
  }
  function list(): ProfileEntry[] {
    regularDirectory(directory);
    return readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => {
        const entry = read(identifier(name.slice(0, -5), 'enterprise file'));
        if (!entry) throw new ConsoleError(409, '配置目录发生变化，请重新加载', 'conflict');
        return entry;
      });
  }
  function save(value: unknown, revision: unknown): ProfileEntry {
    const profile = validate(value);
    if (revision !== null && (typeof revision !== 'string' || !/^[a-f0-9]{64}$/u.test(revision)))
      throw new ConsoleError(400, '配置版本无效');
    regularDirectory(directory);
    const current = read(profile.enterpriseId);
    if ((current?.revision ?? null) !== revision)
      throw new ConsoleError(
        409,
        '配置已被其他页面或编辑器修改，请重新加载服务器配置后重试。',
        'conflict',
      );
    const temporary = resolve(directory, `.console-${randomUUID()}.tmp`);
    const target = resolve(directory, `${profile.enterpriseId}.json`);
    const bytes = Buffer.from(enterpriseJson(profile));
    try {
      writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
      regularDirectory(directory);
      if ((read(profile.enterpriseId)?.revision ?? null) !== revision)
        throw new ConsoleError(409, '配置发生并发修改，请重新加载后重试。', 'conflict');
      renameSync(temporary, target);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    return { profile, revision: sha256(bytes) };
  }
  function summaries(): { modules: ModuleSummary[]; brands: BrandSummary[] } {
    const data = definition();
    return {
      modules: data.catalog.map((item) => ({
        id: item.id,
        title: labels[item.id]?.title ?? item.id,
        description: labels[item.id]?.description ?? '已登记的业务模块。',
        requires: item.requires,
        conflicts: item.conflicts,
      })),
      brands: data.brands.map((item) => ({ id: item.id, name: item.name })),
    };
  }
  return { validate, read, list, save, summaries };
}
export type ProfileStore = ReturnType<typeof createProfileStore>;
