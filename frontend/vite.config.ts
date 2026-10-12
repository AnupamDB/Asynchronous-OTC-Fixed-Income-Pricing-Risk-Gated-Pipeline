import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, repositoryRoot, "RFQ_API_KEY");
  const apiKey = environment.RFQ_API_KEY;
  return {
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest) => {
            if (apiKey) proxyRequest.setHeader("X-API-Key", apiKey);
          });
        },
      },
      "/core/health": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        rewrite: () => "/actuator/health",
      },
      "/worker/health": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
        rewrite: () => "/health",
      },
    },
  },
  };
});
