import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/clickup-api': {
        target: 'https://api.clickup.com/api/v2',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/clickup-api/, ''),
      },
    },
  },
});
