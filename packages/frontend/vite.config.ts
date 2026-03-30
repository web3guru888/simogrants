import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

// Cloudflare Pages SPA: generate _redirects so all routes serve index.html
function cloudflareSpaPlugin(): Plugin {
  return {
    name: 'cloudflare-spa-redirects',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, '_redirects'), '/*  /index.html  200\n');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflareSpaPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
