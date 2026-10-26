import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-sms',
  activate(context) {
    context.provide(mockServiceKey('resource-sms'), createService());
  },
} satisfies FeatureModule;
