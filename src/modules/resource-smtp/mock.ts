import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('腾讯企业邮 SMTP', 'TENCENT_SMTP_MOCK', asset);
}
