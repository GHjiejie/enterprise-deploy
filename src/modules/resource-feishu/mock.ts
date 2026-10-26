import { createMockService } from '../../shared/mock/service';
import asset from './assets/mock.svg';
export function createService() {
  return createMockService('飞书开放平台与多维表格', 'FEISHU_BASE_MOCK', asset);
}
