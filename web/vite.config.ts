import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Prefijo bajo el que se publica la SPA. En producción, detrás del proxy de
// Apache (`<Location /infodata>`), se compila con VITE_BASE_PATH=/infodata/ para
// que los assets y el router usen esa base. En dev queda en "/".
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
  },
});
