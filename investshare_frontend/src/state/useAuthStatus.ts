import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);      // other tabs
  window.addEventListener("auth:changed", callback); // same tab
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("auth:changed", callback);
  };
}

function getSnapshot() {
  return !!localStorage.getItem("access");
}

export function useAuthStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
