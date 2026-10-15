import { createReadStream, lstatSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ConsoleApiError, ConsoleBootstrap } from '../shared/build-console.ts';
import { getEntryRoute, moduleRegistry } from '../src/app/module-registry.ts';
import type { ConsoleJobManager } from './console-jobs.ts';
import { ConsoleError, type ConsoleProfileStore, validateConsoleProfile } from './console-store.ts';

const MAX_BODY_BYTES = 1024 * 1024;

export interface ConsoleApiDependencies {
  readonly origin: string;
  readonly store: ConsoleProfileStore;
  readonly jobs: ConsoleJobManager;
}

/** The console is a local, same-origin tool; it never grants wildcard CORS access. */
export function assertConsoleRequestOrigin(request: IncomingMessage, expectedOrigin: string): void {
  const origin = new URL(expectedOrigin);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
    origin.protocol !== 'http:'
  ) {
    throw new ConsoleError(500, '构建控制台必须使用本机 HTTP 地址');
  }
  if (request.headers.host !== origin.host) {
    throw new ConsoleError(403, '请求 Host 与构建控制台地址不一致');
  }
  if (request.headers.origin !== undefined && request.headers.origin !== origin.origin) {
    throw new ConsoleError(403, '构建控制台仅接受同源请求');
  }
  if (request.headers['sec-fetch-site'] === 'cross-site') {
    throw new ConsoleError(403, '构建控制台不接受跨站请求');
  }
  const requested = new URL(request.url ?? '/', origin);
  if (requested.origin !== origin.origin) {
    throw new ConsoleError(403, '请求地址与构建控制台地址不一致');
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers['content-type'] ?? '')
  ) {
    request.resume();
    throw new ConsoleError(415, '请使用 application/json 提交配置');
  }
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_BODY_BYTES) {
    request.resume();
    throw new ConsoleError(413, '请求内容不能超过 1 MiB');
  }
  const bytes = await new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    request.on('data', (chunk: Buffer | string) => {
      if (exceeded) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BODY_BYTES) {
        exceeded = true;
        chunks.length = 0;
        reject(new ConsoleError(413, '请求内容不能超过 1 MiB'));
      } else chunks.push(bytes);
    });
    request.once('end', () => {
      if (!exceeded) resolveBody(Buffer.concat(chunks));
    });
    request.once('error', reject);
    request.once('aborted', () => reject(new ConsoleError(400, '请求已中断')));
  });
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ConsoleError(400, '请求内容不是有效 JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConsoleError(400, '请求内容必须是 JSON 对象');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new ConsoleError(400, '请求字段不完整或包含未知字段');
  }
}

function decodePathId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ConsoleError(400, '地址中的标识无效');
  }
}

function errorCode(status: number): string {
  return (
    {
      400: 'invalid_request',
      403: 'forbidden',
      404: 'not_found',
      405: 'method_not_allowed',
      409: 'conflict',
      413: 'payload_too_large',
      415: 'unsupported_media_type',
      503: 'unavailable',
    }[status] ?? 'internal_error'
  );
}

export async function handleConsoleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ConsoleApiDependencies,
): Promise<boolean> {
  const path = new URL(request.url ?? '/', dependencies.origin).pathname;
  if (path !== '/api' && !path.startsWith('/api/')) return false;
  try {
    assertConsoleRequestOrigin(request, dependencies.origin);
    if (path === '/api/bootstrap') {
      if (request.method !== 'GET') throw new ConsoleError(405, '此接口仅支持 GET');
      const bootstrap: ConsoleBootstrap = {
        modules: moduleRegistry.map((module) => ({
          id: module.id,
          label: module.navigation?.label ?? module.id,
          entryPath: getEntryRoute(module)?.path ?? '',
          dependsOn: module.dependsOn,
        })),
        profiles: dependencies.store.list(),
        activeJob: dependencies.jobs.active(),
      };
      sendJson(response, 200, bootstrap);
      return true;
    }
    const profileMatch = /^\/api\/profiles\/([^/]+)$/u.exec(path);
    if (profileMatch) {
      if (request.method !== 'PUT') throw new ConsoleError(405, '此接口仅支持 PUT');
      const body = await readJson(request);
      exactKeys(body, ['profile', 'expectedRevision']);
      dependencies.jobs.assertIdle();
      const profile = validateConsoleProfile(body.profile);
      if (profile.id !== decodePathId(profileMatch[1]!)) {
        throw new ConsoleError(400, '地址中的企业标识与配置不一致');
      }
      sendJson(response, 200, dependencies.jobs.save(profile, body.expectedRevision));
      return true;
    }
    if (path === '/api/builds') {
      if (request.method !== 'POST') throw new ConsoleError(405, '此接口仅支持 POST');
      const body = await readJson(request);
      exactKeys(body, ['profile', 'expectedRevision', 'mode']);
      sendJson(
        response,
        202,
        dependencies.jobs.start(body.profile, body.expectedRevision, body.mode),
      );
      return true;
    }
    const buildMatch = /^\/api\/builds\/([^/]+)(?:\/(package))?$/u.exec(path);
    if (buildMatch) {
      if (request.method !== 'GET') throw new ConsoleError(405, '此接口仅支持 GET');
      const id = decodePathId(buildMatch[1]!);
      const job = dependencies.jobs.get(id);
      if (!job) throw new ConsoleError(404, '构建任务不存在');
      if (!buildMatch[2]) {
        sendJson(response, 200, job);
        return true;
      }
      const artifact = dependencies.jobs.getArtifact(id);
      if (!artifact || !job.result) throw new ConsoleError(409, '此任务尚无可下载制品');
      const stat = lstatSync(artifact.packagePath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new ConsoleError(500, '制品文件无效');
      response.writeHead(200, {
        'Content-Type': 'application/gzip',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${job.result.packageName}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      const stream = createReadStream(artifact.packagePath);
      stream.once('error', () => response.destroy());
      stream.pipe(response);
      return true;
    }
    throw new ConsoleError(404, '接口不存在');
  } catch (error) {
    const status = error instanceof ConsoleError ? error.status : 500;
    const result: ConsoleApiError = {
      error: {
        code: error instanceof ConsoleError ? (error.code ?? errorCode(status)) : errorCode(status),
        message: error instanceof Error ? error.message : '构建控制台发生错误，请查看终端日志',
      },
    };
    sendJson(response, status, result);
    return true;
  }
}
