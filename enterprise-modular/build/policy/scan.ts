import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseTemplate, NodeTypes } from '@vue/compiler-dom';
import type { RootNode, TemplateChildNode } from '@vue/compiler-dom';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import ts from 'typescript';
import { sha256 } from '../utils.ts';
import {
  assertAllowed,
  assertEdge,
  BRAND_ID,
  identify,
  REGISTRY_ID,
  sourceFile,
} from './origin.ts';
import type { Origin, Policy, SourceEdge, SourceEvidence } from './types.ts';

function literal(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}

export function scanSources(policy: Policy): SourceEvidence {
  const inputs = new Map<string, Origin & { sha256: string }>();
  const edges: SourceEdge[] = [];
  const workers = new Set<string>();
  const visited = new Set<string>();
  const options: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    paths: { '@/*': [resolve(policy.root, 'src/*')] },
    allowJs: true,
  };

  function resolveDependency(specifier: string, importer: string): string {
    if (specifier === 'virtual:enterprise-modules') return REGISTRY_ID;
    if (specifier === 'virtual:enterprise-brand') return BRAND_ID;
    if (/^(?:https?:|data:|node:|\/\/)/iu.test(specifier))
      throw new Error(`EXTERNAL_SOURCE: ${specifier}`);
    const query = specifier.split('?')[1];
    if (query && !/^(?:raw|url|worker|worker&url)$/u.test(query))
      throw new Error(`UNSUPPORTED_IMPORT_QUERY: ${specifier}`);
    const clean = specifier.split(/[?#]/u)[0] ?? '';
    let candidate: string | undefined;
    if (clean.startsWith('file:')) candidate = fileURLToPath(clean);
    else if (clean.startsWith('@/')) candidate = resolve(policy.root, 'src', clean.slice(2));
    else if (clean.startsWith('/'))
      candidate = existsSync(clean) ? clean : resolve(policy.root, `.${clean}`);
    else if (clean.startsWith('.')) candidate = resolve(dirname(importer), clean);
    if (candidate) {
      for (const suffix of ['', '.ts', '.tsx', '.js', '.vue', '/index.ts', '/index.js']) {
        const file = `${candidate}${suffix}`;
        if (existsSync(file) && statSync(file).isFile()) return sourceFile(file, policy.root);
      }
    } else {
      const result = ts.resolveModuleName(clean, importer, options, ts.sys).resolvedModule;
      if (result) return sourceFile(result.resolvedFileName, policy.root);
    }
    throw new Error(`UNRESOLVED_SOURCE: ${specifier} from ${identify(policy, importer).id}`);
  }

  function dependency(
    specifier: string,
    importer: string,
    kind: SourceEdge['kind'] = 'import',
  ): void {
    const target = resolveDependency(specifier, importer);
    const from = identify(policy, importer);
    const to = identify(policy, target);
    assertEdge(policy, from, to);
    edges.push({ from: from.id, to: to.id, kind });
    if (kind === 'worker' || /[?&]worker\b/u.test(specifier))
      workers.add(sourceFile(target, policy.root));
    if (to.kind !== 'generated') visit(target);
  }

  function inspectScript(code: string, file: string): void {
    const source = ts.createSourceFile(
      file,
      code,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function walk(node: ts.Node): void {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        const specifier = literal(node.moduleSpecifier);
        if (!specifier) throw new Error(`INVALID_IMPORT: ${file}`);
        dependency(specifier, file);
      }
      if (ts.isImportEqualsDeclaration(node)) throw new Error(`UNSUPPORTED_IMPORT_EQUALS: ${file}`);
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const name = node.expression.getText(source).replace(/\s/gu, '');
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const specifier = literal(node.arguments[0]);
          if (!specifier) throw new Error(`COMPUTED_IMPORT: ${file}`);
          dependency(specifier, file);
        }
        if (
          /(?:^|\.)(?:eval|Function|require|importScripts|glob|globEager|SharedWorker)$/u.test(name)
        )
          throw new Error(`FORBIDDEN_LOADER: ${name}`);
        if (
          name === 'document.createElement' &&
          literal(node.arguments?.[0])?.toLowerCase() === 'script'
        )
          throw new Error('RUNTIME_SCRIPT_INJECTION');
        if (/\.serviceWorker\.register$/u.test(name) || name.startsWith('WebAssembly.'))
          throw new Error(`UNSUPPORTED_CONTEXT: ${name}`);
        if (ts.isNewExpression(node) && /(?:^|\.)Worker$/u.test(name)) {
          const argument = node.arguments?.[0];
          if (
            !argument ||
            !ts.isNewExpression(argument) ||
            argument.expression.getText(source) !== 'URL'
          )
            throw new Error('UNTRACEABLE_WORKER');
          const specifier = literal(argument.arguments?.[0]);
          if (
            !specifier ||
            argument.arguments?.[1]?.getText(source).replace(/\s/gu, '') !== 'import.meta.url'
          )
            throw new Error('UNTRACEABLE_WORKER');
          dependency(specifier, file, 'worker');
        }
        if (
          ts.isNewExpression(node) &&
          name === 'URL' &&
          node.arguments?.[1]?.getText(source).replace(/\s/gu, '') === 'import.meta.url'
        ) {
          const specifier = literal(node.arguments[0]);
          if (!specifier) throw new Error('COMPUTED_ASSET_URL');
          dependency(specifier, file, 'resource');
        }
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }

  function inspectCss(code: string, file: string): void {
    function url(raw: string): void {
      const decoded = raw.replace(
        /\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\r\n\f])/giu,
        (_all, hex: string | undefined, character: string | undefined) =>
          hex ? String.fromCodePoint(parseInt(hex, 16) || 0xfffd) : (character ?? ''),
      );
      if (decoded.startsWith('#')) return;
      if (/^data:/iu.test(decoded)) throw new Error('UNTRACEABLE_INLINE_CSS_RESOURCE');
      dependency(decodeURIComponent(decoded), file, 'resource');
    }
    function value(text: string): void {
      valueParser(text).walk((node) => {
        if (node.type !== 'function') return;
        if (node.value.includes('\\')) throw new Error('UNSUPPORTED_ESCAPED_CSS_FUNCTION');
        if (['image-set', '-webkit-image-set'].includes(node.value.toLowerCase()))
          for (const child of node.nodes) if (child.type === 'string') url(child.value);
        if (node.value.toLowerCase() !== 'url') return;
        const children = node.nodes.filter(
          (child) => child.type !== 'space' && child.type !== 'comment',
        );
        if (children.length !== 1 || !children[0] || !['word', 'string'].includes(children[0].type))
          throw new Error('UNSUPPORTED_CSS_URL');
        url(children[0].value);
        return false;
      });
    }
    const ast = postcss.parse(code, { from: file });
    ast.walkDecls((declaration) => value(declaration.value));
    ast.walkAtRules((rule) => {
      if (rule.name.includes('\\')) throw new Error('UNSUPPORTED_ESCAPED_CSS_RULE');
      value(rule.params);
      if (rule.name.toLowerCase() === 'import') {
        const first = valueParser(rule.params).nodes.find(
          (node) => node.type !== 'space' && node.type !== 'comment',
        );
        if (first?.type === 'string') url(first.value);
        else if (first?.type !== 'function' || first.value.toLowerCase() !== 'url')
          throw new Error('UNSUPPORTED_CSS_IMPORT');
      }
    });
  }

  function inspectTemplate(code: string, file: string, html = false): void {
    const root = parseTemplate(code);
    let entryScripts = 0;
    function walk(node: RootNode | TemplateChildNode): void {
      if (node.type !== NodeTypes.ROOT && node.type !== NodeTypes.ELEMENT) return;
      if (node.type === NodeTypes.ELEMENT) {
        if (['iframe', 'object', 'embed'].includes(node.tag.toLowerCase()))
          throw new Error('UNAPPROVED_EMBEDDED_SOURCE');
        if (node.tag.toLowerCase() === 'script') {
          const src = node.props.find(
            (prop) => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'src',
          );
          const scriptType = node.props.find(
            (prop) => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'type',
          );
          if (
            !html ||
            src?.type !== NodeTypes.ATTRIBUTE ||
            src.value?.content !== '/src/composition/main.ts' ||
            scriptType?.type !== NodeTypes.ATTRIBUTE ||
            scriptType.value?.content !== 'module' ||
            node.children.length
          )
            throw new Error('UNAPPROVED_HTML_SCRIPT');
          entryScripts++;
        }
        for (const prop of node.props) {
          if (
            prop.type === NodeTypes.ATTRIBUTE &&
            ['src', 'poster', 'srcset'].includes(prop.name)
          ) {
            if (!prop.value || prop.name === 'srcset')
              throw new Error('UNSUPPORTED_TEMPLATE_RESOURCE');
            dependency(prop.value.content, file, 'resource');
          }
          if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'style')
            inspectCss(`a{${prop.value?.content ?? ''}}`, file);
          if (
            prop.type === NodeTypes.ATTRIBUTE &&
            ['image', 'use'].includes(node.tag) &&
            ['href', 'xlink:href'].includes(prop.name)
          ) {
            const href = prop.value?.content;
            if (!href) throw new Error('UNSUPPORTED_TEMPLATE_RESOURCE');
            if (!href.startsWith('#')) dependency(href, file, 'resource');
          }
          if (prop.type === NodeTypes.DIRECTIVE && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION)
            inspectScript(prop.exp.content, file);
        }
        if (node.tag.toLowerCase() === 'link') throw new Error('UNREGISTERED_HTML_LINK');
      }
      for (const child of node.children) walk(child);
    }
    walk(root);
    if (html && entryScripts !== 1) throw new Error('INVALID_HTML_ENTRY');
  }

  function visit(file: string): void {
    const origin = identify(policy, file);
    assertAllowed(policy, origin);
    if (visited.has(file)) return;
    visited.add(file);
    const bytes = readFileSync(file);
    inputs.set(origin.id, { ...origin, sha256: sha256(bytes) });
    if (origin.kind === 'vendor') return;
    const code = bytes.toString('utf8');
    if (/sourceMappingURL\s*=/u.test(code)) throw new Error(`SOURCE_MAP_INPUT: ${origin.id}`);
    switch (extname(file)) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.mjs':
        inspectScript(code, file);
        break;
      case '.css':
        inspectCss(code, file);
        break;
      case '.html':
        inspectTemplate(code, file, true);
        break;
      case '.vue': {
        const parsed = parseSfc(code, { filename: file });
        if (parsed.errors.length) throw new Error(`INVALID_VUE_SOURCE: ${origin.id}`);
        const { descriptor } = parsed;
        if (descriptor.customBlocks.length) throw new Error('UNREGISTERED_VUE_CUSTOM_BLOCK');
        for (const block of [descriptor.script, descriptor.scriptSetup]) {
          if (block?.src) dependency(block.src, file);
          if (block?.content) inspectScript(block.content, file);
        }
        for (const style of descriptor.styles) {
          if (style.lang && style.lang !== 'css') throw new Error('UNSUPPORTED_STYLE_LANGUAGE');
          if (style.src) dependency(style.src, file, 'resource');
          inspectCss(style.content, file);
        }
        if (descriptor.template?.src) dependency(descriptor.template.src, file, 'resource');
        if (descriptor.template?.content) inspectTemplate(descriptor.template.content, file);
        break;
      }
      case '.svg':
        inspectTemplate(code, file);
        break;
      case '.json':
      case '.png':
      case '.jpg':
      case '.webp':
      case '.woff2':
      case '.txt':
        break;
      default:
        throw new Error(`UNSUPPORTED_SOURCE_TYPE: ${origin.id}`);
    }
  }

  // The only approved assembly edges are generated here, never discovered by a full-source glob.
  for (const module of policy.selected) {
    const target = identify(policy, module.entry);
    edges.push({ from: 'virtual:registry', to: target.id, kind: 'import' });
    visit(module.entry);
  }
  edges.push({
    from: 'virtual:branding',
    to: identify(policy, policy.brand.entry).id,
    kind: 'import',
  });
  visit(policy.brand.entry);
  visit(resolve(policy.root, 'index.html'));
  // HTML is the approved bootstrap generator; the import rule applies to application edges.
  return {
    inputs: [...inputs.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')),
    edges,
    workers: [...workers].map((file) => identify(policy, file).id).sort(),
  };
}
