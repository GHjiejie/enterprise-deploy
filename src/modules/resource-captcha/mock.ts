import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('阿里云 Captcha 2.0', 'ALIYUN_CAPTCHA_MOCK', asset);
}
