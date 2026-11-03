import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Aperçu : relaie /api et /ws vers le backend exposé par ngrok.
    proxy: {
      "/api": {
        target: "https://stateless-dryadic-marylouise.ngrok-free.dev",
        changeOrigin: true,
        secure: true,
        headers: { "ngrok-skip-browser-warning": "true" },
      },
      "/ws": {
        target: "https://stateless-dryadic-marylouise.ngrok-free.dev",
        changeOrigin: true,
        secure: true,
        ws: true,
        headers: { "ngrok-skip-browser-warning": "true" },
      },
    },
  },
  build: {
    // Aucune carte de source publiée en production.
    sourcemap: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
