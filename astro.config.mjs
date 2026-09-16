import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import pwa from "./integrations/pwa.mjs";

export default defineConfig({
  site: "https://routine.himetsai.com",
  output: "static",
  adapter: vercel(),
  integrations: [
    react(),
    pwa({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Routine",
        short_name: "Routine",
        description: "Ray's routine — streaks, grades, and a heatmap.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallbackDenylist: [/^\/api\//, /^\/_actions\//, /^\/export\./],
      },
    }),
  ],
  devToolbar: { enabled: false },
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: "server", access: "secret", default: "file:local.db" }),
      DATABASE_AUTH_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      ROUTINE_PASSPHRASE: envField.string({ context: "server", access: "secret" }),
      SESSION_SECRET: envField.string({ context: "server", access: "secret" }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    logLevel: "error",
  },
});
