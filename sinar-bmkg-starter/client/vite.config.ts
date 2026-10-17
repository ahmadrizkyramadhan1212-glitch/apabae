import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: /api diteruskan ke Express di port 4000 sehingga cookie berjalan satu origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/berkas': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
