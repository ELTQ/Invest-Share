import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import { router } from "@/routes";
import { queryClient } from "@/state/queryClient";
import "@/index.css";

/* ------------------------ Boot info & env exposure ------------------------ */

declare global {
  interface Window {
    API_URL: string;
  }
}

// Make your API base visible in DevTools (use `window.API_URL` in the console)
window.API_URL = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
// One-time boot log so you know the app started with the right env
console.log("[Invest Share] API_URL =", window.API_URL);

/* ------------------------------- UI helpers ------------------------------- */

// Minimal error boundary (no extra deps)
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: undefined };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl p-6">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-text-muted mb-4">
            Please refresh the page. If this keeps happening, let us know.
          </p>
          <pre className="card p-4 overflow-auto text-xs">{String(this.state.error)}</pre>
          <button
            className="mt-4 inline-flex items-center rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
            onClick={() => location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Simple global suspense fallback (appears during lazy loads / data boot)
function AppFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20">
      <div className="card p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-stroke-soft mb-4" />
        <div className="h-3 w-full animate-pulse rounded bg-stroke-soft mb-2" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-stroke-soft" />
      </div>
    </div>
  );
}

/* ---------------------------------- Mount --------------------------------- */

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <React.Suspense fallback={<AppFallback />}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
