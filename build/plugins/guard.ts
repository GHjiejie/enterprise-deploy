import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { sha256 } from '../utils.ts';
import { assertAllowed, assertEdge, identify, sourceFile } from '../policy/origin.ts';
import type { Origin, Policy } from '../policy/types.ts';
import type { Collector, ModuleEvidence, OutputEvidence } from '../audit/types.ts';

export function enterpriseGraphGuard(
  policy: Policy,
  collector: Collector,
  contextId: string,
  kind: 'app' | 'worker',
): Plugin {
  function origin(id: string): Origin {
    const result = identify(policy, id);
    assertAllowed(policy, result);
    return result;
  }
  return {
    name: `enterprise-graph-${contextId}`,
    enforce: 'pre',
    apply: 'build',
    async resolveId(source, importer) {
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved) return null;
      if (resolved.external) this.error(`EXTERNAL_MODULE: ${source}`);
      const target = origin(resolved.id);
      if (importer) assertEdge(policy, origin(importer), target);
      return resolved;
    },
    transform(_code, id) {
      origin(id);
      return null;
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const modules: ModuleEvidence[] = [];
        for (const id of this.getModuleIds()) {
          const item = origin(id);
          const info = this.getModuleInfo(id);
          if (!info) this.error(`MISSING_MODULE: ${id}`);
          const imports = info.importedIds.map((dependency) => {
            const target = origin(dependency);
            assertEdge(policy, item, target);
            return target.id;
          });
          const dynamicImports = info.dynamicallyImportedIds.map((dependency) => {
            const target = origin(dependency);
            assertEdge(policy, item, target);
            return target.id;
          });
          modules.push({
            ...item,
            sha256:
              item.kind === 'generated'
                ? sha256(info.code ?? '')
                : sha256(readFileSync(sourceFile(id, policy.root))),
            imports: [...new Set(imports)],
            dynamicImports: [...new Set(dynamicImports)],
            entry: info.isEntry,
          });
        }
        const outputs: OutputEvidence[] = [];
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') {
            const inputs = [...new Set([...Object.keys(output.modules), ...output.moduleIds])].map(
              origin,
            );
            if (!inputs.length) this.error(`UNOWNED_CHUNK: ${output.fileName}`);
            outputs.push({
              path: output.fileName,
              sha256: sha256(output.code),
              bytes: Buffer.byteLength(output.code),
              kind: 'chunk',
              producer: 'rolldown',
              inputs,
              imports: [...output.imports, ...output.dynamicImports],
            });
            continue;
          }
          const bytes =
            typeof output.source === 'string' ? Buffer.from(output.source) : output.source;
          const workerOutput = collector.contexts
            .filter((context) => context.kind === 'worker')
            .flatMap((context) => context.outputs)
            .find((item) => item.path === output.fileName && item.sha256 === sha256(bytes));
          if (workerOutput) {
            outputs.push({ ...workerOutput, producer: 'worker' });
            continue;
          }
          const inputs = output.originalFileNames.map((id) => origin(id));
          if (!inputs.length) this.error(`UNOWNED_ASSET: ${output.fileName}`);
          if (
            output.fileName.endsWith('.html') &&
            (output.fileName !== 'index.html' || inputs.some((input) => input.id !== 'index.html'))
          )
            this.error(`UNREGISTERED_HTML: ${output.fileName}`);
          outputs.push({
            path: output.fileName,
            sha256: sha256(bytes),
            bytes: bytes.byteLength,
            kind: output.fileName.endsWith('.css')
              ? 'style'
              : output.fileName.endsWith('.html')
                ? 'html'
                : 'asset',
            producer: 'vite',
            inputs,
            imports: [],
          });
        }
        collector.contexts.push({ id: contextId, kind, status: 'success', modules, outputs });
      },
    },
  };
}
