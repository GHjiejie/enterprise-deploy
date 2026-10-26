import { readonly, ref } from 'vue';
import type { InjectionKey, Ref } from 'vue';
import type { Activity, ModuleContext } from '../../contracts/operations';
export interface AuditStore {
  readonly events: Readonly<Ref<readonly Activity[]>>;
  readonly discarded: Readonly<Ref<number>>;
}
export const auditKey: InjectionKey<AuditStore> = Symbol('audit-store');
export function activate(context: ModuleContext): () => void {
  const events = ref<readonly Activity[]>([]);
  const discarded = ref(0);
  context.provide(auditKey, { events: readonly(events), discarded: readonly(discarded) });
  return context.activity.subscribe((event) => {
    if (events.value.length === 200) discarded.value += 1;
    events.value = [event, ...events.value].slice(0, 200);
  });
}
