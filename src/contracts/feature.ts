import type { Component, InjectionKey, Ref } from 'vue';

export interface Order {
  readonly id: string;
  readonly customer: string;
  readonly amount: number;
  readonly status: '待处理' | '已完成';
}

export interface OrderToolContext {
  readonly selectedOrders: readonly Order[];
}

export interface OrderTool {
  readonly id: string;
  readonly order: number;
  readonly permission: string;
  readonly component: Component;
}

export interface FeatureRoute {
  readonly name: string;
  readonly path: string;
  readonly permission: string;
  readonly load: () => Promise<{ default: Component }>;
}

export interface MenuItem {
  readonly id: string;
  readonly routeName: string;
  readonly title: string;
  readonly permission: string;
}

export interface FeatureModule {
  readonly id: string;
  readonly routes?: readonly FeatureRoute[];
  readonly menus?: readonly MenuItem[];
  readonly contributions?: { readonly orderTools?: readonly OrderTool[] };
  readonly demoMemberPermissions?: readonly string[];
  readonly activate?: () => void | (() => void) | Promise<void | (() => void)>;
}

export interface Owned<T> {
  readonly owner: string;
  readonly value: T;
}

export type Persona = 'admin' | 'member' | 'none';

export interface Runtime {
  readonly menus: readonly Owned<MenuItem>[];
  readonly orderTools: readonly Owned<OrderTool>[];
  readonly persona: Ref<Persona>;
  readonly permissions: Readonly<Record<Persona, ReadonlySet<string>>>;
  readonly licensedModules: Ref<ReadonlySet<string>>;
  readonly chunkError: Ref<string>;
  can(owner: string, permission: string): boolean;
}

export const runtimeKey: InjectionKey<Runtime> = Symbol('enterprise-runtime');
