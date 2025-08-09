// src/hooks/useAuth.ts
import { apiFetchAllow401, post } from "@/lib/api";

export type Me = { id: number; username: string; email?: string } | null;
export type AuthTokens = { access: string; refresh?: string };

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";

function saveTokens(t: AuthTokens) {
  try {
    if (t?.access) localStorage.setItem(ACCESS_KEY, t.access);
    if (t?.refresh) localStorage.setItem(REFRESH_KEY, t.refresh);
  } catch {
    /* storage may be unavailable; ignore */
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

/** Current user or null (guest). Automatically clears stale tokens on 401. */
export async function me(): Promise<Me> {
  const user = await apiFetchAllow401<Me>("/auth/me/", { auth: true });
  if (!user) clearTokens(); // make UI consistent with server
  return user;
}

/** Log in (no Authorization header); saves tokens, then returns current user. */
export async function login(username: string, password: string): Promise<Me> {
  const tokens = await post<AuthTokens>(
    "/auth/login/",
    { username, password },
    { auth: false } // IMPORTANT: don't send stale Authorization on login
  );
  saveTokens(tokens);
  return me();
}

/** Register a new user (no auto-login unless your API returns tokens). */
export async function register(username: string, email: string, password: string) {
  return post<{ id: number; username: string; email: string }>(
    "/auth/register/",
    { username, email, password },
    { auth: false } // public endpoint
  );
}

/** Log out locally. Components that call `me()` will render as guest. */
export function logout() {
  clearTokens();
}
