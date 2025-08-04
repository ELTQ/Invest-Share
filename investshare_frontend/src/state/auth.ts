export type Tokens = { access: string; refresh: string };

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";

function broadcastAuthChange() {
  // Let components know localStorage changed (same tab)
  window.dispatchEvent(new Event("auth:changed"));
}

export const auth = {
  get access() { return localStorage.getItem(ACCESS_KEY) || ""; },
  get refresh() { return localStorage.getItem(REFRESH_KEY) || ""; },
  set(t: Tokens) {
    localStorage.setItem(ACCESS_KEY, t.access);
    localStorage.setItem(REFRESH_KEY, t.refresh);
    broadcastAuthChange();
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    broadcastAuthChange();
  }
};
