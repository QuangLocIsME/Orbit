// Config v1.0.60
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // This app is primarily authenticated and dynamic, so server output is the stable default.
  output: 'server',
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
