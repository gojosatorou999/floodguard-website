import { defineConfig, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const here = fileURLToPath(new URL(".", import.meta.url));

/** Fills the %WEBINAR_URL% token in the page from webinar.config.json (same trick as the main site). */
function webinarUrl(): Plugin {
  const cfgPath = resolve(here, "webinar.config.json");
  return {
    name: "floodguard-webinar-url",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const url: string = JSON.parse(readFileSync(cfgPath, "utf8")).url;
        return html.split("%WEBINAR_URL%").join(url.replace(/&/g, "&amp;"));
      },
    },
  };
}

export default defineConfig({
  plugins: [webinarUrl()],
  build: {
    // MapLibre + deck.gl + Three.js are big; keep each library in its own cacheable file
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/maplibre-gl")) return "vendor-maplibre";
          if (id.includes("node_modules/three")) return "vendor-three";
          if (id.includes("node_modules/@deck.gl") || id.includes("node_modules/@luma.gl") || id.includes("node_modules/@math.gl") || id.includes("node_modules/@loaders.gl") || id.includes("node_modules/h3-js")) return "vendor-deck";
        },
      },
      input: { studio: resolve(here, "studio.html") },
    },
  },
});
