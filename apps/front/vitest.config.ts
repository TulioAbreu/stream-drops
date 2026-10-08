import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@stream-drops/subathon-protocol": path.resolve(
        __dirname,
        "../../packages/subathon-protocol/src/index.ts",
      ),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./test-setup.ts"],
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      }),
      instances: [{ browser: "chromium" }],
    },
  },
});
