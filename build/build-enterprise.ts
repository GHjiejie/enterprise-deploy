import { existsSync, lstatSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build, type Plugin } from 'vite';
import { parseBuildMode, type BuildProfile } from '../shared/build-profile.ts';
import {
  createEnterpriseConfig,
  createEnterpriseContext,
  prepareEnterpriseTarget,
} from './enterprise-config.ts';
import { acquireOutputLock, invalidateReleaseRecord } from './output-lock.ts';
import type { PruningCollector } from './pruning-plugin.ts';
import { verifyPruningArtifact, writePruningReport } from './pruning.ts';
import { RELEASE_RECORD_FILE, writeReleaseRecord, type ReleaseRecord } from './release-record.ts';

export async function runEnterpriseBuild(
  modeValue: unknown,
  options: {
    rootDir?: string;
    profile?: BuildProfile;
    buildId?: string;
    plugins?: Plugin[];
    quiet?: boolean;
    preflight?: boolean;
  } = {},
): Promise<ReleaseRecord> {
  const stage = (value: string) => {
    if (!options.quiet) process.stdout.write(`[build-stage] ${value}\n`);
  };
  stage('validating');
  const target = prepareEnterpriseTarget(modeValue, options);
  const releaseLock = acquireOutputLock(target);
  const recordPath = join(target.outDir, RELEASE_RECORD_FILE);
  try {
    invalidateReleaseRecord(target.outDir);
    if (options.preflight)
      execFileSync('npm', ['run', 'typecheck'], { cwd: target.rootDir, stdio: 'inherit' });
    const context = createEnterpriseContext(target, options.profile);
    const collector: PruningCollector = {};
    const config = createEnterpriseConfig(context, 'build', collector);
    if (options.plugins) config.plugins = [...(config.plugins ?? []), ...options.plugins];
    stage('compiling');
    await build({
      ...config,
      configFile: false,
      ...(options.quiet ? { logLevel: 'silent' as const } : {}),
    });
    stage('pruning');
    if (!collector.evidence) throw new Error('Build did not produce physical pruning evidence');
    const pruning = writePruningReport(
      context.outDir,
      { profile: context.profile, environment: context.mode, buildId: context.buildId },
      collector.evidence,
    );
    const record = writeReleaseRecord({
      outDir: context.outDir,
      rootDir: context.rootDir,
      profile: context.profile,
      mode: context.mode,
      buildId: context.buildId,
      backendCompatibility: context.compatibility,
      pruning,
      buildCommand: `APP_PROFILE=${context.profile.id} npm run build -- --mode ${context.mode}`,
    });
    verifyPruningArtifact(context.outDir, record);
    return record;
  } catch (error) {
    if (
      existsSync(recordPath) &&
      lstatSync(recordPath).isFile() &&
      !lstatSync(recordPath).isSymbolicLink()
    )
      unlinkSync(recordPath);
    throw error;
  } finally {
    releaseLock();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--mode'))
    throw new Error('Usage: npm run build -- --mode staging|production|development');
  await runEnterpriseBuild(parseBuildMode(args[1] ?? 'production'), { preflight: true });
}
