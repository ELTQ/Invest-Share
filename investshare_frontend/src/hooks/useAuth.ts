import { apiFetch, post } from "@/lib/api";
import { auth } from "@/state/auth";
import { guest } from "@/state/guest";

export async function login(username: string, password: string) {
  const data = await post<{ access: string; refresh: string }>("/auth/login/", { username, password });
  auth.set(data);
  guest.set(false);
  return data;
}
export async function register(username: string, email: string, password: string) {
  guest.set(false);
  return post("/auth/register/", { username, email, password });
}
export async function me() {
  return apiFetch<{ id: number; username: string; email: string; bio: string; avatar_url: string }>("/auth/me/");
}
export function logout() {
  auth.clear();
  guest.set(false);
}
