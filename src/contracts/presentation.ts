import type { Component } from 'vue';
import type { StockItem } from './operations';
import type { StocktakeLine } from './stocktake';

export const formTargets = [
  'order-create',
  'approval-submit',
  'inventory-adjust',
  'inventory-transfer',
  'approval-approve',
  'approval-reject',
  'approval-review',
  'stocktake-create',
  'stocktake-count',
  'stocktake-approve',
  'stocktake-return',
  'stocktake-cancel',
] as const;
export type FormTarget = (typeof formTargets)[number];
export type TableTarget = 'orders' | 'inventory' | 'approvals' | 'stocktakes';
export type DetailTarget = 'order-detail' | 'approval-detail' | 'stocktake-detail';
export type FieldValue = string | number;
export interface FormEntry {
  readonly key: string;
  readonly label: string;
  readonly value: FieldValue;
}
export interface FormEnvironment {
  readonly stockItems?: readonly StockItem[];
  readonly stocktakeLine?: StocktakeLine;
}
export interface FormFieldContext extends FormEnvironment {
  readonly values: Readonly<Record<string, FieldValue>>;
}
export interface FormOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}
export interface FormField {
  readonly id: string;
  readonly target: FormTarget;
  readonly key: string;
  readonly order: number;
  readonly permission: string;
  readonly label: string;
  readonly control: 'text' | 'textarea' | 'number' | 'select';
  readonly initial: FieldValue;
  readonly required: boolean;
  readonly requiredWhen?: (context: FormFieldContext) => boolean;
  readonly purpose: 'required' | 'extension';
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly FormOption[];
  readonly optionsFor?: (context: FormFieldContext) => readonly FormOption[];
  readonly disabledWhen?: (context: FormFieldContext) => boolean;
  readonly hint?: string;
  readonly hintFor?: (context: FormFieldContext) => string;
  readonly dependsOn?: readonly string[];
  parse(value: FieldValue, context: FormFieldContext): FieldValue;
}
export interface TableColumn {
  readonly id: string;
  readonly target: TableTarget;
  readonly title: string;
  readonly order: number;
  readonly permission: string;
  readonly component: Component;
}
export interface DetailTab {
  readonly id: string;
  readonly target: DetailTarget;
  readonly title: string;
  readonly order: number;
  readonly permission: string;
  readonly component: Component;
}
