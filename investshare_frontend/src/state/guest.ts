// src/state/guest.ts
const KEY = "guest_mode";

function broadcast() {
  window.dispatchEvent(new Event("guest:changed"));
}

export const guest = {
  get enabled() {
    return localStorage.getItem(KEY) === "1";
  },
  set(value: boolean) {
    if (value) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
    broadcast();
  },
};

export function subscribeGuest(cb: () => void) {
  const h = () => cb();
  window.addEventListener("storage", h);
  window.addEventListener("guest:changed", h);
  return () => {
    window.removeEventListener("storage", h);
    window.removeEventListener("guest:changed", h);
  };
}

// React hook for reactive reads
import { useSyncExternalStore } from "react";
export function useGuestStatus() {
  return useSyncExternalStore(
    subscribeGuest,
    () => guest.enabled,
    () => guest.enabled
  );
}
