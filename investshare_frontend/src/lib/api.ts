
import { API_URL } from "@/config";
const BASE = API_URL;

import { auth } from "@/state/auth";

async function refreshToken(): Promise<boolean> {
  const r = auth.refresh;
  if (!r) return false;
  const res = await fetch(`${BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: r }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (!data.access) return false;
  auth.set({ access: data.access, refresh: r });
  return true;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as any) };
  if (auth.access) headers.Authorization = `Bearer ${auth.access}`;

  let res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && await refreshToken()) {
    headers.Authorization = `Bearer ${auth.access}`;
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  // @ts-ignore
  return undefined;
}

export function post<T>(path: string, body?: any) {
  return apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}
export function patch<T>(path: string, body?: any) {
  return apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
}
export function del<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}
