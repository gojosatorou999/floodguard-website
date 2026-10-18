import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, "VITE_");

  // The browser calls Supabase at /sb/* on our own origin (several Indian
  // ISPs block *.supabase.co). In production vercel.json's rewrite forwards
  // it; in dev and preview this proxy does the same job.
  const proxy = env.VITE_SUPABASE_URL
    ? {
        "/sb": {
          target: env.VITE_SUPABASE_URL,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/sb/, ""),
        },
      }
    : undefined;

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { proxy },
    preview: { proxy },
    build: {
      rollupOptions: {
        input: {
          // The live marketing page — a self-contained static document.
          main: resolve(here, "index.html"),
          // The React scaffold, still buildable at /app.html while it's filled in.
          app: resolve(here, "app.html"),
          // District dashboard, behind the lead form (assets/js/lead.js).
          district: resolve(here, "district.html"),
          // Full Products detail, split out of the homepage.
          products: resolve(here, "products.html"),
          // Solutions: the overview, and one page per sector.
          solutions: resolve(here, "solutions.html"),
          "solutions/insurance": resolve(here, "solutions/insurance.html"),
          "solutions/banking": resolve(here, "solutions/banking.html"),
          "solutions/agriculture": resolve(here, "solutions/agriculture.html"),
          "solutions/infrastructure": resolve(here, "solutions/infrastructure.html"),
          "solutions/government": resolve(here, "solutions/government.html"),
          // Platform: data, technology, methodology, validation, API.
          platform: resolve(here, "platform.html"),
          // Insights (posts from assets/js/posts.js) and About.
          insights: resolve(here, "insights.html"),
          about: resolve(here, "about.html"),
          // Contact us: details + enquiry form (writes to Supabase public.enquiries).
          contact: resolve(here, "contact.html"),
        },
      },
    },
  };
});
