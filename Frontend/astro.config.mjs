// Config v1.0.60
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',')
  : ['localhost', '127.0.0.1'];

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'socket.io-client'],
    },
    server: {
      host: '0.0.0.0',
      allowedHosts,
    },
    resolve: {
      preserveSymlinks: true,
      alias: [
        { find: 'astro/entrypoints/prerender', replacement: path.resolve(__dirname, './node_modules/astro/dist/entrypoints/prerender.js') },
        { find: '@/components/ui', replacement: path.resolve(__dirname, './components/ui') },
        { find: '@/lib/utils', replacement: path.resolve(__dirname, './lib/utils') },
        { find: '@', replacement: path.resolve(__dirname, './src') }
      ]
    }
  }
});
