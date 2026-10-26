import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('阿里云 CloudAuth', 'ALIYUN_CLOUDAUTH_MOCK', asset);
}
