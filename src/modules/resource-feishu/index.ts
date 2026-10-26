import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-feishu',
  activate(context) {
    context.provide(mockServiceKey('resource-feishu'), createService());
  },
} satisfies FeatureModule;
