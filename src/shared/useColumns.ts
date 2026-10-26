import { computed } from 'vue';
import type { TableTarget } from '../contracts/presentation';
import { useRuntime } from '../core/runtime';
export function useColumns(target: TableTarget) {
  const runtime = useRuntime();
  return computed(() =>
    runtime.columns.filter(
      ({ owner, value }) => value.target === target && runtime.can(owner, value.permission),
    ),
  );
}
