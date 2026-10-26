<script setup lang="ts">
import { computed } from 'vue';
import type { StocktakeRowContext } from '../../contracts/stocktake';
import { useRuntime } from '../../core/runtime';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
defineProps<{ context: StocktakeRowContext }>();
const runtime = useRuntime();
const hasActions = computed(() =>
  runtime.extensions.stocktakeLines.some(({ owner, value }) =>
    runtime.can(owner, value.permission),
  ),
);
</script>
<template>
  <div class="stocktake-lines">
    <article v-for="line in context.document.lines" :key="line.stockId" class="stocktake-line">
      <header>
        <div>
          <strong>{{ line.name }}</strong
          ><small>{{ line.sku }}</small>
        </div>
        <ExtensionPoint v-if="hasActions" slot="stocktakeLines" :context="{ ...context, line }" />
      </header>
      <dl>
        <div>
          <dt>账面</dt>
          <dd>{{ line.bookQuantity }}</dd>
        </div>
        <div>
          <dt>实盘</dt>
          <dd>{{ line.counted ?? '未录入' }}</dd>
        </div>
        <div>
          <dt>差异</dt>
          <dd :class="{ difference: line.counted !== null && line.counted !== line.bookQuantity }">
            {{ line.counted === null ? '—' : line.counted - line.bookQuantity }}
          </dd>
        </div>
      </dl>
      <p v-if="line.reason">差异原因：{{ line.reason }}</p>
    </article>
  </div>
</template>
<style scoped>
.stocktake-lines {
  display: grid;
  gap: 12px;
}
.stocktake-line {
  border: 1px solid #e1e7ef;
  border-radius: 8px;
  padding: 16px;
}
.stocktake-line header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.stocktake-line strong {
  font-size: 14px;
}
.stocktake-line small {
  display: block;
  color: #8592a5;
  font-size: 11px;
  margin-top: 3px;
}
.stocktake-line dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 0;
}
.stocktake-line dt {
  font-size: 11px;
  color: #8592a5;
}
.stocktake-line dd {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 600;
}
.stocktake-line p {
  font-size: 12px;
  color: #718198;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.difference {
  color: #ad6640;
}
</style>
