// Trimmed from @vite-pwa/astro (MIT, https://github.com/vite-pwa/astro), whose
// published peer range predates Astro 7. Runs vite-plugin-pwa inside Astro's
// client build environment, then generates the service worker in
// `astro:build:done` — after Astro has written its HTML, before the Vercel
// adapter copies the client directory to `.vercel/output/static`.
import { fileURLToPath } from "node:url";
import { VitePWA } from "vite-plugin-pwa";

/** @param {import('vite-plugin-pwa').VitePWAOptions} options */
export default function pwa(options) {
  const ctx = { api: undefined, build: false };
  let pwaOptions;

  /** @type {import('workbox-build').ManifestTransform} */
  const htmlToRoutes = async (entries) => {
    if (ctx.build) {
      for (const e of entries) {
        if (!e.url.endsWith(".html")) continue;
        const url = e.url.replace(/^\//, "");
        e.url = url === "index.html" ? "/" : url.replace(/\/index\.html$/, "").replace(/\.html$/, "");
      }
    }
    return { manifest: entries, warnings: [] };
  };

  return {
    name: "pwa",
    hooks: {
      "astro:config:setup": ({ command, config, updateConfig }) => {
        if (command === "preview" || command === "sync") return;
        const assets = `${(config.build.assets ?? "_astro/").replace(/^\//, "").replace(/\/$/, "")}/`;
        pwaOptions = {
          includeManifestIcons: false,
          ...options,
          workbox: {
            navigateFallback: "/",
            directoryIndex: "index.html",
            dontCacheBustURLsMatching: new RegExp(assets),
            manifestTransforms: [htmlToRoutes],
            ...options.workbox,
          },
        };
        const plugins = VitePWA(pwaOptions).filter(
          (p) => p.name !== "vite-plugin-pwa:build" && (command !== "build" || p.name !== "vite-plugin-pwa:dev-sw"),
        );
        if (command === "build") {
          plugins.push({
            name: "pwa:astro:build",
            applyToEnvironment: (env) => env.name === "client",
            configResolved(resolved) {
              ctx.api = resolved.plugins.flat(Infinity).find((p) => p.name === "vite-plugin-pwa")?.api;
            },
            generateBundle(_, bundle) {
              ctx.api?.generateBundle(bundle, this);
            },
          });
        }
        updateConfig({ vite: { plugins } });
      },
      "astro:config:done": ({ config, buildOutput }) => {
        // Where the client files land: `dist/client` when any route is on-demand, else `dist`.
        // The plugin reads these options lazily, at Vite config resolution.
        if (pwaOptions) pwaOptions.outDir = fileURLToPath(buildOutput === "server" ? config.build.client : config.outDir);
      },
      "astro:build:done": async () => {
        ctx.build = true;
        if (ctx.api && !ctx.api.disabled) await ctx.api.generateSW();
      },
    },
  };
}
