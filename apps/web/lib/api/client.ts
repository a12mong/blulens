import type { ApiSuccess, ApiError } from '@blulens/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(fn: () => void): void {
  sessionExpiredHandler = fn;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });
      // 204 No Content means refresh succeeded
      return response.status === 204;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const baseUrl = '/api/v1' + path;

  if (!query) {
    return baseUrl;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!isJson) {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Invalid response format');
  }

  try {
    return await response.json();
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Failed to parse response JSON');
  }
}

function parseResponse(response: Response, body: unknown): unknown {
  // 204 No Content - return undefined
  if (response.status === 204) {
    return undefined;
  }

  if (typeof body !== 'object' || body === null) {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Invalid response format');
  }

  const envelope = body as unknown;

  // Check if it's a success envelope
  if (
    typeof envelope === 'object' &&
    envelope !== null &&
    'success' in envelope &&
    (envelope as Record<string, unknown>).success === true
  ) {
    return (envelope as ApiSuccess<unknown>).data;
  }

  // Check if it's an error envelope
  if (
    typeof envelope === 'object' &&
    envelope !== null &&
    'success' in envelope &&
    (envelope as Record<string, unknown>).success === false
  ) {
    const error = (envelope as ApiError).error;
    throw new ApiRequestError(response.status, error.code, error.message, error.details);
  }

  throw new ApiRequestError(0, 'NETWORK_ERROR', 'Invalid response envelope');
}

export async function apiFetch<T>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    signal?: AbortSignal;
  }
): Promise<T> {
  const url = buildUrl(path, init?.query);
  const fetchInit: RequestInit = {
    method: init?.method || 'GET',
    credentials: 'same-origin',
    signal: init?.signal,
  };

  if (init?.body !== undefined) {
    fetchInit.headers = {
      'Content-Type': 'application/json',
    };
    fetchInit.body = JSON.stringify(init.body);
  }

  try {
    const response = await fetch(url, fetchInit);
    const body = await readBody(response);

    // Handle 401 with refresh and retry
    if (response.status === 401 && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
      const refreshed = await refreshSession();

      if (refreshed) {
        // Retry the original request
        const retryResponse = await fetch(url, fetchInit);
        const retryBody = await readBody(retryResponse);
        return parseResponse(retryResponse, retryBody) as T;
      } else {
        // Refresh failed, call handler and throw the original 401 error
        if (sessionExpiredHandler) {
          sessionExpiredHandler();
        }
        throw parseResponse(response, body) as never;
      }
    }

    return parseResponse(response, body) as T;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Network request failed');
  }
}
