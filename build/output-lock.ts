import {
  constants,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { EnterpriseTarget } from './enterprise-config.ts';

function directoryIfPresent(path: string): void {
  try {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(`Build output directory must be regular: ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export function acquireOutputLock(context: EnterpriseTarget): () => void {
  // Check every managed ancestor before Vite can empty/write an output directory.
  for (const path of [
    join(context.rootDir, 'dist'),
    join(context.rootDir, 'dist', context.profileId),
    context.outDir,
    join(context.rootDir, 'dist/.locks'),
  ])
    directoryIfPresent(path);
  const directory = join(context.rootDir, 'dist/.locks');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${context.profileId}-${context.mode}.lock`);
  let fd: number;
  try {
    fd = openSync(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    throw new Error(`该企业/环境已有构建或遗留输出锁：${path}`, { cause: error });
  }
  const bytes = JSON.stringify({ pid: process.pid, buildId: context.buildId });
  try {
    writeFileSync(fd, bytes);
  } catch (error) {
    closeSync(fd);
    throw error;
  }
  return () => {
    closeSync(fd);
    try {
      const stat = lstatSync(path);
      if (stat.isFile() && !stat.isSymbolicLink() && readFileSync(path, 'utf8') === bytes)
        unlinkSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
}

export function invalidateReleaseRecord(outDir: string): void {
  const path = join(outDir, 'release-record.json');
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error('Old release record must be a regular file');
    unlinkSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
