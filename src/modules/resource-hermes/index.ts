import type { FeatureModule } from '../../contracts/feature';
import { mockServiceKey } from '../../contracts/mock';
import { createService } from './mock';
export default {
  id: 'resource-hermes',
  activate(context) {
    context.provide(mockServiceKey('resource-hermes'), createService());
  },
} satisfies FeatureModule;
