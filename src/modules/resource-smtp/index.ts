import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-smtp',
  activate(context) {
    context.provide(mockServiceKey('resource-smtp'), createService());
  },
} satisfies FeatureModule;
