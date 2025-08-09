// src/lib/api.ts
// Central API helpers — guest-friendly + safer errors

export const API_URL: string =
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 15000;

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem("access");
  } catch {
    return null; // SSR / blocked storage
  }
}

export function authHeaders(extra?: Record<string, string>) {
  const token = getAccessToken();
  const base: Record<string, string> = { Accept: "application/json" };
  if (token) base.Authorization = `Bearer ${token}`;
  return { ...base, ...(extra || {}) };
}

type FetchOpts = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  auth?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
  withCredentials?: boolean; // opt-in cookies if your backend uses sessions
};

class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(typeof body === "string" ? body : `http_${status}`);
    this.status = status;
    this.body = body;
  }
}

function joinUrl(base: string, path: string) {
  if (path.startsWith("http")) return path;
  const slash = base.endsWith("/") || path.startsWith("/") ? "" : "/";
  return `${base.replace(/\/+$/, "")}${slash}${path.replace(/^\/+/, "/")}`;
}

async function parseMaybeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      /* fall back to text */
    }
  }
  return await res.text();
}

async function _fetch<T>(path: string, opts: FetchOpts = {}, allow401 = false): Promise<T> {
  const url = joinUrl(API_URL, path);
  const hasBody = opts.body !== undefined && opts.body !== null;

  // Build headers per-request
  const headers: Record<string, string> = opts.auth
    ? authHeaders(opts.headers)
    : { Accept: "application/json", ...(opts.headers || {}) };
  if (hasBody && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      credentials: opts.withCredentials ? "include" : "omit", // default: no cookies
      signal: ac.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    throw new ApiError(0, e?.message || "network_error");
  }
  clearTimeout(timeout);

  if (res.status === 204) return undefined as unknown as T;
  if (allow401 && res.status === 401) return null as unknown as T;

  if (!res.ok) {
    const body = await parseMaybeJson(res);
    throw new ApiError(res.status, body);
  }

  return (await parseMaybeJson(res)) as T;
}

// Public helpers
export async function apiFetch<T = any>(path: string, opts: FetchOpts = {}): Promise<T> {
  return _fetch<T>(path, opts, false);
}

export async function apiFetchAllow401<T = any>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  return _fetch<T | null>(path, opts, true);
}

export function get<T = any>(path: string, opts?: Omit<FetchOpts, "method" | "body">) {
  return apiFetch<T>(path, { ...opts, method: "GET" });
}

export function post<T = any>(path: string, body?: any, opts?: Omit<FetchOpts, "method">) {
  return apiFetch<T>(path, { ...opts, method: "POST", body, auth: true });
}

export function del<T = any>(path: string, opts?: Omit<FetchOpts, "method" | "body">) {
  return apiFetch<T>(path, { ...opts, method: "DELETE", auth: true });
}
