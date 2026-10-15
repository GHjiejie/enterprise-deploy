export const MODULE_IDS = ['modelCatalog', 'chat', 'imageStudio', 'videoStudio'] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

/** Public, build-time product assembly. This is never a user authorization grant. */
export interface BuildProfile {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly modules: Readonly<Record<ModuleId, boolean>>;
  readonly defaultModule: ModuleId;
}

export const BUILD_MODES = ['development', 'staging', 'production'] as const;

export type BuildMode = (typeof BUILD_MODES)[number];

export function parseBuildMode(value: unknown): BuildMode {
  if (typeof value !== 'string' || !(BUILD_MODES as readonly string[]).includes(value)) {
    throw new Error(`不支持的环境模式：${String(value)}`);
  }

  return value as BuildMode;
}
