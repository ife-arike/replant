import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://blog.projectreplant.org',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/_'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
    },
  },
})
