import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { App as CapApp } from "@capacitor/app";

// After a new publish, an open tab may request page files that no longer exist.
// Reload once to pick up the latest version instead of showing a blank screen.
if (typeof window !== "undefined" && !(window as any).__nestlingChunkGuard) {
  (window as any).__nestlingChunkGuard = true;
  const KEY = "nestling-chunk-reload";
  const recover = (msg: string) => {
    if (!/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)) return;
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 10000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); recover("dynamically imported module"); });
  window.addEventListener("unhandledrejection", (e) => recover(String((e as PromiseRejectionEvent).reason?.message ?? e.reason)));
  window.addEventListener("error", (e) => recover(String(e.message)));
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined" && !(window as any).__nestlingBackRegistered) {
    (window as any).__nestlingBackRegistered = true;
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });
  }

  return router;
};