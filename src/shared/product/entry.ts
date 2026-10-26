import { defineAsyncComponent, defineComponent, h } from 'vue';
import type { Component } from 'vue';
import type { MockActionSpec } from '../../contracts/mock';
import ChunkError from '../../core/ChunkError.vue';
import ActionEntry from './ActionEntry.vue';
import './product.css';

export function actionEntry(
  spec: MockActionSpec,
  options: { destination?: string; button?: string } = {},
) {
  return defineComponent({
    props: { context: Object },
    setup: (props) => () =>
      h(ActionEntry, { spec, ...options, ...(props.context ? { context: props.context } : {}) }),
  });
}
export function featureComponent(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({ loader, errorComponent: ChunkError });
}
