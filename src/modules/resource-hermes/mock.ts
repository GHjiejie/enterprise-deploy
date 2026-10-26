import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('智能运维助手', 'HERMES_MODEL_MOCK', asset);
}
