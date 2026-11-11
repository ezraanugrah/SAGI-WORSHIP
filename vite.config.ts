import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
// TB from Alkitab SABDA: same address as vercel.json uses in production.
const sabda = {
  "/api/sabda": {
    target: "https://alkitab.sabda.org",
    changeOrigin: true,
    rewrite: (path: string) =>
      path.replace(/^\/api\/sabda/, "/api/passage.php"),
  },
};
export default defineConfig({
  server: { proxy: sabda },
  preview: { proxy: sabda },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "SAGI WORSHIP",
        short_name: "SAGI",
        description: "Ruang kerja presentasi ibadah offline",
        lang: "id",
        theme_color: "#111316",
        background_color: "#111316",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: [
          "**/*.{js,mjs,css,html,svg,png,webmanifest,bcmap,pfb,ttf,wasm,icc}",
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "/index.html",
        // A new version takes over as soon as it is installed, even while
        // another SAGI window is open, so no window can keep an old copy
        // forever. Open pages are not reloaded; the operator reloads when
        // the service is over (see the update banner).
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
});
