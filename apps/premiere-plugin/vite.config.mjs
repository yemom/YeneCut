import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: "esnext",
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
      external: ["os", "premierepro", "uxp"],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
