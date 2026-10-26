import type { InjectionKey, Ref } from 'vue';
import type { InventoryContext } from './operations';
import type { FormEntry } from './presentation';

export type StocktakeStatus = '盘点中' | '待复核' | '待过账' | '已过账' | '已作废';
export interface StocktakeLine {
  readonly stockId: string;
  readonly sku: string;
  readonly name: string;
  readonly bookQuantity: number;
  readonly bookReserved: number;
  readonly stockRevision: number;
  readonly counted: number | null;
  readonly reason: string;
}
export interface StocktakeRecord {
  readonly id: string;
  readonly time: string;
  readonly action: string;
  readonly comment: string;
}
export interface Stocktake {
  readonly id: string;
  readonly title: string;
  readonly warehouse: string;
  readonly status: StocktakeStatus;
  readonly lines: readonly StocktakeLine[];
  readonly history: readonly StocktakeRecord[];
  readonly extra: readonly FormEntry[];
}
export interface StocktakeWorkspace {
  readonly documents: Ref<readonly Stocktake[]>;
  replace(documents: readonly Stocktake[]): void;
}
export const stocktakeWorkspaceKey: InjectionKey<StocktakeWorkspace> =
  Symbol('stocktake-workspace');
export interface StocktakeContext extends InventoryContext {
  readonly documents: readonly Stocktake[];
  replaceDocuments(documents: readonly Stocktake[]): void;
}
export interface StocktakeRowContext extends StocktakeContext {
  readonly document: Stocktake;
}
export interface StocktakeLineContext extends StocktakeRowContext {
  readonly line: StocktakeLine;
}
