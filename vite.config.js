import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { pageWeight } from "./vite-plugin-weight.js";

export default defineConfig({
  plugins: [svelte(), pageWeight()],
  server: { port: 5173 },
});
