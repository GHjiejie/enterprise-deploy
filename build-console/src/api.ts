import { parseBootstrap, parseEntry, parseJob, parseStarted } from '../../build/console/contracts';
import type { Enterprise } from '../../build/policy/types';
import type { ReleaseMode } from '../../build/console/contracts';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('network', '无法连接本地控制台，请确认启动终端仍在运行后重试。');
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('invalid_response', '控制台返回了无效响应，请重试。');
  }
  if (!response.ok) {
    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      data.error &&
      typeof data.error === 'object' &&
      'message' in data.error &&
      typeof data.error.message === 'string' &&
      'code' in data.error &&
      typeof data.error.code === 'string'
    )
      throw new ApiError(data.error.code, data.error.message);
    throw new ApiError('request_failed', `请求失败（${response.status}），请重试。`);
  }
  return data;
}
export const bootstrap = async (signal?: AbortSignal) =>
  parseBootstrap(await request('/api/bootstrap', signal ? { signal } : {}));
export const getJob = async (id: string, signal: AbortSignal) =>
  parseJob(await request(`/api/builds/${encodeURIComponent(id)}`, { signal }));
export const saveProfile = async (
  profile: Enterprise,
  expectedRevision: string | null,
  token: string,
) =>
  parseEntry(
    await request('/api/enterprises', {
      method: 'PUT',
      headers: { 'X-Console-Token': token },
      body: JSON.stringify({ profile, expectedRevision }),
    }),
  );
export const startBuild = async (
  profile: Enterprise,
  expectedRevision: string | null,
  mode: ReleaseMode,
  token: string,
) =>
  parseStarted(
    await request('/api/builds', {
      method: 'POST',
      headers: { 'X-Console-Token': token },
      body: JSON.stringify({ profile, expectedRevision, mode }),
    }),
  );
