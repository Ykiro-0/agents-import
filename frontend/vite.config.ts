import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "../dist/client"),
    emptyOutDir: false
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/downloads": "http://localhost:3000"
    }
  }
});
