
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Keep the existing TanStack Start server entry.
    server: { entry: "server" },
  },
  vite: {
    // Bundle RevenueCat for SSR to avoid Node.js extensionless-import errors.
    ssr: {
      noExternal: ["@revenuecat/purchases-capacitor"],
    },
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false,
        filename: "sw.js",
        // Use Vite's configured output directory.
        devOptions: { enabled: false },
        workbox: {
          // Scan the directory containing the final public assets.
          globDirectory: ".output/public",
          globPatterns: [
            "**/*.{js,css,png,svg,ico,woff,woff2,webmanifest}",
          ],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // Preserve reminder notification handling.
          importScripts: ["/notify-sw.js"],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/api/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "pages",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 30 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: {
                cacheName: "assets",
                expiration: { maxEntries: 200 },
              },
            },
            {
              urlPattern: ({ url }) =>
                /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname),
              handler: "CacheFirst",
              options: {
                cacheName: "fonts",
                expiration: { maxEntries: 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
