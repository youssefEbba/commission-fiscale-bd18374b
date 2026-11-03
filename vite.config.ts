import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    // Aucune carte de source publiée en production.
    sourcemap: false,
  },
  plugins: [react()],
  optimizeDeps: {
    include: [
      "i18next",
      "i18next-browser-languagedetector",
      "react-i18next",
      "react-router-dom",
      "@tanstack/react-query",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
