const TOKEN_KEY = "eu_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Bajo nivel: nunca lanza por status — quien la llama decide qué códigos son "válidos". */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<{ status: number; body: T | null }> {
  const token = getToken();
  // import.meta.env.BASE_URL trae barra final (p. ej. "/infodata/" o "/"),
  // así que la API queda en "/infodata/api/..." detrás del proxy de Apache.
  const res = await fetch(`${import.meta.env.BASE_URL}api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return { status: res.status, body: null };

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // sin cuerpo o no era JSON
  }

  return { status: res.status, body: body as T | null };
}

function errorMessage(body: unknown, status: number): string {
  const b = body as Record<string, unknown> | null;
  const msg = b?.error ?? b?.message;
  if (typeof msg === "string") return msg;
  if (msg) return JSON.stringify(msg);
  return `Error ${status}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { status, body } = await apiFetch<T>(path, options);
  if (status >= 200 && status < 300) return body as T;
  throw new ApiError(status, errorMessage(body, status));
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
