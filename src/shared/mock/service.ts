import type { MockService } from '../../contracts/mock';

/** Local-only transport. Each provider owns its identity, fixture and asset. */
export function createMockService(name: string, marker: string, asset: string): MockService {
  let sequence = 0;
  return {
    name,
    asset,
    execute(operation, message, outcome, signal) {
      // Test fixtures choose failures without exposing service controls in product pages.
      let selected = outcome;
      try {
        const fixture =
          typeof window === 'undefined'
            ? null
            : window.sessionStorage.getItem(`enterprise:mock:${operation}`);
        if (fixture === 'failure' || fixture === 'empty') selected = fixture;
      } catch {
        /* Restricted browser storage uses the normal response. */
      }
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error('请求已取消'));
          return;
        }
        const abort = (): void => {
          clearTimeout(timer);
          reject(new Error('请求已取消'));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          if (selected === 'failure') reject(new Error('请求暂时失败，请稍后重试。'));
          else
            resolve({
              reference: `${marker}:${operation}:${++sequence}`,
              message: selected === 'empty' ? '' : message,
            });
        }, 180);
        signal.addEventListener('abort', abort, { once: true });
      });
    },
  };
}
