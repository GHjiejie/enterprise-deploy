import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('企业微信', 'WECOM_MOCK', asset);
}
