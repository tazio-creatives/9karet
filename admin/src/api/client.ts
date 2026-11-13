const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  fields?: { path: string; message: string }[];

  constructor(status: number, message: string, fields?: { path: string; message: string }[]) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// credentials: 'include' carries the admin session cookie (separate store
// from the customer session — plan §8).
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isStateChanging = !!options.method && options.method !== 'GET';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(isStateChanging ? { 'X-Requested-With': '9karet' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.error?.message ?? response.statusText,
      body.error?.fields,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}
