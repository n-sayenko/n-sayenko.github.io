import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const root = import.meta.dirname;

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
