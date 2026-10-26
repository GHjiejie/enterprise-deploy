import type { InjectionKey, Ref } from 'vue';

export interface Transaction {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly kind: '充值' | '消费';
  readonly status: '已完成' | '已退款';
}
export interface BillingWorkspace {
  readonly balance: Ref<number>;
  readonly transactions: Ref<readonly Transaction[]>;
  recharge(amount: number): void;
  refund(id: string): void;
}
export const billingWorkspaceKey: InjectionKey<BillingWorkspace> = Symbol('billing-workspace');

export interface MediaFile {
  readonly id: string;
  readonly name: string;
  readonly kind: '图片' | '视频';
  readonly url: string;
}
export interface MediaWorkspace {
  readonly files: Ref<readonly MediaFile[]>;
  add(file: MediaFile): void;
}
export const mediaWorkspaceKey: InjectionKey<MediaWorkspace> = Symbol('media-workspace');
