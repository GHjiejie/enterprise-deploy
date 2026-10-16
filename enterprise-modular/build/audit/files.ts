import { readFileSync } from 'node:fs';
import { isAbsolute, posix, relative } from 'node:path';
import { parse, NodeTypes } from '@vue/compiler-dom';
import type { RootNode, TemplateChildNode } from '@vue/compiler-dom';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { canonical, filesIn, sha256 } from '../utils.ts';
import type { Policy } from '../policy/types.ts';
import { assertAllowed } from '../policy/origin.ts';
import type { Collector, OutputEvidence } from './types.ts';

export function outputPath(path: string): void {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.split('/').some((part) => part === '..' || part === '.' || !part) ||
    /[\x00-\x1f]/u.test(path)
  )
    throw new Error(`UNSAFE_OUTPUT_PATH: ${path}`);
}

export function assertDeliverable(path: string, bytes: Uint8Array): void {
  outputPath(path);
  if (!/\.(?:js|css|html|svg|png|jpg|webp|woff2|json)$/u.test(path))
    throw new Error(`UNAPPROVED_FILE_TYPE: ${path}`);
  if (/\.(?:js|css|html|svg|json)$/u.test(path)) {
    const text = Buffer.from(bytes).toString('utf8');
    if (/sourceMappingURL\s*=/iu.test(text) || /["']sourcesContent["']\s*:/u.test(text))
      throw new Error(`SOURCE_MAP_OUTPUT: ${path}`);
  }
}

function verifyReferences(
  path: string,
  bytes: Uint8Array,
  approved: ReadonlyMap<string, OutputEvidence>,
): void {
  function reference(raw: string): void {
    if (raw.startsWith('#')) return;
    const url = decodeURIComponent(raw.split(/[?#]/u)[0] ?? '');
    if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(url))
      throw new Error(`UNAPPROVED_RESOURCE_REFERENCE: ${path} -> ${raw}`);
    const resolved = url.startsWith('/')
      ? url.slice(1)
      : posix.normalize(posix.join(posix.dirname(path), url));
    outputPath(resolved);
    if (!approved.has(resolved))
      throw new Error(`UNAPPROVED_RESOURCE_REFERENCE: ${path} -> ${raw}`);
  }
  const text = Buffer.from(bytes).toString('utf8');
  if (path.endsWith('.html')) {
    function walk(node: RootNode | TemplateChildNode): void {
      if (node.type !== NodeTypes.ROOT && node.type !== NodeTypes.ELEMENT) return;
      if (node.type === NodeTypes.ELEMENT) {
        if (
          node.tag === 'script' &&
          (node.children.length ||
            !node.props.some((prop) => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'src'))
        )
          throw new Error('UNAPPROVED_INLINE_SCRIPT');
        for (const prop of node.props)
          if (prop.type === NodeTypes.ATTRIBUTE && ['src', 'href', 'poster'].includes(prop.name)) {
            if (!prop.value) throw new Error('MISSING_RESOURCE_URL');
            reference(prop.value.content);
          }
      }
      for (const child of node.children) walk(child);
    }
    walk(parse(text));
  }
  if (path.endsWith('.css')) {
    const css = postcss.parse(text, { from: path });
    function value(text: string): void {
      valueParser(text).walk((node) => {
        if (node.type !== 'function') return;
        if (node.value.toLowerCase() === 'url') {
          const argument = node.nodes.find(
            (child) => child.type === 'word' || child.type === 'string',
          );
          if (!argument) throw new Error('MISSING_RESOURCE_URL');
          reference(argument.value);
          return false;
        }
        if (['image-set', '-webkit-image-set'].includes(node.value.toLowerCase()))
          for (const child of node.nodes) if (child.type === 'string') reference(child.value);
      });
    }
    css.walkDecls((declaration) => value(declaration.value));
    css.walkAtRules((rule) => {
      value(rule.params);
      if (rule.name.toLowerCase() === 'import') {
        const first = valueParser(rule.params).nodes.find(
          (node) => node.type !== 'space' && node.type !== 'comment',
        );
        if (first?.type === 'string') reference(first.value);
      }
    });
  }
}

export function freezeOutputs(policy: Policy, collector: Collector): OutputEvidence[] {
  if (collector.contexts.filter((item) => item.kind === 'app').length !== 1)
    throw new Error('MISSING_APP_CONTEXT');
  const byPath = new Map<string, OutputEvidence>();
  for (const context of collector.contexts) {
    for (const output of context.outputs) {
      if (!output.inputs.length) throw new Error(`UNOWNED_OUTPUT: ${output.path}`);
      output.inputs.forEach((input) => assertAllowed(policy, input));
      const previous = byPath.get(output.path);
      if (previous && previous.sha256 !== output.sha256)
        throw new Error(`OUTPUT_COLLISION: ${output.path}`);
      byPath.set(output.path, output);
    }
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export function verifyFiles(site: string, expected: readonly OutputEvidence[]): void {
  const approved = new Map(expected.map((item) => [item.path, item]));
  if (!approved.size || approved.size !== expected.length || !approved.has('index.html'))
    throw new Error('INVALID_FILE_MANIFEST');
  const actual = filesIn(site);
  if (actual.length !== approved.size) throw new Error('FILE_SET_MISMATCH');
  for (const file of actual) {
    const path = relative(site, file).replaceAll('\\', '/');
    const item = approved.get(path);
    if (!item) throw new Error(`UNREGISTERED_FILE: ${path}`);
    const bytes = readFileSync(file);
    assertDeliverable(path, bytes);
    verifyReferences(path, bytes, approved);
    if (bytes.byteLength !== item.bytes || sha256(bytes) !== item.sha256)
      throw new Error(`FILE_HASH_MISMATCH: ${path}`);
  }
  for (const output of expected) {
    for (const dependency of output.imports) {
      outputPath(dependency);
      if (!approved.has(dependency)) throw new Error(`EXTERNAL_CHUNK_REFERENCE: ${dependency}`);
    }
  }
}

export function siteHash(files: readonly OutputEvidence[]): string {
  return sha256(
    canonical(
      files
        .map((item) => ({ path: item.path, sha256: item.sha256, bytes: item.bytes }))
        .sort((a, b) => a.path.localeCompare(b.path, 'en')),
    ),
  );
}
