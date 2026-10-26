import type { Activity, ActivityBus, ActivityInput } from '../contracts/operations';
/** In-memory event transport; only installed subscribers retain events. */
export function createActivityBus(actor: () => string): ActivityBus {
  const listeners = new Set<(event: Activity) => void>();
  return {
    publish(input: ActivityInput) {
      const event = Object.freeze({
        ...input,
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        actor: actor(),
      });
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
