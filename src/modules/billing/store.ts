import { ref } from 'vue';
import type { ModuleContext } from '../../contracts/operations';
import { billingWorkspaceKey } from '../../contracts/customer';
import type { Transaction } from '../../contracts/customer';
export function activate(context: ModuleContext): void {
  const balance = ref(1280);
  const transactions = ref<readonly Transaction[]>([
    { id: 'TX20261026001', date: '2026-10-26 10:24', amount: 500, kind: '充值', status: '已完成' },
    { id: 'TX20261025002', date: '2026-10-25 15:42', amount: 120, kind: '消费', status: '已完成' },
    { id: 'TX20261024003', date: '2026-10-24 09:18', amount: 100, kind: '充值', status: '已完成' },
  ]);
  context.provide(billingWorkspaceKey, {
    balance,
    transactions,
    recharge(amount) {
      balance.value += amount;
      transactions.value = [
        {
          id: `TX${Date.now()}`,
          date: new Date().toLocaleString('zh-CN'),
          amount,
          kind: '充值',
          status: '已完成',
        },
        ...transactions.value,
      ];
    },
    refund(id) {
      const row = transactions.value.find((item) => item.id === id);
      if (!row || row.kind !== '充值' || row.status !== '已完成') return;
      transactions.value = transactions.value.map((item) =>
        item.id === id ? { ...item, status: '已退款' } : item,
      );
      balance.value -= row.amount;
    },
  });
}
