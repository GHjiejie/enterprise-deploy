import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-pay',
  activate(context) {
    context.provide(mockServiceKey('resource-pay'), createService());
  },
} satisfies FeatureModule;
