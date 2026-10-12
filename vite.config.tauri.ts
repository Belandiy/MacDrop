import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Clean Vite config for Tauri (pure React SPA without Electron plugins)
export default defineConfig({
  root: path.join(__dirname, 'src/renderer'),
  publicDir: path.join(__dirname, 'public'),
  plugins: [
    react()
  ],
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    cssCodeSplit: true,
    minify: 'esbuild'
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1'
  }
});
