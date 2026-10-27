import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { catalogueApi } from "./server/api.ts";
export default defineConfig({
  plugins: [react(), catalogueApi(process.cwd())],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    css: false,
    clearMocks: true,
  },
});
