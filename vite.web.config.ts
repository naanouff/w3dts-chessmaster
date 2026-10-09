/**
 * @file vite.web.config.ts
 * @project w3dts
 * @description Static Vite build of the renderer for Vercel (no Electron main/preload).
 */
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve('src/renderer'),
  publicDir: resolve('public'),
  plugins: [react()],
  build: {
    outDir: resolve('out/renderer'),
    emptyOutDir: true,
  },
  server: {
    fs: {
      allow: [resolve('.')],
    },
  },
});
