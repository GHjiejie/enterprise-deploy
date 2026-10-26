import { ref } from 'vue';
import { useRuntime } from '../core/runtime';
import type { ActivityInput } from '../contracts/operations';

export function useAction(owner: string, permission: string) {
  const runtime = useRuntime();
  const error = ref('');
  function run(action: () => ActivityInput): boolean {
    error.value = '';
    try {
      if (!runtime.can(owner, permission)) throw new Error('当前身份或企业许可不允许执行此操作。');
      runtime.activity.publish(action());
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '操作失败，请重试。';
      return false;
    }
  }
  return { error, run };
}
