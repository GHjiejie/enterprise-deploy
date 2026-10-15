import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import type { UserConfig } from 'vite';
import { parseBuildMode, type BuildMode, type BuildProfile } from '../shared/build-profile.ts';
import { loadBuildProfile, parseBuildProfile } from './load-profile.ts';
import { activeModulesPlugin } from './active-modules-plugin.ts';
import { pruningPlugin, type PruningCollector } from './pruning-plugin.ts';
import {
  parseBackendCompatibility,
  safeIdentifier,
  type BackendCompatibility,
} from './release-record.ts';
import { validateProfiles } from './validate-profiles.ts';

export const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
export interface EnterpriseTarget {
  rootDir: string;
  outDir: string;
  profileId: string;
  mode: BuildMode;
  buildId: string;
}
export interface EnterpriseContext extends EnterpriseTarget {
  profile: BuildProfile;
  compatibility: BackendCompatibility;
}
export function prepareEnterpriseTarget(
  modeValue: unknown,
  options: { rootDir?: string; profile?: BuildProfile; buildId?: string } = {},
): EnterpriseTarget {
  const rootDir = realpathSync(resolve(options.rootDir ?? PROJECT_ROOT));
  const mode = parseBuildMode(modeValue);
  const profileId = options.profile?.id ?? process.env.APP_PROFILE;
  if (typeof profileId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(profileId))
    throw new Error('必须显式指定合法的 APP_PROFILE');
  const buildId =
    options.buildId ??
    process.env.APP_BUILD_ID ??
    (process.env.GITHUB_RUN_ID
      ? `github-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}-${profileId}-${mode}`
      : randomUUID());
  safeIdentifier(buildId, 'buildId');
  return { rootDir, outDir: resolve(rootDir, 'dist', profileId, mode), profileId, mode, buildId };
}
export function createEnterpriseContext(
  target: EnterpriseTarget,
  profileValue?: BuildProfile,
): EnterpriseContext {
  const { rootDir, profileId } = target;
  const profile = profileValue
    ? parseBuildProfile(profileValue, profileId)
    : loadBuildProfile(profileId);
  if (!profileValue) validateProfiles();
  const compatibility = parseBackendCompatibility(
    JSON.parse(readFileSync(resolve(rootDir, 'config/backend-compatibility.json'), 'utf8')),
  );
  return { ...target, profile, compatibility };
}

export function createEnterpriseConfig(
  context: EnterpriseContext,
  command: 'serve' | 'build',
  collector: PruningCollector = {},
): UserConfig {
  const { rootDir, profile, mode, outDir } = context;
  if (command === 'build' && mode !== 'development')
    for (const name of ['.env.local', `.env.${mode}.local`])
      if (existsSync(resolve(rootDir, name)))
        throw new Error(`发布构建不允许本地覆盖文件 ${name}；请使用隔离工作目录。`);
  const application = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as {
    version: string;
  };
  return {
    root: rootDir,
    mode,
    plugins: [react(), activeModulesPlugin(profile), pruningPlugin(rootDir, profile, collector)],
    define: {
      __BUILD_PROFILE__: JSON.stringify(profile),
      __APP_VERSION__: JSON.stringify(application.version),
      __BUILD_MODE__: JSON.stringify(mode),
    },
    publicDir: false,
    build: { outDir, emptyOutDir: true, sourcemap: false },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
}
