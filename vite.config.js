import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/war-is-peace-the-eye/',
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
  server: {
    port: 8080,
    host: true,
    allowedHosts: ['the-eye.ngrok.app']
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Suppress all Sass warnings from dependencies
        quietDeps: true,
        // (Optional) Suppress specific deprecation warnings
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
});
