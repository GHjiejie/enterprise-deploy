import { computed, ref, watch } from 'vue';
import type { FieldValue, FormTarget, FormEnvironment } from '../contracts/presentation';
import { useRuntime } from '../core/runtime';
import { parseForm } from './form';
export function useConfiguredForm(
  target: FormTarget,
  required: readonly string[],
  environment: () => FormEnvironment = () => ({}),
) {
  const runtime = useRuntime();
  const fields = computed(() =>
    runtime.formFields.filter(
      ({ owner, value }) => value.target === target && runtime.can(owner, value.permission),
    ),
  );
  const draft = ref<Record<string, FieldValue>>({});
  watch(
    fields,
    (next) => {
      draft.value = Object.fromEntries(
        next.map(({ value }) => [value.key, draft.value[value.key] ?? value.initial]),
      );
    },
    { immediate: true, flush: 'sync' },
  );
  watch(
    () =>
      fields.value.map(({ value }) => ({
        id: value.id,
        key: value.key,
        initial: value.initial,
        inputs: (value.dependsOn ?? []).map((key) => draft.value[key]),
      })),
    (next, previous) => {
      const before = new Map(previous?.map((field) => [field.id, field]) ?? []);
      const changed = next.filter((field) => {
        const old = before.get(field.id);
        return (
          old &&
          draft.value[field.key] !== field.initial &&
          field.inputs.some((value, index) => value !== old.inputs[index])
        );
      });
      if (changed.length)
        draft.value = {
          ...draft.value,
          ...Object.fromEntries(changed.map((field) => [field.key, field.initial])),
        };
    },
    { flush: 'sync' },
  );
  const available = computed(() =>
    required.every((key) =>
      fields.value.some(({ value }) => value.key === key && value.purpose === 'required'),
    ),
  );
  const context = computed(() => environment());
  const blocked = computed(() =>
    fields.value.some(
      ({ value }) =>
        (value.requiredWhen?.({ ...context.value, values: draft.value }) ?? value.required) &&
        value.disabledWhen?.({ ...context.value, values: draft.value }),
    ),
  );
  const reset = (): void => {
    draft.value = Object.fromEntries(fields.value.map(({ value }) => [value.key, value.initial]));
  };
  // Resolve the current permission intersection on every submission. Unavailable fields never enter payloads.
  const read = () => parseForm(fields.value, draft.value, required, context.value);
  return { fields, draft, available, blocked, context, reset, read };
}
