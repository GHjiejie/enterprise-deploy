import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-oss',
  activate(context) {
    context.provide(mockServiceKey('resource-oss'), createService());
  },
} satisfies FeatureModule;
