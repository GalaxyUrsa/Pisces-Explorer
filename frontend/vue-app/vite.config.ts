import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/static/vue-dist/",
  plugins: [vue()],
  build: {
    outDir: "../vue-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        explorer: fileURLToPath(new URL("./explorer.html", import.meta.url)),
        region: fileURLToPath(new URL("./region.html", import.meta.url)),
        simulator: fileURLToPath(new URL("./simulator.html", import.meta.url)),
        inference: fileURLToPath(new URL("./inference.html", import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/region/api": "http://127.0.0.1:8000",
      "/static": "http://127.0.0.1:8000",
    },
  },
});
