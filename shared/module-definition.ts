import type { ModuleId } from './build-profile.ts';

/** Public, side-effect-free metadata shared by the build and application. */
export interface ModuleRoute {
  readonly name: string;
  readonly path: string;
  readonly aliases?: readonly string[];
}

export interface ModuleDefinition {
  readonly id: ModuleId;
  readonly routes: readonly ModuleRoute[];
  readonly entryRouteName: string;
  readonly viewPermission: string;
  readonly dependsOn: readonly ModuleId[];
  readonly navigation?: {
    readonly label: string;
    readonly group: string;
    readonly order: number;
  };
}
