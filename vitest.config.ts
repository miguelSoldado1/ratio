import { fileURLToPath, URL } from "node:url";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      "@/env": fileURLToPath(new URL("./env.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@test": fileURLToPath(new URL("./tests/setup", import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    environment: "jsdom",
    fileParallelism: false,
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
  },
});
