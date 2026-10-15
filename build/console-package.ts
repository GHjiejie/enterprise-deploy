import {
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { assertRegularDirectory } from './console-store.ts';
import { RELEASE_RECORD_FILE, sha256, type ReleaseRecordV2 } from './release-record.ts';

const BLOCK_BYTES = 512;
export const PACKAGE_LIMITS = {
  compressedBytes: 64 * 1024 * 1024,
  expandedBytes: 128 * 1024 * 1024,
  fileBytes: 32 * 1024 * 1024,
  entries: 4096,
} as const;

interface PackageEntry {
  readonly path: string;
  readonly directory: boolean;
  readonly bytes: Buffer;
}

/** Read a bounded regular file through the same descriptor that was checked. */
export function readConsoleFile(path: string, limit: number): Buffer {
  assertRegularDirectory(dirname(path));
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > limit) throw new Error('制品文件类型或大小不符合限制');
    const bytes = readFileSync(descriptor);
    if (bytes.length !== stat.size || bytes.length > limit) throw new Error('制品文件读取期间变化');
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function archivePath(value: string, directory: boolean): string {
  if (directory && (value === './' || value === '.')) return '';
  const path = value.startsWith('./') ? value.slice(2) : value;
  const normalized = directory && path.endsWith('/') ? path.slice(0, -1) : path;
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z]:/iu.test(normalized) ||
    normalized.includes('\\') ||
    normalized.split('/').some((part) => !part || part === '.' || part === '..') ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(`压缩包包含不安全路径：${value}`);
  }
  return normalized;
}

function stringField(header: Buffer, start: number, length: number): string {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  if (end !== -1 && field.subarray(end).some((byte) => byte !== 0)) {
    throw new Error('压缩包字段包含 NUL 后缀数据');
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(
    end === -1 ? field : field.subarray(0, end),
  );
}

function numberField(header: Buffer, start: number, length: number): number {
  const value = header
    .subarray(start, start + length)
    .toString('latin1')
    .replace(/[\0 ]+$/gu, '')
    .trimStart();
  if (!/^[0-7]+$/u.test(value)) throw new Error('压缩包数值字段必须为标准八进制');
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed)) throw new Error('压缩包数值字段超出限制');
  return parsed;
}

function checksum(header: Buffer): number {
  return header.reduce(
    (total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte),
    0,
  );
}

/** Validate the entire tar inventory before creating any extracted entry. */
function parsePackage(bytes: Buffer): readonly PackageEntry[] {
  if (bytes.length > PACKAGE_LIMITS.compressedBytes) throw new Error('压缩包超过大小限制');
  const tar = gunzipSync(bytes, { maxOutputLength: PACKAGE_LIMITS.expandedBytes });
  if (tar.length % BLOCK_BYTES !== 0) throw new Error('压缩包块长度无效');
  const entries: PackageEntry[] = [];
  const paths = new Map<string, boolean>();
  let position = 0;
  let ended = false;
  while (position < tar.length) {
    const header = tar.subarray(position, position + BLOCK_BYTES);
    if (header.every((byte) => byte === 0)) {
      if (
        tar.length - position < BLOCK_BYTES * 2 ||
        tar.subarray(position).some((byte) => byte !== 0)
      )
        throw new Error('压缩包结束标记无效或包含追加数据');
      ended = true;
      break;
    }
    if (checksum(header) !== numberField(header, 148, 8)) throw new Error('压缩包头部校验失败');
    if (stringField(header, 257, 6) !== 'ustar' || stringField(header, 263, 2) !== '00') {
      throw new Error('压缩包必须使用受支持的 ustar 格式');
    }
    const type = header[156];
    if (type !== 0 && type !== 48 && type !== 53) {
      throw new Error('压缩包禁止符号链接、硬链接、扩展头和特殊文件');
    }
    if (stringField(header, 157, 100)) throw new Error('压缩包禁止链接目标');
    const directory = type === 53;
    const prefix = stringField(header, 345, 155);
    const name = stringField(header, 0, 100);
    const path = archivePath(prefix ? `${prefix}/${name}` : name, directory);
    if (paths.has(path)) throw new Error(`压缩包包含重复路径：${path}`);
    paths.set(path, directory);
    if (paths.size > PACKAGE_LIMITS.entries) throw new Error('压缩包条目数量超过限制');
    const size = numberField(header, 124, 12);
    if (size > PACKAGE_LIMITS.fileBytes || (directory && size !== 0)) {
      throw new Error('压缩包条目大小无效或超过限制');
    }
    const start = position + BLOCK_BYTES;
    const end = start + size;
    const next = start + Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES;
    if (next > tar.length) throw new Error('压缩包条目被截断');
    if (tar.subarray(end, next).some((byte) => byte !== 0)) throw new Error('压缩包填充数据无效');
    entries.push({ path, directory, bytes: tar.subarray(start, end) });
    position = next;
  }
  if (!ended || !paths.has(RELEASE_RECORD_FILE) || paths.get(RELEASE_RECORD_FILE)) {
    throw new Error('压缩包缺少完整结束标记或发布记录');
  }
  for (const entry of entries) {
    const parents = entry.path.split('/').slice(0, -1);
    for (let depth = 1; depth <= parents.length; depth++) {
      const parent = parents.slice(0, depth).join('/');
      if (paths.get(parent) === false) throw new Error(`压缩包文件与目录冲突：${parent}`);
    }
  }
  return entries;
}

function putString(header: Buffer, start: number, length: number, value: string): void {
  const bytes = Buffer.from(value);
  if (bytes.length > length) throw new Error('制品路径超过 ustar 格式限制');
  bytes.copy(header, start);
}

function putNumber(header: Buffer, start: number, length: number, value: number): void {
  const digits = value.toString(8);
  if (digits.length >= length) throw new Error('制品数值超过 ustar 格式限制');
  putString(header, start, length, `${digits.padStart(length - 1, '0')}\0`);
}

function encodeEntry(path: string, bytes: Buffer, directory: boolean): Buffer {
  const name = `./${path}${directory ? '/' : ''}`;
  archivePath(name, directory);
  const header = Buffer.alloc(BLOCK_BYTES);
  if (Buffer.byteLength(name) <= 100) putString(header, 0, 100, name);
  else {
    const split = name.lastIndexOf('/', name.length - (directory ? 2 : 1));
    if (split < 0) throw new Error('制品路径超过 ustar 格式限制');
    putString(header, 0, 100, name.slice(split + 1));
    putString(header, 345, 155, name.slice(0, split));
  }
  putNumber(header, 100, 8, directory ? 0o755 : 0o644);
  putNumber(header, 108, 8, 0);
  putNumber(header, 116, 8, 0);
  putNumber(header, 124, 12, bytes.length);
  putNumber(header, 136, 12, 0);
  header[156] = directory ? 53 : 48;
  putString(header, 257, 6, 'ustar\0');
  putString(header, 263, 2, '00');
  putString(header, 148, 8, `${checksum(header).toString(8).padStart(6, '0')}\0 `);
  return Buffer.concat([
    header,
    bytes,
    Buffer.alloc((BLOCK_BYTES - (bytes.length % BLOCK_BYTES)) % BLOCK_BYTES),
  ]);
}

export function writeConsolePackage(
  siteDirectory: string,
  packagePath: string,
  record: ReleaseRecordV2,
): void {
  assertRegularDirectory(siteDirectory);
  if (record.directories.length + record.artifacts.length + 1 > PACKAGE_LIMITS.entries) {
    throw new Error('制品条目数量超过限制');
  }
  const paddedSize = (bytes: number) => BLOCK_BYTES + Math.ceil(bytes / BLOCK_BYTES) * BLOCK_BYTES;
  let expectedBytes = record.directories.length * BLOCK_BYTES + BLOCK_BYTES * 2;
  for (const file of record.artifacts) {
    if (
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > PACKAGE_LIMITS.fileBytes
    ) {
      throw new Error('制品文件大小超过限制');
    }
    expectedBytes += paddedSize(file.bytes);
    if (expectedBytes > PACKAGE_LIMITS.expandedBytes) throw new Error('制品解包大小超过限制');
  }
  // Size/count preflight happens before reading any business file or allocating tar entries.
  const releaseBytes = readConsoleFile(
    join(siteDirectory, RELEASE_RECORD_FILE),
    PACKAGE_LIMITS.fileBytes,
  );
  expectedBytes += paddedSize(releaseBytes.length);
  if (expectedBytes > PACKAGE_LIMITS.expandedBytes) throw new Error('制品解包大小超过限制');
  const chunks: Buffer[] = [];
  let actualBytes =
    record.directories.length * BLOCK_BYTES + BLOCK_BYTES * 2 + paddedSize(releaseBytes.length);
  for (const path of record.directories) chunks.push(encodeEntry(path, Buffer.alloc(0), true));
  for (const file of record.artifacts) {
    const bytes = readConsoleFile(join(siteDirectory, file.path), PACKAGE_LIMITS.fileBytes);
    actualBytes += paddedSize(bytes.length);
    if (actualBytes > PACKAGE_LIMITS.expandedBytes) throw new Error('制品解包大小超过限制');
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256)
      throw new Error('制品打包期间文件发生变化');
    chunks.push(encodeEntry(file.path, bytes, false));
  }
  chunks.push(encodeEntry(RELEASE_RECORD_FILE, releaseBytes, false));
  chunks.push(Buffer.alloc(BLOCK_BYTES * 2));
  const expandedBytes = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (expandedBytes > PACKAGE_LIMITS.expandedBytes) throw new Error('制品解包大小超过限制');
  const packageBytes = gzipSync(Buffer.concat(chunks));
  // Apply exactly the reader's format and inventory restrictions to our writer too.
  parsePackage(packageBytes);
  writeFileSync(packagePath, packageBytes, { flag: 'wx', mode: 0o600 });
}

/** Safe extraction is temporary and happens only after complete inventory validation. */
export function verifyConsolePackage(
  packagePath: string,
  verify: (directory: string) => void,
): Buffer {
  const bytes = readConsoleFile(packagePath, PACKAGE_LIMITS.compressedBytes);
  const entries = parsePackage(bytes);
  const directory = mkdtempSync(join(realpathSync(tmpdir()), 'enterprise-console-package-'));
  try {
    for (const entry of entries) {
      if (!entry.path) continue;
      const target = join(directory, entry.path);
      if (entry.directory) mkdirSync(target, { recursive: true });
      else {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, entry.bytes, { flag: 'wx', mode: 0o600 });
      }
    }
    verify(directory);
    return bytes;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
