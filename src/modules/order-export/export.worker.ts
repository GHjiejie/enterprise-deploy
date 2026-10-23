import type { ExportRequest, ExportResponse } from '../../contracts/export';
import { toCsv } from './csv';

globalThis.addEventListener('message', (event: MessageEvent<ExportRequest>) => {
  let response: ExportResponse;
  try {
    response = { ok: true, csv: toCsv(event.data.orders) };
  } catch {
    response = { ok: false, error: '订单转换失败，请重试' };
  }
  globalThis.postMessage(response);
});
