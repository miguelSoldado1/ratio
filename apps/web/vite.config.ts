import { fileURLToPath, URL } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootEnvDir = fileURLToPath(new URL("../..", import.meta.url));

const config = defineConfig(({ command, mode }) => {
  const useCloudflareRuntime = command === "build" || mode === "cloudflare";

  if (!useCloudflareRuntime) {
    loadRootEnvironment(mode);
  }

  return {
    envDir: rootEnvDir,
    resolve: {
      alias: {
        "@/env": fileURLToPath(new URL("./env.ts", import.meta.url)),
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      tsconfigPaths: true,
    },
    plugins: [
      devtools(),
      ...(useCloudflareRuntime ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  };
});

function loadRootEnvironment(mode: string) {
  for (const [key, value] of Object.entries(loadEnv(mode, rootEnvDir, ""))) {
    process.env[key] ??= value;
  }
}

export default config;
