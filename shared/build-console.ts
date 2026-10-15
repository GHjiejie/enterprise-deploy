import type { BuildProfile, ModuleId } from './build-profile.ts';

export const RELEASE_MODES = ['staging', 'production'] as const;
export type ReleaseMode = (typeof RELEASE_MODES)[number];

export interface ConsoleModule {
  readonly id: ModuleId;
  readonly label: string;
  readonly entryPath: string;
  readonly dependsOn: readonly ModuleId[];
}

export interface ProfileEntry {
  readonly profile: BuildProfile;
  readonly revision: string;
}

export interface SaveProfileRequest {
  readonly profile: BuildProfile;
  readonly expectedRevision: string | null;
}

export interface StartBuildRequest extends SaveProfileRequest {
  readonly mode: ReleaseMode;
}

export interface BuildResult {
  readonly outDir: string;
  readonly buildId: string;
  readonly artifactDigest: string;
  readonly previewUrl: string;
  readonly downloadUrl: string;
  readonly packageName: string;
}

export interface BuildJob {
  readonly id: string;
  readonly profile: BuildProfile;
  readonly mode: ReleaseMode;
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed';
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly log: string;
  readonly error: string | null;
  readonly result: BuildResult | null;
}

export interface ConsoleBootstrap {
  readonly modules: readonly ConsoleModule[];
  readonly profiles: readonly ProfileEntry[];
  readonly activeJob: BuildJob | null;
}

export interface StartBuildResponse {
  readonly entry: ProfileEntry;
  readonly job: BuildJob;
}

export interface ConsoleApiError {
  readonly error: { readonly code: string; readonly message: string };
}
