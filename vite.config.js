import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // base "./" permite que el build funcione desde cualquier ruta relativa
  base: "./",
  build: {
    outDir: "docs",
    sourcemap: false,
  },
  server: {
    port: 8301,
    open: true,
  },
});
