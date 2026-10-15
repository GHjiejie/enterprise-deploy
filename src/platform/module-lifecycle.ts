import type { BuildProfile, ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition } from '../../shared/module-definition.ts';
import { getEnabledModules } from '../../shared/module-assembly.ts';
import { canViewModule, type UserAccess } from './permissions.ts';

export type ModuleCleanup = () => void | Promise<void>;
export type ModuleActivator = () => void | ModuleCleanup | Promise<void | ModuleCleanup>;

async function dispose(cleanups: readonly ModuleCleanup[]): Promise<unknown[]> {
  const failures: unknown[] = [];
  for (const cleanup of [...cleanups].reverse()) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  return failures;
}

/** Explicit opt-in lifecycle. Importing module metadata never performs activation. */
export async function activateModules(
  profile: BuildProfile,
  access: UserAccess,
  activators: Readonly<Partial<Record<ModuleId, ModuleActivator>>>,
  registry: readonly ModuleDefinition[],
): Promise<ModuleCleanup> {
  const cleanups: ModuleCleanup[] = [];
  try {
    for (const module of getEnabledModules(profile, registry)) {
      if (!canViewModule(module, access)) continue;
      const cleanup = await activators[module.id]?.();
      if (cleanup) cleanups.push(cleanup);
    }
  } catch (error) {
    const failures = await dispose(cleanups);
    if (failures.length)
      throw new AggregateError([error, ...failures], '模块启动失败，回滚部分清理失败');
    throw error;
  }
  let disposed = false;
  return async () => {
    if (disposed) return;
    disposed = true;
    const failures = await dispose(cleanups);
    if (failures.length) throw new AggregateError(failures, '模块清理失败');
  };
}
