// Config v1.0.60
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env variables for use in config (không cần PUBLIC_ prefix ở đây)
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const BACKEND_URL = env.BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  // Astro 6: output:'static' (default) already supports per-page SSR via `export const prerender = false`
  // Node adapter handles SSR pages in production
  output: 'static',
  adapter: node({ mode: 'middleware' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'socket.io-client'],
    },
    server: {
      proxy: {
        '/api': {
          target: BACKEND_URL,
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
