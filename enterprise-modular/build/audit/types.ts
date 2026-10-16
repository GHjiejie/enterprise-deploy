import type { BuildMode, Origin, SourceEvidence } from '../policy/types.ts';

export interface ModuleEvidence extends Origin {
  readonly sha256: string;
  readonly imports: readonly string[];
  readonly dynamicImports: readonly string[];
  readonly entry: boolean;
}

export interface OutputEvidence {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly kind: 'chunk' | 'style' | 'asset' | 'html';
  readonly producer: 'vite' | 'rolldown' | 'worker';
  readonly inputs: readonly Origin[];
  readonly imports: readonly string[];
}

export interface ContextEvidence {
  readonly id: string;
  readonly kind: 'app' | 'worker';
  readonly status: 'success';
  readonly modules: readonly ModuleEvidence[];
  readonly outputs: readonly OutputEvidence[];
}

export interface Collector {
  readonly contexts: ContextEvidence[];
}

export interface AuditRecord {
  readonly schemaVersion: 1;
  readonly policyVersion: string;
  readonly enterpriseId: string;
  readonly releaseId: string;
  readonly mode: BuildMode;
  readonly brandingId: string;
  readonly enabledModules: readonly string[];
  readonly sourceCommit: string;
  readonly sourceDirty: boolean;
  readonly sourceTreeHash: string;
  readonly configHash: string;
  readonly policyHash: string;
  readonly lockfileHash: string;
  readonly cacheKey: string;
  readonly createdAt: string;
  readonly toolchain: Readonly<Record<string, string>>;
  readonly registryHash: string;
  readonly sources: SourceEvidence;
  readonly contexts: readonly ContextEvidence[];
  readonly notApplicable: readonly { context: string; reason: string }[];
  readonly files: readonly OutputEvidence[];
  readonly siteHash: string;
  readonly checks: {
    readonly forbiddenSources: 0;
    readonly unknownSources: 0;
    readonly fileDifferences: 0;
    readonly sourceBoundaries: 'passed';
    readonly buildGraphs: 'passed';
    readonly finalFiles: 'passed';
  };
}

export interface PackageRecord {
  readonly schemaVersion: 1;
  readonly enterpriseId: string;
  readonly releaseId: string;
  readonly auditHash: string;
  readonly siteHash: string;
  readonly packageHash: string;
  readonly packagedAt: string;
}
