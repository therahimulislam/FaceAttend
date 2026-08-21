import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/*.png",
        "icons/*.svg",
        "offline.html",
      ],

      // -----------------------------------------------------------------------
      // Web App Manifest (Phase 19)
      // -----------------------------------------------------------------------
      manifest: {
        name: "FaceAttend",
        short_name: "FaceAttend",
        description: "Smart Attendance. Verified Presence. Facial recognition attendance for universities.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/?source=pwa",
        lang: "en",
        categories: ["education", "productivity"],

        icons: [
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],

        // App shortcuts for quick access from the home screen long-press menu
        shortcuts: [
          {
            name: "Mark Attendance",
            short_name: "Attendance",
            description: "Quickly mark your attendance",
            url: "/student/attendance?source=shortcut",
            icons: [{ src: "icons/icon-192x192.png", sizes: "192x192" }],
          },
          {
            name: "AI Insights",
            short_name: "AI",
            description: "View your attendance risk insights",
            url: "/student/ai-insights?source=shortcut",
            icons: [{ src: "icons/icon-192x192.png", sizes: "192x192" }],
          },
        ],

        // Screenshots for Play Store / App Store listings
        screenshots: [
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "narrow",
            label: "FaceAttend Student Dashboard",
          },
        ],
      },

      // -----------------------------------------------------------------------
      // Workbox Service Worker Strategy (Phase 19)
      // -----------------------------------------------------------------------
      workbox: {
        // Pre-cache all build artifacts
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],

        // Offline fallback: serve offline.html when network is unavailable
        navigateFallback: "/offline.html",
        // Don't intercept API calls with the navigation fallback
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],

        runtimeCaching: [
          // Cache Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Cache Google Fonts files
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // API responses: NetworkFirst (fresh data, fallback to cache)
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // Dev options: show the SW in development for testing
      devOptions: {
        enabled: false, // Only enable when explicitly testing SW
        type: "module",
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
