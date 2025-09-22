import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173 // Asegúrate de que coincide con el puerto de desarrollo
    },
    watch: {
      usePolling: true // Necesario en algunos entornos (ej: WSL2)
    }
  }
})
