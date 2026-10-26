import type { InjectionKey } from 'vue';

export type MockOutcome = 'success' | 'failure' | 'empty';
export interface MockReply {
  readonly reference: string;
  readonly message: string;
}
export interface MockService {
  readonly name: string;
  readonly asset: string;
  execute(
    operation: string,
    message: string,
    outcome: MockOutcome,
    signal: AbortSignal,
  ): Promise<MockReply>;
}
export function mockServiceKey(id: string): InjectionKey<MockService> {
  return Symbol.for(`enterprise:mock:${id}`);
}
export interface MockField {
  readonly key: string;
  readonly label: string;
  readonly initial: string;
  readonly type?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'textarea';
  readonly pattern?: string;
  readonly hint?: string;
}
export interface MockActionSpec {
  readonly id: string;
  readonly service: string;
  readonly title: string;
  readonly description: string;
  readonly button: string;
  readonly message: string;
  readonly fields: readonly MockField[];
  readonly emptyMessage?: string;
}
