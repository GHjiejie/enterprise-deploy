export const currency = (amount: number): string =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(amount);
