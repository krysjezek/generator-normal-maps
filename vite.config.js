import { cloudflare } from '@cloudflare/vite-plugin';
import { sites } from '@openai/sites-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sites(),
    cloudflare({
      viteEnvironment: { name: 'server' },
      config: {
        name: 'normal-map-studio',
        main: './worker/index.js',
        compatibility_date: '2026-08-20',
        assets: {
          binding: 'ASSETS',
          not_found_handling: 'single-page-application',
        },
      },
    }),
  ],
});
