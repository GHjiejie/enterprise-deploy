import {
  cpSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from '../../build/utils';

export function fixture(): { root: string; dispose: () => void } {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'enterprise-modular-')));
  for (const name of [
    'src',
    'config',
    'build',
    'build-console',
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
  ])
    cpSync(resolve(PROJECT_ROOT, name), resolve(root, name), { recursive: true });
  symlinkSync(resolve(PROJECT_ROOT, 'node_modules'), resolve(root, 'node_modules'), 'dir');
  return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

export function append(root: string, path: string, code: string): void {
  const file = resolve(root, path);
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n${code}\n`);
}

export function changeJson(
  root: string,
  path: string,
  edit: (value: Record<string, unknown>) => void,
): void {
  const file = resolve(root, path);
  const value = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  edit(value);
  writeFileSync(file, JSON.stringify(value, null, 2));
}
