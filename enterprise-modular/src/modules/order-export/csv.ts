import type { Order } from '../../contracts/feature';

function cell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(orders: readonly Order[]): string {
  const rows = [
    ['订单编号', '客户', '金额', '状态'],
    ...orders.map((item) => [item.id, item.customer, item.amount, item.status]),
  ];
  return `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
