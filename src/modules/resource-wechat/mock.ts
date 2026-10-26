import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('微信开放平台', 'WECHAT_OPEN_MOCK', asset);
}
