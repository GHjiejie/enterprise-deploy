import type { Enterprise } from '../policy/types';

export type ReleaseMode = 'staging' | 'production';
export const STAGES = ['validating', 'compiling', 'auditing', 'packaging', 'verifying'] as const;
export type BuildStage = (typeof STAGES)[number];
export const STAGE_LABELS: Readonly<Record<BuildStage, string>> = {
  validating: '配置与类型校验',
  compiling: '编译与模块裁剪',
  auditing: '来源与文件审计',
  packaging: '生成交付包',
  verifying: '封包复验',
};

export interface ModuleSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly requires: readonly string[];
  readonly conflicts: readonly string[];
}
export interface BrandSummary {
  readonly id: string;
  readonly name: string;
}
export interface ProfileEntry {
  readonly profile: Enterprise;
  readonly revision: string;
}
export interface BuildResult {
  readonly files: number;
  readonly enabledModules: readonly string[];
  readonly excludedModules: readonly string[];
  readonly siteHash: string;
  readonly packageHash: string;
  readonly packageName: string;
}
export interface BuildJob {
  readonly id: string;
  readonly profile: Enterprise;
  readonly revision: string;
  readonly mode: ReleaseMode;
  readonly configHash: string;
  readonly status: 'running' | 'succeeded' | 'failed';
  readonly stage: BuildStage;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly log: string;
  readonly error: string | null;
  readonly result: BuildResult | null;
}
export interface Bootstrap {
  readonly csrfToken: string;
  readonly modules: readonly ModuleSummary[];
  readonly brands: readonly BrandSummary[];
  readonly enterprises: readonly ProfileEntry[];
  readonly jobs: readonly BuildJob[];
  readonly activeJobId: string | null;
}
export interface StartedBuild {
  readonly entry: ProfileEntry;
  readonly job: BuildJob;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('控制台返回了无效数据');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('控制台返回了无效文本');
  return value;
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('控制台返回了无效列表');
  return value.map(parse);
}
function hash(value: unknown): string {
  const result = string(value);
  if (!/^[a-f0-9]{64}$/u.test(result)) throw new Error('控制台返回了无效摘要');
  return result;
}
export function parseProfile(value: unknown): Enterprise {
  const raw = object(value);
  if (raw.schemaVersion !== 1) throw new Error('企业配置版本无效');
  return {
    schemaVersion: 1,
    enterpriseId: string(raw.enterpriseId),
    enabledModules: array(raw.enabledModules, string),
    brandingId: string(raw.brandingId),
  };
}
export function parseEntry(value: unknown): ProfileEntry {
  const raw = object(value);
  return { profile: parseProfile(raw.profile), revision: hash(raw.revision) };
}
export function parseJob(value: unknown): BuildJob {
  const raw = object(value);
  if (raw.status !== 'running' && raw.status !== 'succeeded' && raw.status !== 'failed')
    throw new Error('任务状态无效');
  const stage = STAGES.find((item) => item === raw.stage);
  if (!stage) throw new Error('任务阶段无效');
  let result: BuildResult | null = null;
  if (raw.result !== null) {
    const data = object(raw.result);
    if (typeof data.files !== 'number' || !Number.isSafeInteger(data.files) || data.files < 1)
      throw new Error('产物文件数无效');
    result = {
      files: data.files,
      enabledModules: array(data.enabledModules, string),
      excludedModules: array(data.excludedModules, string),
      siteHash: hash(data.siteHash),
      packageHash: hash(data.packageHash),
      packageName: string(data.packageName),
    };
  }
  if ((raw.status === 'succeeded') !== (result !== null))
    throw new Error('任务状态与制品结果不一致');
  return {
    id: string(raw.id),
    profile: parseProfile(raw.profile),
    revision: hash(raw.revision),
    mode: releaseMode(raw.mode),
    configHash: hash(raw.configHash),
    status: raw.status,
    stage,
    startedAt: string(raw.startedAt),
    finishedAt: raw.finishedAt === null ? null : string(raw.finishedAt),
    log: string(raw.log),
    error: raw.error === null ? null : string(raw.error),
    result,
  };
}
export function releaseMode(value: unknown): ReleaseMode {
  if (value !== 'staging' && value !== 'production') throw new Error('请选择生产或预发布环境');
  return value;
}
export function parseBootstrap(value: unknown): Bootstrap {
  const raw = object(value);
  return {
    csrfToken: string(raw.csrfToken),
    modules: array(raw.modules, (item) => {
      const data = object(item);
      return {
        id: string(data.id),
        title: string(data.title),
        description: string(data.description),
        requires: array(data.requires, string),
        conflicts: array(data.conflicts, string),
      };
    }),
    brands: array(raw.brands, (item) => {
      const data = object(item);
      return { id: string(data.id), name: string(data.name) };
    }),
    enterprises: array(raw.enterprises, parseEntry),
    jobs: array(raw.jobs, parseJob),
    activeJobId: raw.activeJobId === null ? null : string(raw.activeJobId),
  };
}
export function parseStarted(value: unknown): StartedBuild {
  const raw = object(value);
  return { entry: parseEntry(raw.entry), job: parseJob(raw.job) };
}

export function draftErrors(
  profile: Enterprise,
  modules: readonly ModuleSummary[],
  brands: readonly BrandSummary[],
): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/u.test(profile.enterpriseId))
    errors.push('企业标识需为小写字母、数字和短横线，长度不超过 80 个字符。');
  if (!profile.enabledModules.length) errors.push('请至少启用一个模块。');
  if (!brands.some((brand) => brand.id === profile.brandingId))
    errors.push('请选择已登记的企业品牌。');
  for (const id of profile.enabledModules) {
    const module = modules.find((item) => item.id === id);
    if (!module) {
      errors.push(`未知模块：${id}`);
      continue;
    }
    for (const dependency of module.requires)
      if (!profile.enabledModules.includes(dependency))
        errors.push(
          `${module.title} 需要启用 ${modules.find((item) => item.id === dependency)?.title ?? dependency}。`,
        );
    for (const conflict of module.conflicts)
      if (profile.enabledModules.includes(conflict))
        errors.push(
          `${module.title} 与 ${modules.find((item) => item.id === conflict)?.title ?? conflict} 不能同时启用。`,
        );
  }
  return [...new Set(errors)];
}
