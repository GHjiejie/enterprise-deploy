import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { assertConsoleRequestOrigin, handleConsoleRequest } from './console-api.ts';
import { createConsoleJobManager } from './console-jobs.ts';
import { createConsolePreview, type ConsolePreview } from './console-preview.ts';
import { ConsoleError, createConsoleProfileStore } from './console-store.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export interface BuildConsoleOptions {
  readonly rootDir?: string;
  readonly profilesDir?: string;
  readonly port?: number;
}

export interface BuildConsoleServer {
  readonly server: Server;
  readonly origin: string;
  close(): Promise<void>;
}

export async function createBuildConsole(
  options: BuildConsoleOptions = {},
): Promise<BuildConsoleServer> {
  const rootDir = resolve(options.rootDir ?? projectRoot);
  const port = options.port ?? Number(process.env.CONSOLE_PORT ?? 5180);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('CONSOLE_PORT 必须是有效端口');
  const store = createConsoleProfileStore(
    rootDir,
    options.profilesDir ?? process.env.APP_PROFILES_DIR,
  );
  const jobs = createConsoleJobManager({ rootDir, store });
  const previews = new Map<string, Promise<ConsolePreview>>();
  let vite: ViteDevServer | null = null;
  let origin = '';

  const server = createServer((request, response) => {
    void (async () => {
      assertConsoleRequestOrigin(request, origin);
      const pathname = new URL(request.url ?? '/', origin).pathname;
      const previewMatch = /^\/api\/builds\/([a-f0-9-]+)\/preview$/u.exec(pathname);
      if (previewMatch) {
        if (request.method !== 'GET') throw new ConsoleError(405, '预览入口仅支持 GET');
        const jobId = previewMatch[1]!;
        const artifact = jobs.getArtifact(jobId);
        if (!artifact) throw new ConsoleError(409, '此构建任务尚无可预览产物');
        let pending = previews.get(jobId);
        if (!pending) {
          pending = createConsolePreview(artifact.siteDirectory);
          previews.set(jobId, pending);
          void pending.catch(() => previews.delete(jobId));
        }
        const preview = await pending;
        response
          .writeHead(302, { Location: `${preview.origin}/`, 'Cache-Control': 'no-store' })
          .end();
        return;
      }
      if (await handleConsoleRequest(request, response, { origin, store, jobs })) return;
      if (!vite) throw new ConsoleError(503, '构建控制台正在启动');
      vite.middlewares(request, response, () => {
        response.writeHead(404).end();
      });
    })().catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = error instanceof ConsoleError ? error.status : 500;
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(
        JSON.stringify({
          error: {
            code: String(status),
            message: error instanceof Error ? error.message : '构建控制台发生错误',
          },
        }),
      );
    });
  });

  try {
    vite = await createViteServer({
      configFile: false,
      root: resolve(rootDir, 'build-console'),
      envDir: false,
      plugins: [react()],
      publicDir: false,
      appType: 'spa',
      cacheDir: resolve(rootDir, 'node_modules/.vite-console'),
      server: { middlewareMode: true, hmr: { server }, fs: { allow: [rootDir] } },
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('控制台端口分配失败');
    origin = `http://127.0.0.1:${address.port}`;
  } catch (error) {
    await vite?.close();
    await jobs.dispose();
    throw error;
  }
  let closed = false;
  return {
    server,
    origin,
    async close() {
      if (closed) return;
      closed = true;
      await jobs.dispose();
      for (const pending of previews.values()) {
        try {
          await (await pending).close();
        } catch {
          /* A failed preview has no listening server. */
        }
      }
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const consoleServer = await createBuildConsole();
    process.stdout.write(
      `\n企业构建控制台：${consoleServer.origin}/\n在页面中配置模块、保存并构建。按 Ctrl+C 停止服务。\n`,
    );
    const stop = () => {
      void consoleServer.close().then(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    process.stderr.write(
      `构建控制台启动失败：${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
