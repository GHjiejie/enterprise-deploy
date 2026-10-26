<script setup lang="ts">
import type { MockField } from '../../contracts/mock';
defineProps<{
  fields: readonly MockField[];
  values: Record<string, string>;
  pending: boolean;
  prefix: string;
}>();
const emit = defineEmits<{ change: [key: string, value: string] }>();
</script>
<template>
  <label v-for="field in fields" :key="field.key" :for="`${prefix}-${field.key}`"
    >{{ field.label }}
    <textarea
      v-if="field.type === 'textarea'"
      :id="`${prefix}-${field.key}`"
      :value="values[field.key]"
      :disabled="pending"
      @input="emit('change', field.key, ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      :id="`${prefix}-${field.key}`"
      :value="values[field.key]"
      :type="field.type ?? 'text'"
      :disabled="pending"
      autocomplete="off"
      @input="emit('change', field.key, ($event.target as HTMLInputElement).value)"
    />
    <small v-if="field.hint" class="muted">{{ field.hint }}</small>
  </label>
</template>
