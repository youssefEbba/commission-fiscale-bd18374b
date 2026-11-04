import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Backend visé par le proxy de `npm run dev`. Par défaut le serveur local (127.0.0.1:8081) ; chacun
 * peut viser un autre backend, par exemple le tunnel ngrok, dans un fichier `.env.local` non suivi
 * par Git (règle `*.local`) : `API_PROXY_TARGET=https://….ngrok-free.dev`. Sans effet sur le build.
 */
const proxyVers = (target: string) => ({
  target,
  changeOrigin: true,
  secure: true,
  // ngrok intercale une page d'avertissement sans cet en-tête.
  headers: target.includes("ngrok") ? { "ngrok-skip-browser-warning": "true" } : undefined,
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.API_PROXY_TARGET || "http://127.0.0.1:8081";
  return {
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": proxyVers(backend),
      "/ws": { ...proxyVers(backend), ws: true },
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
  };
});
