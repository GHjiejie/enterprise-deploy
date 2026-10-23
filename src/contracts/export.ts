import type { Order } from './feature';

export interface ExportRequest {
  readonly orders: readonly Order[];
}

export type ExportResponse =
  | { readonly ok: true; readonly csv: string }
  | { readonly ok: false; readonly error: string };
