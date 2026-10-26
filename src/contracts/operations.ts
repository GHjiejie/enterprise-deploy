import type { InjectionKey, Ref } from 'vue';
import type { Order } from './feature';
import type { FormEntry } from './presentation';

export interface Activity {
  readonly id: string;
  readonly time: string;
  readonly actor: string;
  readonly area: string;
  readonly action: string;
  readonly subject: string;
  readonly detail: string;
}
export type ActivityInput = Omit<Activity, 'id' | 'time' | 'actor'>;
export interface ActivityBus {
  publish(event: ActivityInput): void;
  subscribe(listener: (event: Activity) => void): () => void;
}
export interface ModuleContext {
  readonly activity: ActivityBus;
  provide<T>(key: InjectionKey<T>, value: T): void;
}
export interface OrderWorkspace {
  readonly orders: Ref<readonly Order[]>;
  readonly loaded: Ref<boolean>;
  replace(orders: readonly Order[]): void;
}
export const orderWorkspaceKey: InjectionKey<OrderWorkspace> = Symbol('order-workspace');
export interface OrderActions {
  readonly orders: readonly Order[];
  readonly selectedOrders: readonly Order[];
  replace(orders: readonly Order[]): void;
  clearSelection(): void;
}
export interface OrderRowContext extends OrderActions {
  readonly order: Order;
}
export interface StockItem {
  readonly revision?: number;
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly warehouse: string;
  readonly quantity: number;
  readonly reserved: number;
  readonly threshold: number;
}
export interface InventoryContext {
  readonly items: readonly StockItem[];
  replace(items: readonly StockItem[]): void;
}
export interface StockRowContext extends InventoryContext {
  readonly item: StockItem;
}
export interface InventoryWorkspace {
  readonly items: Ref<readonly StockItem[]>;
  replace(items: readonly StockItem[]): void;
}
export const inventoryWorkspaceKey: InjectionKey<InventoryWorkspace> =
  Symbol('inventory-workspace');
export type ApprovalStatus = '待审批' | '复核中' | '已通过' | '已驳回';
export interface ApprovalRecord {
  readonly id: string;
  readonly time: string;
  readonly action: string;
  readonly comment: string;
}
export interface Approval {
  readonly id: string;
  readonly title: string;
  readonly applicant: string;
  readonly amount: number;
  readonly status: ApprovalStatus;
  readonly history: readonly ApprovalRecord[];
  readonly extra?: readonly FormEntry[];
}
export interface ApprovalContext {
  readonly requests: readonly Approval[];
  replace(requests: readonly Approval[]): void;
}
export interface ApprovalRowContext extends ApprovalContext {
  readonly request: Approval;
}
export interface ApprovalWorkspace {
  readonly requests: Ref<readonly Approval[]>;
  replace(requests: readonly Approval[]): void;
}
export const approvalWorkspaceKey: InjectionKey<ApprovalWorkspace> = Symbol('approval-workspace');
