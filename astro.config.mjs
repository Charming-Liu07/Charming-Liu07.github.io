import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://charming-liu07.github.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
