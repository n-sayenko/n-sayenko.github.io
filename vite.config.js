import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const root = import.meta.dirname;

// Multi-page build rather than a client-side router: each page is a real
// file on disk, so GitHub Pages serves /art/ and /projects/ directly with
// no 404.html SPA-fallback trick and no router dependency.
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(root, "index.html"),
        art: resolve(root, "art/index.html"),
        projects: resolve(root, "projects/index.html"),
      },
    },
  },
});
