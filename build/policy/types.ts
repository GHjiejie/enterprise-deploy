export interface ModuleSpec {
  readonly id: string;
  readonly entry: string;
  readonly requires: readonly string[];
  readonly conflicts: readonly string[];
  readonly ownedRoots: readonly string[];
}

export interface Enterprise {
  readonly schemaVersion: 1;
  readonly enterpriseId: string;
  readonly enabledModules: readonly string[];
  readonly brandingId: string;
}

export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly entry: string;
  readonly ownedRoot: string;
}

export type BuildMode = 'development' | 'staging' | 'production';

export interface Policy {
  readonly root: string;
  readonly enterprise: Enterprise;
  readonly catalog: readonly ModuleSpec[];
  readonly selected: readonly ModuleSpec[];
  readonly brands: readonly Brand[];
  readonly brand: Brand;
  readonly packageRoots: readonly { name: string; root: string }[];
  readonly configHash: string;
  readonly policyHash: string;
  readonly lockfileHash: string;
}

export interface Origin {
  readonly id: string;
  readonly owner: string;
  readonly kind: 'business' | 'common' | 'brand' | 'vendor' | 'generated';
}

export interface SourceEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'import' | 'resource' | 'worker';
}

export interface SourceEvidence {
  readonly inputs: readonly (Origin & { sha256: string })[];
  readonly edges: readonly SourceEdge[];
  readonly workers: readonly string[];
}
