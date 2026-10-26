import { inject, onBeforeUnmount, reactive, ref } from 'vue';
import { mockServiceKey } from '../../contracts/mock';
import type { MockActionSpec, MockReply } from '../../contracts/mock';
import { useRuntime } from '../../core/runtime';

export function useRequest(spec: MockActionSpec) {
  const service = inject(mockServiceKey(spec.service));
  if (!service) throw new Error(`SERVICE_MISSING: ${spec.service}`);
  const runtime = useRuntime();
  const values = reactive<Record<string, string>>(
    Object.fromEntries(spec.fields.map((field) => [field.key, field.initial])),
  );
  const pending = ref(false);
  const error = ref('');
  const reply = ref<MockReply>();
  let controller: AbortController | undefined;
  async function submit(): Promise<MockReply | undefined> {
    if (pending.value || !service) return;
    error.value = '';
    reply.value = undefined;
    if (!runtime.can(spec.id, 'mock.use')) {
      error.value = '当前账号没有此操作权限。';
      return;
    }
    for (const field of spec.fields) {
      const value = String(values[field.key] ?? '').trim();
      if (!value || (field.pattern && !new RegExp(field.pattern, 'u').test(value))) {
        error.value = `${field.label}：${field.hint ?? '请填写有效内容。'}`;
        return;
      }
    }
    const request = new AbortController();
    controller = request;
    pending.value = true;
    try {
      const message = spec.message.replace(/\{\{([a-z]+)\}\}/gu, (_match, key: string) =>
        String(values[key] ?? '').trim(),
      );
      const result = await service.execute(spec.id, message, 'success', request.signal);
      if (!request.signal.aborted && runtime.can(spec.id, 'mock.use')) {
        reply.value = result;
        return result;
      }
    } catch (cause) {
      if (!request.signal.aborted)
        error.value = cause instanceof Error ? cause.message : '操作失败，请稍后重试。';
    } finally {
      if (!request.signal.aborted) pending.value = false;
    }
  }
  function reset(): void {
    error.value = '';
    reply.value = undefined;
  }
  onBeforeUnmount(() => controller?.abort());
  return { values, pending, error, reply, submit, reset };
}
