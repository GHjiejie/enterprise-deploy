import { ref } from 'vue';
import type { Order } from '../../contracts/feature';
import { orderWorkspaceKey } from '../../contracts/operations';
import type { ModuleContext } from '../../contracts/operations';
export function activate(context: ModuleContext): void {
  const orders = ref<readonly Order[]>([]);
  const loaded = ref(false);
  context.provide(orderWorkspaceKey, {
    orders,
    loaded,
    replace: (next) => {
      orders.value = [...next];
    },
  });
}
