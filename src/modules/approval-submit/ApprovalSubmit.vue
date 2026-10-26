<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ApprovalContext } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formText, formNumber } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { submitApproval } from './model';
const props = defineProps<{ context: ApprovalContext }>();
const open = ref(false);
const { fields, draft, available, reset, read } = useConfiguredForm('approval-submit', [
  'title',
  'applicant',
  'amount',
]);
const { error, run } = useAction('approval-submit', 'approval.submit');
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
      const request = submitApproval(
        formText(submission.values, 'title'),
        formText(submission.values, 'applicant'),
        formNumber(submission.values, 'amount'),
        submission.extra,
      );
      props.context.replace([request, ...props.context.requests]);
      return {
        area: '审批',
        action: '发起审批',
        subject: request.id,
        detail: `${request.title} · ¥${request.amount}`,
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
    data-guide="tool:approval-submit"
    @click="
      open = true;
      error = '';
    "
  >
    发起审批</button
  ><Modal v-if="open" title="发起审批" @close="open = false"
    ><form class="feature-form" @submit.prevent="submit">
      <ConfiguredFields v-model="draft" :fields="fields" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p class="muted">提交后进入待审批队列。达到 ¥50,000 时需完成两步审核。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="!available">提交申请</button>
      </div>
    </form></Modal
  >
</template>
