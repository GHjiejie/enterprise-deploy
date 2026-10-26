import type { Component, InjectionKey, Ref } from 'vue';
import type { ActivityBus, ModuleContext, OrderActions } from './operations';
import type { DetailTab, FormEntry, FormField, TableColumn } from './presentation';

export interface Order {
  readonly id: string;
  readonly customer: string;
  readonly amount: number;
  readonly status: '待处理' | '已完成';
  readonly priority?: boolean;
  readonly extra?: readonly FormEntry[];
  readonly notes?: readonly { readonly id: string; readonly text: string; readonly time: string }[];
}

export type OrderToolContext = OrderActions;

export interface OrderTool {
  readonly id: string;
  readonly order: number;
  readonly permission: string;
  readonly component: Component;
  readonly label?: string;
  readonly group?: string;
  readonly guide?: {
    readonly routeName: string;
    readonly title: string;
    readonly description: string;
  };
}

export interface FeatureRoute {
  readonly name: string;
  readonly path: string;
  readonly permission: string;
  readonly layout?: 'workspace' | 'standalone';
  readonly load: () => Promise<{ default: Component }>;
}

export interface MenuItem {
  readonly id: string;
  readonly routeName: string;
  readonly title: string;
  readonly permission: string;
  readonly guide?: { readonly order: number; readonly description: string };
}

export const extensionSlots = [
  'shellTools',
  'orderRows',
  'inventoryTools',
  'inventoryRows',
  'approvalTools',
  'approvalRows',
  'stocktakeTools',
  'stocktakeRows',
  'stocktakeLines',
  'accessTools',
  'accountTools',
  'billingTools',
  'mediaTools',
  'operationsTools',
  'accessBrand',
  'shellFooter',
  'billingRows',
] as const;
export type ExtensionSlot = (typeof extensionSlots)[number];

export interface FeatureModule {
  readonly id: string;
  readonly routes?: readonly FeatureRoute[];
  readonly menus?: readonly MenuItem[];
  readonly contributions?: { readonly orderTools?: readonly OrderTool[] } & Partial<
    Readonly<Record<ExtensionSlot, readonly OrderTool[]>>
  > & {
      readonly formFields?: readonly FormField[];
      readonly columns?: readonly TableColumn[];
      readonly detailTabs?: readonly DetailTab[];
    };
  readonly demoMemberPermissions?: readonly string[];
  readonly activate?: (
    context: ModuleContext,
  ) => void | (() => void) | Promise<void | (() => void)>;
}

export interface Owned<T> {
  readonly owner: string;
  readonly value: T;
}

export type Persona = 'admin' | 'member' | 'none';

export interface Runtime {
  readonly menus: readonly Owned<MenuItem>[];
  readonly orderTools: readonly Owned<OrderTool>[];
  readonly extensions: Readonly<Record<ExtensionSlot, readonly Owned<OrderTool>[]>>;
  readonly activity: ActivityBus;
  readonly formFields: readonly Owned<FormField>[];
  readonly columns: readonly Owned<TableColumn>[];
  readonly detailTabs: readonly Owned<DetailTab>[];
  readonly persona: Ref<Persona>;
  readonly permissions: Readonly<Record<Persona, ReadonlySet<string>>>;
  readonly licensedModules: Ref<ReadonlySet<string>>;
  readonly chunkError: Ref<string>;
  can(owner: string, permission: string): boolean;
}

export const runtimeKey: InjectionKey<Runtime> = Symbol('enterprise-runtime');
