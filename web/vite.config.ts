import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { parse } from "dotenv";
import { defineConfig } from "vite";

// `shared/*.ts` lives outside web/ and has no node_modules of its own
// (LOCKED layout, PROJECT.md C-01). Bare-specifier resolution normally
// walks up from the *importing file's* directory, which would never reach
// web/node_modules for a file under shared/. Alias the one package shared/
// files import so `shared/instant.schema.ts` / `shared/instant.perms.ts`
// resolve `@instantdb/svelte` from web/node_modules at build time.
const instantdbSveltePath = fileURLToPath(
  new URL("./node_modules/@instantdb/svelte", import.meta.url),
);

// Vite's built-in env loader only recognizes `.env`, `.env.local`,
// `.env.[mode]`, `.env.[mode].local` — the locked filename `.env.instantdb`
// (see PROJECT.md C-01) is invisible to it. Parse it manually into a local
// constant instead of calling `dotenv.config()` / mutating `process.env` /
// using Vite's `loadEnv`/`envPrefix`, because the same file also holds
// `INSTANT_APP_ADMIN_TOKEN` and any broad injection would bake an
// admin-bypassing credential into the browser bundle (threat T-01-02).
const envPath = fileURLToPath(new URL("../.env.instantdb", import.meta.url));

let appId: string | undefined;

// Cloudflare Pages (and any other environment where the gitignored
// .env.instantdb file never exists on disk) has no way to reach the
// parsed-file branch above. Fall back to a real environment variable
// configured in the Cloudflare Pages dashboard instead. This is safe
// because the app id is not secret (already public in the client bundle,
// per the comment above) and INSTANT_APP_ADMIN_TOKEN is deliberately never
// sourced from process.env anywhere in this file -- this is the only
// process.env read in this file, and it reads only the app id key.
if (existsSync(envPath)) {
  const parsed = parse(readFileSync(envPath));
  appId = parsed.NEXT_PUBLIC_INSTANT_APP_ID ?? parsed.INSTANT_APP_ID;
} else {
  appId = process.env.VITE_INSTANT_APP_ID;
}

if (!appId) {
  throw new Error(
    `Missing InstantDB app id: expected NEXT_PUBLIC_INSTANT_APP_ID (or INSTANT_APP_ID) in ${envPath}, or VITE_INSTANT_APP_ID in process.env as a Cloudflare Pages fallback`,
  );
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  resolve: {
    alias: {
      "@instantdb/svelte": instantdbSveltePath,
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
    },
  },
  define: {
    "import.meta.env.VITE_INSTANT_APP_ID": JSON.stringify(appId),
  },
});
