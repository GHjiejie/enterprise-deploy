import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync, lstatSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
export const POLICY_VERSION = '1.0.0';
export const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function identifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/u.test(value))
    throw new Error(`INVALID_IDENTIFIER: ${label}`);
  return value;
}

export function within(root: string, file: string): boolean {
  const part = relative(root, file);
  return part === '' || (!part.startsWith(`..`) && !isAbsolute(part));
}

export function trustedPath(root: string, name: string): string {
  if (isAbsolute(name) || name.includes('\\') || name.split('/').includes('..'))
    throw new Error(`UNTRUSTED_PATH: ${name}`);
  const result = realpathSync(resolve(root, name));
  if (!within(root, result)) throw new Error(`PATH_ESCAPE: ${name}`);
  return result;
}

export const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`INVALID_OBJECT: ${label}`);
  return value as Record<string, unknown>;
}

export function keys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (Object.keys(value).sort().join(',') !== [...expected].sort().join(','))
    throw new Error(`INVALID_FIELDS: ${label}`);
}

export function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new Error(`INVALID_STRING_LIST: ${label}`);
  const result: string[] = value;
  if (new Set(result).size !== result.length) throw new Error(`DUPLICATE_ID: ${label}`);
  return result;
}

export function filesIn(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const file = resolve(directory, entry);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`SYMLINK_OUTPUT: ${file}`);
    if (stat.isDirectory()) result.push(...filesIn(file));
    else if (stat.isFile()) result.push(file);
    else throw new Error(`SPECIAL_OUTPUT: ${file}`);
  }
  return result;
}

export function policyCodeHash(root: string): string {
  const paths = [...filesIn(resolve(root, 'build')), resolve(root, 'vite.config.ts')];
  return sha256(canonical(paths.map((file) => [relative(root, file), sha256(readFileSync(file))])));
}

export function args(allowed: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  const input = process.argv.slice(2);
  for (let index = 0; index < input.length; index += 2) {
    const name = input[index]?.replace(/^--/u, '');
    const value = input[index + 1];
    if (
      !name ||
      !input[index]?.startsWith('--') ||
      !allowed.includes(name) ||
      !value ||
      values[name]
    )
      throw new Error(`INVALID_ARGUMENTS: --${allowed.join(' --')}`);
    values[name] = value;
  }
  return values;
}

export function isMain(url: string): boolean {
  return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);
}

export async function cli(run: () => unknown | Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
