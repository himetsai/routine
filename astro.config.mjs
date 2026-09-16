import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://routine.himetsai.com",
  output: "static",
  adapter: vercel(),
  integrations: [react()],
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
