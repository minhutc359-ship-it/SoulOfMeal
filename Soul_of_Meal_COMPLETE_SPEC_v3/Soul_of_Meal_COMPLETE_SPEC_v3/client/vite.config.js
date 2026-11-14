import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const client = fileURLToPath(new URL('.', import.meta.url));
const project = resolve(client, '..');
const output = resolve(client, 'dist');
const apiTarget = process.env.SOM_API_TARGET;
const proxy = apiTarget ? { '/api/v1': { target: apiTarget } } : undefined;

export default defineConfig({
  root: project,
  cacheDir: resolve(client, 'node_modules/.vite'),
  base: './',
  publicDir: false,
  define: {
    'import.meta.env.SOM_ACCOUNTS': JSON.stringify(Boolean(apiTarget) || process.env.SOM_ACCOUNTS === '1'),
  },
  server: { proxy },
  preview: { proxy },
  build: {
    outDir: output,
    emptyOutDir: true,
    rollupOptions: { input: resolve(client, 'index.html') },
  },
  plugins: [{
    name: 'soul-of-meal-runtime-data',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{ tag: 'link', attrs: { rel: 'manifest', href: './app.webmanifest' }, injectTo: 'head' }],
    },
    writeBundle() {
      cpSync(resolve(client, 'assets'), resolve(output, 'client/assets'), { recursive: true });
      cpSync(resolve(client, 'app.webmanifest'), resolve(output, 'client/app.webmanifest'));
      mkdirSync(resolve(output, 'examples'), { recursive: true });
      for (const directory of ['cards', 'auto_chess', 'maps']) {
        cpSync(resolve(project, 'examples', directory), resolve(output, 'examples', directory), { recursive: true });
      }
    },
  }],
});
