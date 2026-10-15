import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_IDS, type BuildMode, type BuildProfile } from '../../shared/build-profile.ts';
import {
  pruningHash,
  writePruningReport,
  type PruningEvidence,
  type PruningFileKind,
  type PruningReference,
} from '../../build/pruning.ts';

/** Synthetic evidence for unit-test fixtures only. Real builds must inspect the bundler graph. */
export function writeFixturePruningReport(
  outDir: string,
  profile: BuildProfile,
  mode: BuildMode,
  buildId: string,
): PruningReference {
  const files = new Map<
    string,
    PruningEvidence['files'] extends ReadonlyMap<string, infer T> ? T : never
  >();
  function visit(relative: string): void {
    for (const name of readdirSync(join(outDir, relative)).sort()) {
      const path = relative ? `${relative}/${name}` : name;
      const stat = lstatSync(join(outDir, path));
      if (stat.isSymbolicLink()) throw new Error('Test fixture cannot contain a symlink');
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile() && !['release-record.json', 'pruning-report.json'].includes(path)) {
        const kind: PruningFileKind = path.endsWith('.js')
          ? 'script'
          : path.endsWith('.css')
            ? 'style'
            : path.endsWith('.html')
              ? 'html'
              : 'asset';
        files.set(path, {
          owners: ['platform'],
          kind,
          sha256: pruningHash(readFileSync(join(outDir, path))),
        });
      }
    }
  }
  visit('');
  return writePruningReport(
    outDir,
    { profile, environment: mode, buildId },
    {
      files,
      emittedModuleIds: MODULE_IDS.filter((id) => profile.modules[id]),
      graphModuleCount: Math.max(1, files.size),
    },
  );
}
