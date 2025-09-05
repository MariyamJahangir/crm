export interface ApiError extends Error {
  status?: number;
  data?: any;
}

const API_BASE_URL =
  import.meta.env.VITE_NODE_ENV == 'development'
    ? import.meta.env.VITE_DEV_API_BASE
    : import.meta.env.VITE_PROD_API_BASE;
    


type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(
  endpoint: string,
  options: {
    method?: HttpMethod;
    body?: any;
    token?: string | null;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, headers = {}, signal } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const computedHeaders: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  // Only set JSON Content-Type when NOT sending FormData
  if (!isFormData) {
    computedHeaders['Content-Type'] = computedHeaders['Content-Type'] || 'application/json';
  }

  const config: RequestInit = {
    method,
    headers: computedHeaders,
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  };


  const res = await fetch(`${API_BASE_URL}${endpoint}`, config);

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  if (isJson) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const err: ApiError = new Error((data && (data as any).message) || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, token?: string | null, signal?: AbortSignal) =>
    request<T>(endpoint, { method: 'GET', token, signal }),
  post: <T>(endpoint: string, body?: any, token?: string | null, signal?: AbortSignal) =>
    request<T>(endpoint, { method: 'POST', body, token, signal }),
  put: <T>(endpoint: string, body?: any, token?: string | null, signal?: AbortSignal) =>
    request<T>(endpoint, { method: 'PUT', body, token, signal }),
  patch: <T>(endpoint: string, body?: any, token?: string | null, signal?: AbortSignal) =>
    request<T>(endpoint, { method: 'PATCH', body, token, signal }),
  delete: <T>(endpoint: string, token?: string | null, signal?: AbortSignal) =>
    request<T>(endpoint, { method: 'DELETE', token, signal }),
};
