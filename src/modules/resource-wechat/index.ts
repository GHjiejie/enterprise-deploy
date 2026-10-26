import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-wechat',
  activate(context) {
    context.provide(mockServiceKey('resource-wechat'), createService());
  },
} satisfies FeatureModule;
