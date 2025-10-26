import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/auth/triviasignup": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/auth/trivia-signin": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/auth": {
        target: "https://topclubfantasy.com",
        changeOrigin: true,
        secure: true,
        // keep the same path: /api/auth/signup -> https://topclubfantasy.com/api/auth/signup
        rewrite: (path) => path.replace(/^\/api\/auth/, "/api/auth"),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean,
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
