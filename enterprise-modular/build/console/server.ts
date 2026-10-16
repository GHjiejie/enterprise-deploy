import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { createServer as createViteServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { buildPaths } from '../audit/record.ts';
import { staticServer } from '../preview.ts';
import { cli, isMain, keys, PROJECT_ROOT, record } from '../utils.ts';
import type { Bootstrap } from './contracts.ts';
import { createJobManager } from './jobs.ts';
import { ConsoleError, createProfileStore } from './store.ts';

function json(response: ServerResponse, status: number, value: unknown): void {
  response
    .writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers['content-type'] ?? ''))
    throw new ConsoleError(415, '请使用 JSON 提交配置');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > 65536) throw new ConsoleError(413, '配置请求过大');
    chunks.push(bytes);
  }
  try {
    return record(JSON.parse(Buffer.concat(chunks).toString('utf8')), 'request');
  } catch {
    throw new ConsoleError(400, '请求必须是有效的 JSON 对象');
  }
}

export async function createBuildConsole(
  options: { readonly root?: string; readonly port?: number } = {},
) {
  const root = realpathSync(options.root ?? PROJECT_ROOT);
  const port = options.port ?? Number(process.env.CONSOLE_PORT ?? '5193');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('CONSOLE_PORT 无效');
  const store = createProfileStore(root);
  const jobs = createJobManager(root, store);
  const token = randomBytes(32).toString('hex');
  const cacheDir = resolve(root, '.console/vite-cache', randomBytes(8).toString('hex'));
  const previews = new Map<string, Promise<{ server: Server; origin: string }>>();
  let origin = '';
  let vite: ViteDevServer | undefined;
  const server = createServer((request, response) => {
    void (async () => {
      const expected = new URL(origin);
      if (
        request.headers.host !== expected.host ||
        (request.headers.origin !== undefined && request.headers.origin !== origin)
      )
        throw new ConsoleError(403, '仅接受本机同源请求', 'forbidden');
      const url = new URL(request.url ?? '/', origin);
      if (url.origin !== origin) throw new ConsoleError(403, '请求地址无效', 'forbidden');
      if (url.pathname.startsWith('/api/')) {
        if (request.headers['sec-fetch-site'] === 'cross-site')
          throw new ConsoleError(403, '不接受跨站请求', 'forbidden');
        const method = request.method;
        if (method === 'PUT' || method === 'POST') {
          if (request.headers.origin !== origin || request.headers['x-console-token'] !== token)
            throw new ConsoleError(403, '本地会话已失效，请刷新控制台', 'forbidden');
        }
        if (url.pathname === '/api/bootstrap' && method === 'GET') {
          const summaries = store.summaries();
          const data: Bootstrap = {
            csrfToken: token,
            ...summaries,
            enterprises: store.list(),
            jobs: jobs.list(),
            activeJobId: jobs.activeId(),
          };
          json(response, 200, data);
          return;
        }
        if (url.pathname === '/api/enterprises' && method === 'PUT') {
          const data = await body(request);
          keys(data, ['profile', 'expectedRevision'], 'save');
          json(response, 200, jobs.save(data.profile, data.expectedRevision));
          return;
        }
        if (url.pathname === '/api/builds' && method === 'POST') {
          const data = await body(request);
          keys(data, ['profile', 'expectedRevision', 'mode'], 'build');
          json(response, 202, jobs.start(data.profile, data.expectedRevision, data.mode));
          return;
        }
        const match = /^\/api\/builds\/([a-z0-9-]+)(?:\/(package|report|preview))?$/u.exec(
          url.pathname,
        );
        const id = match?.[1];
        if (id && method === 'GET') {
          const job = jobs.get(id);
          if (!job) throw new ConsoleError(404, '任务不存在', 'not_found');
          if (!match[2]) {
            json(response, 200, job);
            return;
          }
          const artifact = jobs.verified(id);
          if (match[2] === 'preview') {
            let pending = previews.get(id);
            if (!pending) {
              pending = (async () => {
                const previewServer = staticServer(artifact.audit, artifact.site);
                try {
                  await new Promise<void>((done, reject) => {
                    previewServer.once('error', reject);
                    previewServer.listen(0, '127.0.0.1', done);
                  });
                  const address = previewServer.address();
                  if (!address || typeof address === 'string') throw new Error('预览端口无效');
                  return { server: previewServer, origin: `http://127.0.0.1:${address.port}` };
                } catch (error) {
                  previewServer.close();
                  throw error;
                }
              })();
              previews.set(id, pending);
            }
            const preview = await pending.catch((error: unknown) => {
              if (previews.get(id) === pending) previews.delete(id);
              throw error;
            });
            response
              .writeHead(302, { Location: `${preview.origin}/`, 'Cache-Control': 'no-store' })
              .end();
            return;
          }
          const report = match[2] === 'report';
          const bytes = report
            ? readFileSync(
                resolve(
                  buildPaths(artifact.project, job.profile.enterpriseId, id).audit,
                  'audit.json',
                ),
              )
            : artifact.archiveBytes;
          response
            .writeHead(200, {
              'Content-Type': report ? 'application/json; charset=utf-8' : 'application/gzip',
              'Content-Disposition': `attachment; filename="${report ? `${job.profile.enterpriseId}-${id}-audit.json` : job.result?.packageName}"`,
              'Content-Length': bytes.byteLength,
              'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff',
            })
            .end(bytes);
          return;
        }
        throw new ConsoleError(404, '接口不存在或请求方法不支持', 'not_found');
      }
      if (!vite) throw new ConsoleError(503, '控制台正在启动');
      vite.middlewares(request, response, () => response.writeHead(404).end());
    })().catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = error instanceof ConsoleError ? error.status : 400;
      json(response, status, {
        error: {
          code: error instanceof ConsoleError ? error.code : 'invalid_request',
          message: error instanceof Error ? error.message : '控制台处理失败',
        },
      });
    });
  });
  try {
    vite = await createViteServer({
      configFile: false,
      root: resolve(root, 'build-console'),
      envDir: false,
      envPrefix: [],
      publicDir: false,
      plugins: [vue()],
      appType: 'spa',
      cacheDir,
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server },
        forwardConsole: false,
        cors: false,
        fs: {
          strict: true,
          allow: [
            resolve(root, 'build-console'),
            resolve(root, 'build/console/contracts.ts'),
            realpathSync(resolve(root, 'node_modules')),
            cacheDir,
          ],
        },
      },
    });
    await new Promise<void>((done, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', done);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('控制台端口无效');
    origin = `http://127.0.0.1:${address.port}`;
  } catch (error) {
    await jobs.close();
    await vite?.close();
    throw error;
  }
  let closed = false;
  return {
    origin,
    jobs,
    async close() {
      if (closed) return;
      closed = true;
      await jobs.close();
      for (const pending of previews.values()) {
        const preview = await pending.catch(() => undefined);
        if (!preview) continue;
        preview.server.closeAllConnections();
        await new Promise<void>((done) => preview.server.close(() => done()));
      }
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

if (isMain(import.meta.url))
  await cli(async () => {
    const app = await createBuildConsole();
    console.log(
      `\n可视化企业打包：${app.origin}/\n选择企业与模块后点击「保存并打包」。Ctrl+C 停止服务。`,
    );
    const stop = (): void => {
      void app.close().then(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
