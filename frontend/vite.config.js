import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Semua request /api diteruskan ke Gateway (port 3000).
const proxy = { '/api': { target: 'http://localhost:3000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy }, // host: true -> bisa dibuka dari HP lewat IP laptop
  preview: { port: 5173, host: true, proxy },
});
