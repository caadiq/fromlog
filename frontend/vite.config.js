import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 80,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://fromlog-backend:80",
        changeOrigin: true,
      },
      "/docs": {
        target: "http://fromlog-backend:80",
        changeOrigin: true,
      },
    },
  },
});
