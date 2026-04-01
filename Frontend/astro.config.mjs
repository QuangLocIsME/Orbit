// Config v1.0.59
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        { find: '@/components/ui', replacement: path.resolve(__dirname, './components/ui') },
        { find: '@/lib/utils', replacement: path.resolve(__dirname, './lib/utils') },
        { find: '@', replacement: path.resolve(__dirname, './src') }
      ]
    }
  }
});
