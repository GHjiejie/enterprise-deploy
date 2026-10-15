import type {
  BuildJob,
  ConsoleBootstrap,
  ProfileEntry,
  SaveProfileRequest,
  StartBuildRequest,
  StartBuildResponse,
} from '../../shared/build-console.ts';

export class ConsoleRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ConsoleRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = isRecord(data) && isRecord(data.error) ? data.error : null;
    throw new ConsoleRequestError(
      typeof error?.message === 'string' ? error.message : '请求失败，请重试。',
      typeof error?.code === 'string' ? error.code : 'REQUEST_FAILED',
      response.status,
    );
  }
  // These same-origin endpoints are implemented against the shared console contract.
  return data as T;
}

export const consoleApi = {
  bootstrap(signal: AbortSignal): Promise<ConsoleBootstrap> {
    return request('/api/bootstrap', { signal });
  },
  save(id: string, body: SaveProfileRequest): Promise<ProfileEntry> {
    return request(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  build(body: StartBuildRequest): Promise<StartBuildResponse> {
    return request('/api/builds', { method: 'POST', body: JSON.stringify(body) });
  },
  job(id: string, signal: AbortSignal): Promise<BuildJob> {
    return request(`/api/builds/${encodeURIComponent(id)}`, { signal });
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试。';
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
