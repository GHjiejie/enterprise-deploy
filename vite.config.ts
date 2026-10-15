import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { loadBuildProfile } from './build/load-profile.ts';
import { parseBackendCompatibility, writeReleaseRecord } from './build/release-record.ts';
import { validateProfiles } from './build/validate-profiles.ts';
import { parseBuildMode } from './shared/build-profile.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode: rawMode }) => {
  const mode = parseBuildMode(rawMode);
  const profile = loadBuildProfile(process.env.APP_PROFILE);
  validateProfiles();

  const outDir = resolve(rootDir, 'dist', profile.id, mode);
  if (command === 'build' && mode !== 'development') {
    for (const name of ['.env.local', `.env.${mode}.local`]) {
      if (existsSync(resolve(rootDir, name))) {
        throw new Error(`发布构建不允许本地覆盖文件 ${name}；请使用隔离工作目录。`);
      }
    }
  }
  const application: { version: string } = JSON.parse(
    readFileSync(resolve(rootDir, 'package.json'), 'utf8'),
  );
  const compatibility = parseBackendCompatibility(
    JSON.parse(readFileSync(resolve(rootDir, 'config/backend-compatibility.json'), 'utf8')),
  );

  return {
    plugins: [
      react(),
      {
        name: 'enterprise-release-record',
        apply: 'build',
        closeBundle() {
          writeReleaseRecord({
            outDir,
            profile,
            mode,
            rootDir,
            backendCompatibility: compatibility,
            buildCommand: `APP_PROFILE=${profile.id} npm run build -- --mode ${mode}`,
            ...(process.env.APP_BUILD_ID
              ? { buildId: process.env.APP_BUILD_ID }
              : process.env.GITHUB_RUN_ID
                ? {
                    buildId: `github-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}-${profile.id}-${mode}`,
                  }
                : {}),
          });
        },
      },
    ],
    define: {
      __BUILD_PROFILE__: JSON.stringify(profile),
      __APP_VERSION__: JSON.stringify(application.version),
      __BUILD_MODE__: JSON.stringify(mode),
    },
    // All copied resources must be explicitly managed; profile repositories never ship.
    publicDir: false,
    build: { outDir, emptyOutDir: true, sourcemap: false },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
