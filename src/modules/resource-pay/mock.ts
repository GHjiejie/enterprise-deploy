import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('微信支付', 'WECHAT_PAY_MOCK', asset);
}
