// Config v1.0.60
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Astro 6: output:'static' (default) already supports per-page SSR via `export const prerender = false`
  // Node adapter handles SSR pages in production
  output: 'static',
  adapter: node({ mode: 'middleware' }),
  integrations: [react()],
  vite: {
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'socket.io-client'],
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: [
        { find: '@/components/ui', replacement: path.resolve(__dirname, './components/ui') },
        { find: '@/lib/utils', replacement: path.resolve(__dirname, './lib/utils') },
        { find: '@', replacement: path.resolve(__dirname, './src') }
      ]
    }
  }
});
