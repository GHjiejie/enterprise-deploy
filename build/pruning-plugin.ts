import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import ts from 'typescript';
import { MODULE_IDS, type BuildProfile, type ModuleId } from '../shared/build-profile.ts';
import { RESOLVED_ACTIVE_MODULE_ID } from './active-modules-plugin.ts';
import {
  MODULE_ROOTS,
  OWNERSHIP_POLICY,
  pruningHash,
  type PruningEvidence,
  type PruningFileKind,
  type PruningOwner,
} from './pruning.ts';

export interface PruningCollector {
  evidence?: PruningEvidence;
}

function privateOwner(owner: PruningOwner): owner is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(owner);
}

/** Classify resolved real paths, never an alias or an output filename. */
export function sourceOwner(id: string, root: string): PruningOwner {
  if (
    id === RESOLVED_ACTIVE_MODULE_ID ||
    [
      '\0vite/modulepreload-polyfill.js',
      '\0vite/preload-helper.js',
      '\0rolldown/runtime.js',
    ].includes(id)
  )
    return 'platform';
  if (id.startsWith('\0')) throw new Error(`Unregistered virtual browser module: ${id}`);
  const source = id.split(/[?#]/u)[0] ?? '';
  const absolute = isAbsolute(source) ? source : resolve(root, source);
  if (!existsSync(absolute)) throw new Error(`Unknown browser module or asset: ${id}`);
  const vendorRoot = resolve(root, 'node_modules');
  if (existsSync(vendorRoot)) {
    const vendorPath = relative(realpathSync(vendorRoot), realpathSync(absolute)).replaceAll(
      '\\',
      '/',
    );
    if (vendorPath && !vendorPath.startsWith('../') && !isAbsolute(vendorPath)) return 'vendor';
  }
  const path = relative(realpathSync(root), realpathSync(absolute)).replaceAll('\\', '/');
  for (const moduleId of MODULE_IDS) if (path.startsWith(MODULE_ROOTS[moduleId])) return moduleId;
  if (
    OWNERSHIP_POLICY.platformRoots.some((prefix) => path.startsWith(prefix)) ||
    (OWNERSHIP_POLICY.platformFiles as readonly string[]).includes(path)
  )
    return 'platform';
  if (OWNERSHIP_POLICY.sharedRoots.some((prefix) => path.startsWith(prefix))) return 'shared';
  if (path.startsWith(OWNERSHIP_POLICY.vendorRoot)) return 'vendor';
  throw new Error(`Forbidden or unowned browser source: ${path}`);
}

export function pruningPlugin(
  root: string,
  profile: BuildProfile,
  collector: PruningCollector,
): Plugin {
  const cssSources = new Map<string, Set<PruningOwner>>();
  const graph = new Map<string, readonly string[]>();
  const owners = new Map<string, PruningOwner>();
  function checkSource(id: string): PruningOwner {
    const owner = sourceOwner(id, root);
    if (privateOwner(owner) && !profile.modules[owner])
      throw new Error(`Disabled module ${owner} entered browser graph: ${id}`);
    owners.set(id, owner);
    return owner;
  }
  function inspectCss(id: string, visited = new Set<string>()): Set<PruningOwner> {
    const absolute = realpathSync(id.split(/[?#]/u)[0] ?? id);
    if (visited.has(absolute)) return new Set();
    visited.add(absolute);
    const result = new Set<PruningOwner>([checkSource(absolute)]);
    const text = readFileSync(absolute, 'utf8');
    const importerOwner = checkSource(absolute);
    function checkUrl(raw: string): void {
      const url = raw.replace(
        /\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\r\n\f])/giu,
        (_match, hex: string | undefined, char: string | undefined) =>
          hex ? String.fromCodePoint(parseInt(hex, 16) || 0xfffd) : (char ?? ''),
      );
      if (!url || url.startsWith('data:') || url.startsWith('#')) return;
      if (/^(?:[a-z]+:|\/\/)/iu.test(url))
        throw new Error(`Unapproved external CSS resource: ${url}`);
      const decoded = decodeURIComponent(url.split(/[?#]/u)[0] ?? '');
      const target = decoded.startsWith('/')
        ? resolve(root, `.${decoded}`)
        : resolve(dirname(absolute), decoded);
      const targetOwner = checkSource(target);
      if (
        privateOwner(targetOwner) &&
        (!privateOwner(importerOwner) || targetOwner !== importerOwner)
      )
        throw new Error(
          `Private module dependency forbidden (CSS resource): ${absolute} -> ${target}`,
        );
      result.add(targetOwner);
      if (/\.css$/iu.test(target))
        for (const owner of inspectCss(target, visited)) result.add(owner);
    }
    function inspectValue(value: string): void {
      valueParser(value).walk((node) => {
        if (node.type !== 'function') return;
        // Escaped function identifiers are rejected rather than guessed as unrelated functions.
        if (node.value.includes('\\'))
          throw new Error(`Escaped CSS functions require an ownership adapter: ${absolute}`);
        if (['image-set', '-webkit-image-set'].includes(node.value.toLowerCase())) {
          for (const child of node.nodes) if (child.type === 'string') checkUrl(child.value);
        }
        if (node.value.toLowerCase() !== 'url') return;
        const args = node.nodes.filter((item) => item.type !== 'space' && item.type !== 'comment');
        const argument = args[0];
        if (args.length !== 1 || !argument || !['word', 'string'].includes(argument.type))
          throw new Error(`Unsupported CSS URL syntax: ${absolute}`);
        checkUrl(argument.value);
        return false;
      });
    }
    const css = postcss.parse(text, { from: absolute });
    css.walkDecls((declaration) => inspectValue(declaration.value));
    css.walkAtRules((rule) => {
      if (rule.name.includes('\\'))
        throw new Error(`Escaped CSS at-rules require an ownership adapter: ${absolute}`);
      inspectValue(rule.params);
      if (rule.name.toLowerCase() === 'import') {
        const first = valueParser(rule.params).nodes.find(
          (node) => node.type !== 'space' && node.type !== 'comment',
        );
        if (first?.type === 'string') checkUrl(first.value);
        else if (first?.type !== 'function' || first.value.toLowerCase() !== 'url')
          throw new Error(`Unsupported CSS import syntax: ${absolute}`);
      }
    });
    cssSources.set(absolute, result);
    return result;
  }
  function reachableCss(id: string, visited = new Set<string>()): Set<PruningOwner> {
    if (visited.has(id)) return new Set();
    visited.add(id);
    const result = new Set<PruningOwner>();
    const path = id.replace(/^\0/u, '').split(/[?#]/u)[0] ?? '';
    if (existsSync(path))
      for (const owner of cssSources.get(realpathSync(path)) ?? []) result.add(owner);
    for (const child of graph.get(id) ?? [])
      for (const owner of reachableCss(child, visited)) result.add(owner);
    return result;
  }
  return {
    name: 'enterprise-physical-pruning',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      const importerOwner = checkSource(id);
      if (
        /\.(?:wasm)(?:[?#]|$)/iu.test(id) ||
        /[?&](?:worker|sharedworker)\b/u.test(id) ||
        /\bnew\s+(?:Shared)?Worker\s*\(/u.test(code)
      )
        throw new Error(`Worker/WASM builds require an ownership adapter: ${id}`);
      if (/\.css(?:[?#]|$)/iu.test(id)) inspectCss(id);
      else if (
        !id.startsWith('\0') &&
        /\.[cm]?[jt]sx?(?:[?#]|$)/iu.test(id) &&
        importerOwner !== 'vendor'
      ) {
        const source = ts.createSourceFile(
          id,
          code,
          ts.ScriptTarget.Latest,
          true,
          id.includes('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const visit = (node: ts.Node): void => {
          if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const argument = node.arguments[0];
            if (
              !argument ||
              (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument))
            )
              throw new Error(`Computed runtime imports require an ownership adapter: ${id}`);
          }
          if (
            ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'URL' &&
            node.arguments?.[1]?.getText(source).replace(/\s/gu, '') === 'import.meta.url'
          ) {
            const argument = node.arguments[0];
            if (
              !argument ||
              (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument))
            )
              throw new Error(
                `Dynamic import.meta.url resources require an ownership adapter: ${id}`,
              );
            const url = argument.text;
            if (/^(?:[a-z]+:|\/\/)/iu.test(url))
              throw new Error(`External import.meta.url resource is not approved: ${url}`);
            const decoded = decodeURIComponent(url.split(/[?#]/u)[0] ?? '');
            const target = decoded.startsWith('/')
              ? resolve(root, `.${decoded}`)
              : resolve(dirname(id.split(/[?#]/u)[0] ?? id), decoded);
            const targetOwner = checkSource(target);
            if (
              privateOwner(targetOwner) &&
              (!privateOwner(importerOwner) || targetOwner !== importerOwner)
            )
              throw new Error(
                `Private module dependency forbidden (URL resource): ${id} -> ${target}`,
              );
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    },
    moduleParsed(info) {
      checkSource(info.id);
      graph.set(info.id, [...info.importedIds, ...info.dynamicallyImportedIds]);
    },
    buildEnd(error) {
      if (error) return;
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id);
        if (!info) throw new Error(`Missing module evidence: ${id}`);
        const owner = checkSource(id);
        const children = [...info.importedIds, ...info.dynamicallyImportedIds];
        graph.set(id, children);
        for (const child of children) {
          const childOwner = checkSource(child);
          if (
            privateOwner(childOwner) &&
            id !== RESOLVED_ACTIVE_MODULE_ID &&
            (!privateOwner(owner) || childOwner !== owner)
          )
            throw new Error(`Private module dependency forbidden: ${id} -> ${child}`);
        }
      }
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const files = new Map<
          string,
          { owners: readonly PruningOwner[]; kind: PruningFileKind; sha256: string }
        >();
        const emitted = new Set<ModuleId>();
        const cssOutputs = new Map<string, Set<PruningOwner>>();
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          const chunkOwners = new Set<PruningOwner>();
          const cssOwners = new Set<PruningOwner>();
          for (const id of new Set([...Object.keys(output.modules), ...output.moduleIds])) {
            const owner = checkSource(id);
            chunkOwners.add(owner);
            if (privateOwner(owner)) emitted.add(owner);
            for (const cssOwner of reachableCss(id)) cssOwners.add(cssOwner);
          }
          if (!chunkOwners.size)
            throw new Error(`Unowned generated JavaScript: ${output.fileName}`);
          for (const path of [...output.imports, ...output.dynamicImports])
            if (!bundle[path])
              throw new Error(
                `External or missing JavaScript import: ${output.fileName} -> ${path}`,
              );
          if (output.map || output.sourcemapFileName || /sourceMappingURL\s*=/u.test(output.code))
            throw new Error('Source maps are forbidden in enterprise delivery');
          for (const path of output.viteMetadata?.importedCss ?? []) {
            const result = cssOutputs.get(path) ?? new Set<PruningOwner>();
            for (const owner of cssOwners) result.add(owner);
            cssOutputs.set(path, result);
          }
          files.set(output.fileName, {
            owners: [...chunkOwners],
            kind: 'script',
            sha256: pruningHash(output.code),
          });
        }
        for (const output of Object.values(bundle)) {
          if (output.type !== 'asset') continue;
          const result = new Set<PruningOwner>();
          let kind: PruningFileKind = 'asset';
          if (output.fileName === 'index.html') {
            kind = 'html';
            result.add('platform');
            const html =
              typeof output.source === 'string'
                ? output.source
                : Buffer.from(output.source).toString('utf8');
            for (const match of html.matchAll(
              /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/giu,
            )) {
              const url = match[1] ?? match[2] ?? match[3];
              if (!url || url.startsWith('#')) continue;
              if (/^(?:[a-z]+:|\/\/)/iu.test(url))
                throw new Error(`External HTML resource is not approved: ${url}`);
              const path = url.replace(/^\//u, '').split(/[?#]/u)[0] ?? '';
              if (!bundle[path]) throw new Error(`Missing HTML resource: ${url}`);
            }
          } else if (output.fileName.endsWith('.css')) {
            kind = 'style';
            for (const owner of cssOutputs.get(output.fileName) ?? []) result.add(owner);
            if (!result.size)
              throw new Error(`CSS output has no controlled source provenance: ${output.fileName}`);
          } else {
            for (const source of output.originalFileNames)
              result.add(checkSource(isAbsolute(source) ? source : resolve(root, source)));
          }
          if (!result.size || /\.(?:map|ts|tsx|jsx|vue|svelte)$/iu.test(output.fileName))
            throw new Error(`Unowned or forbidden output asset: ${output.fileName}`);
          files.set(output.fileName, {
            owners: [...result],
            kind,
            sha256: pruningHash(typeof output.source === 'string' ? output.source : output.source),
          });
        }
        collector.evidence = {
          files,
          emittedModuleIds: MODULE_IDS.filter((id) => emitted.has(id)),
          graphModuleCount: owners.size,
        };
      },
    },
  };
}
