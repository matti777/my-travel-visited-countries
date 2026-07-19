import type { Connect } from "vite";
import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

/** Serve index.html for client route /share/<token> (not API /share/visits/...). */
function spaShareRoutesMiddleware(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const raw = req.url ?? "";
    const pathOnly = raw.split("?")[0] ?? "";
    if (
      req.method === "GET" &&
      pathOnly.startsWith("/share/") &&
      !pathOnly.startsWith("/share/visits/")
    ) {
      req.url = "/index.html" + (raw.includes("?") ? "?" + raw.split("?").slice(1).join("?") : "");
    }
    next();
  };
}

export default defineConfig({
  plugins: [
    {
      name: "spa-share-routes",
      configureServer(server) {
        server.middlewares.use(spaShareRoutesMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(spaShareRoutesMiddleware());
      },
    },
    viteStaticCopy({
      targets: [
        { src: "assets/images/*", dest: "assets/images" },
        { src: "css/main.css", dest: "css" },
      ],
    }),
  ],
  resolve: {
    alias: {
      Components: resolve(__dirname, "src/components"),
    },
  },
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
    },
    proxy: {
      "/countries": { target: "http://localhost:8080", changeOrigin: true },
      "/login": { target: "http://localhost:8080", changeOrigin: true },
      "/share/visits": { target: "http://localhost:8080", changeOrigin: true },
      "/visits": { target: "http://localhost:8080", changeOrigin: true },
      "/friends": { target: "http://localhost:8080", changeOrigin: true },
      "/settings": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "esbuild",
    cssMinify: true,
    sourcemap: false,
  },
});
