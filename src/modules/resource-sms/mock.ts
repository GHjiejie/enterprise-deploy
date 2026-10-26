import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('阿里云短信', 'ALIYUN_SMS_MOCK', asset);
}
