import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/war-is-peace-the-eye/',
  plugins: [react()],
  server: {
    port: 8080,
    host: true,
  },
});
