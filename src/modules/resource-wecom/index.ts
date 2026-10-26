import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-wecom',
  activate(context) {
    context.provide(mockServiceKey('resource-wecom'), createService());
  },
} satisfies FeatureModule;
