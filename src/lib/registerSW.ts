// Single guarded registration point for the offline service worker.
function refused() {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = location.hostname;
  const bad = (d: string) => h === d || h.endsWith(`.${d}`);
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    bad("lovableproject.com") ||
    bad("lovableproject-dev.com") ||
    bad("beta.lovable.dev") ||
    new URLSearchParams(location.search).get("sw") === "off"
  );
}

export async function registerAppSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
    );
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    // Warm the page cache so the app opens offline next time.
    void Promise.allSettled([fetch("/"), fetch(location.pathname)]);
  } catch {
    /* ignore */
  }
}
