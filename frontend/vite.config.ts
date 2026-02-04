import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      Components: resolve(__dirname, "src/components"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/countries": { target: "http://localhost:8080", changeOrigin: true },
      "/visits": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
