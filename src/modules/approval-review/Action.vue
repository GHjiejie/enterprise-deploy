<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ApprovalRowContext } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formText } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { reviewApproval } from './model';
const props = defineProps<{ context: ApprovalRowContext }>();
const open = ref(false);
const {
  fields,
  draft,
  available,
  blocked,
  context: environment,
  reset,
  read,
} = useConfiguredForm('approval-review', []);
const active = computed(() => props.context.request.status === '复核中');
const { error, run } = useAction('approval-review', 'approval.review');
watch(
  fields,
  () => {
    error.value = '';
  },
  { flush: 'sync' },
);
function submit(): void {
  if (
    run(() => {
      const submission = read();
      const comment =
        submission.values.comment === undefined ? '' : formText(submission.values, 'comment');
      const current = props.context.requests.find((item) => item.id === props.context.request.id);
      if (!current) throw new Error('审批记录已失效。');
      const next = reviewApproval(current, comment);
      props.context.replace(
        props.context.requests.map((item) => (item.id === current.id ? next : item)),
      );
      return {
        area: '审批',
        action: next.history.at(-1)?.action ?? '审批复核',
        subject: current.id,
        detail: `${current.status} → ${next.status}；${next.history.at(-1)?.comment ?? ''}`,
      };
    })
  ) {
    open.value = false;
    reset();
  }
}
</script>
<template>
  <button
    v-if="active"
    class="compact"
    @click="
      open = true;
      error = '';
    "
  >
    复核通过</button
  ><Modal v-if="open" title="确认复核" @close="open = false"
    ><p>{{ context.request.title }}</p>

    <form class="feature-form" @submit.prevent="submit">
      <ConfiguredFields v-model="draft" :fields="fields" :environment="environment" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button class="secondary" type="button" @click="open = false">取消</button
        ><button type="submit" :disabled="!available || blocked">确认复核通过</button>
      </div>
    </form></Modal
  >
</template>
