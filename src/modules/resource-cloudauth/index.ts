import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-cloudauth',
  activate(context) {
    context.provide(mockServiceKey('resource-cloudauth'), createService());
  },
} satisfies FeatureModule;
