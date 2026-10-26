export function requiredText(value: string, label: string, max = 120): string {
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`${label}需填写 1–${max} 个字符。`);
  return result;
}
export function positiveAmount(value: number): number {
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 100000000 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
  )
    throw new Error('金额须大于 0、不超过 1 亿元，最多两位小数。');
  return Math.round(value * 100) / 100;
}
export function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > 1000000)
    throw new Error(`${label}必须是绝对值不超过 100 万的整数。`);
  return value;
}
