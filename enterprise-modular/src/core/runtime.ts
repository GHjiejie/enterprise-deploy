import { inject } from 'vue';
import { runtimeKey } from '../contracts/feature';
import type { Runtime } from '../contracts/feature';

export function permitted(
  runtime: Pick<Runtime, 'persona' | 'licensedModules' | 'permissions'>,
  owner: string,
  permission: string,
): boolean {
  return (
    runtime.licensedModules.value.has(owner) &&
    runtime.permissions[runtime.persona.value].has(`${owner}:${permission}`)
  );
}

export function useRuntime(): Runtime {
  const runtime = inject(runtimeKey);
  if (!runtime) throw new Error('RUNTIME_NOT_PROVIDED');
  return runtime;
}
