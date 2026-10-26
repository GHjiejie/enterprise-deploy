import type { FormEntry, FormField, FieldValue, FormEnvironment } from '../contracts/presentation';
import type { Owned } from '../contracts/feature';
export function parseForm(
  fields: readonly Owned<FormField>[],
  draft: Readonly<Record<string, FieldValue>>,
  required: readonly string[],
  environment: FormEnvironment = {},
) {
  for (const key of required)
    if (!fields.some((item) => item.value.key === key && item.value.purpose === 'required'))
      throw new Error('必填字段不可用，请检查企业许可或当前权限。');
  const context = { ...environment, values: draft };
  const values: Record<string, FieldValue> = {};
  const extra: FormEntry[] = [];
  for (const { value: field } of fields) {
    if (field.disabledWhen?.(context)) {
      if (field.requiredWhen?.(context) ?? field.required)
        throw new Error(`${field.label}暂不可用，请完成前置选择。`);
      continue;
    }
    const value = field.parse(draft[field.key] ?? field.initial, context);
    values[field.key] = value;
    if (field.purpose === 'extension' && value !== '')
      extra.push({ key: field.key, label: field.label, value });
  }
  return { values, extra };
}
export function formText(values: Readonly<Record<string, FieldValue>>, key: string): string {
  const value = values[key];
  if (typeof value !== 'string') throw new Error('表单文本字段无效。');
  return value;
}
export function formNumber(values: Readonly<Record<string, FieldValue>>, key: string): number {
  const value = values[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('表单数字字段无效。');
  return value;
}
