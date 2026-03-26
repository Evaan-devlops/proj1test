import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve(__dirname, "public");

function hasPublicFile(fileName: string): boolean {
  return fs.existsSync(path.join(publicDir, fileName));
}

const optionalPublicAssets = ["favicon.ico", "apple-touch-icon.png", "og.png"].filter(hasPublicFile);
const optionalManifestIcons = [
  hasPublicFile("pwa-192.png") ? { src: "/pwa-192.png", sizes: "192x192", type: "image/png" } : null,
  hasPublicFile("pwa-512.png") ? { src: "/pwa-512.png", sizes: "512x512", type: "image/png" } : null,
].filter((icon): icon is { src: string; sizes: string; type: string } => icon !== null);

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: optionalPublicAssets,
      manifest: {
        name: "Chat App",
        short_name: "ChatApp",
        description: "ChatGPT-like chat app",
        theme_color: "#0b1220",
        background_color: "#0b1220",
        display: "standalone",
        start_url: "/",
        icons: optionalManifestIcons,
      },
    }),
    visualizer({
      filename: "dist/bundle-stats.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
