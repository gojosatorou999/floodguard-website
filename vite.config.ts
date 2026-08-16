import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      input: {
        // The live marketing page — a self-contained static document.
        main: resolve(here, "index.html"),
        // The React scaffold, still buildable at /app.html while it's filled in.
        app: resolve(here, "app.html"),
      },
    },
  },
});
