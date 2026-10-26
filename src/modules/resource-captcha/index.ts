import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-captcha',
  activate(context) {
    context.provide(mockServiceKey('resource-captcha'), createService());
  },
} satisfies FeatureModule;
