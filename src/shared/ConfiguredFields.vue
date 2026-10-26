<script setup lang="ts">
import { computed, useId } from 'vue';
import type { Owned } from '../contracts/feature';
import type { FieldValue, FormField, FormEnvironment } from '../contracts/presentation';
const props = defineProps<{
  fields: readonly Owned<FormField>[];
  environment?: FormEnvironment;
  modelValue: Readonly<Record<string, FieldValue>>;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, FieldValue>] }>();
const uid = useId();
const resolvedFields = computed(() =>
  props.fields.map(({ value }) => {
    const context = { ...props.environment, values: props.modelValue };
    return {
      ...value,
      required: value.requiredWhen?.(context) ?? value.required,
      options: value.optionsFor?.(context) ?? value.options ?? [],
      disabled: value.disabledWhen?.(context) ?? false,
      description: value.hintFor?.(context) ?? value.hint ?? '',
    };
  }),
);
function update(key: string, event: Event): void {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  )
    emit('update:modelValue', {
      ...props.modelValue,
      [key]:
        target instanceof HTMLInputElement && target.type === 'number' && target.value !== ''
          ? target.valueAsNumber
          : target.value,
    });
}
</script>
<template>
  <div v-for="field in resolvedFields" :key="field.id" class="configured-field">
    <label :for="`${uid}-${field.id}`">{{ field.label }}</label>
    <textarea
      v-if="field.control === 'textarea'"
      :id="`${uid}-${field.id}`"
      :value="modelValue[field.key]"
      :required="field.required"
      :disabled="field.disabled"
      :aria-describedby="field.description ? `${uid}-${field.id}-hint` : undefined"
      :maxlength="field.maxLength"
      @input="update(field.key, $event)"
    />
    <select
      v-else-if="field.control === 'select'"
      :id="`${uid}-${field.id}`"
      :value="modelValue[field.key]"
      :required="field.required"
      :disabled="field.disabled"
      :aria-describedby="field.description ? `${uid}-${field.id}-hint` : undefined"
      @change="update(field.key, $event)"
    >
      <option
        v-for="option in field.options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <input
      v-else
      :id="`${uid}-${field.id}`"
      :type="field.control"
      :value="modelValue[field.key]"
      :required="field.required"
      :disabled="field.disabled"
      :aria-describedby="field.description ? `${uid}-${field.id}-hint` : undefined"
      :maxlength="field.maxLength"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      @input="update(field.key, $event)"
    />
    <span v-if="field.description" :id="`${uid}-${field.id}-hint`" class="muted">{{
      field.description
    }}</span>
  </div>
</template>
