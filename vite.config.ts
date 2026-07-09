import { fileURLToPath, URL } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig(({ command, mode }) => {
  const useCloudflareRuntime = command === "build" || mode === "cloudflare";

  return {
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

export default config;
