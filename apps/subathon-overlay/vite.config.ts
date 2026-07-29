import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@stream-drops/subathon-protocol": path.resolve(
        __dirname,
        "../../packages/subathon-protocol/src/index.ts",
      ),
    },
  },
  build: {
    outDir: "../subathon-server/public/overlay",
    emptyOutDir: true,
  },
});
