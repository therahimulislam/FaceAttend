/**
 * FaceAttend — App Root
 * Phase 19: Added PWA service-worker update toast.
 */
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useRegisterSW } from "virtual:pwa-register/react";
import { router } from "@/routes";
import { queryClient } from "@/lib/queryClient";

// ---------------------------------------------------------------------------
// SW Update Toast
// ---------------------------------------------------------------------------
function SWUpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (import.meta.env.DEV) console.log("[PWA] SW Registered:", r);
    },
    onRegisterError(error: unknown) {
      if (import.meta.env.DEV) console.error("[PWA] SW Registration error:", error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      id="sw-update-toast"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1.25rem",
        background: "#1e293b",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        color: "#f1f5f9",
        fontSize: "0.875rem",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      <span>🚀 New version available</span>
      <button
        id="sw-update-btn"
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: "0.35rem 0.9rem",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "8px",
          color: "white",
          fontSize: "0.8rem",
          cursor: "pointer",
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        Refresh
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      <SWUpdateToast />
    </QueryClientProvider>
  );
}
