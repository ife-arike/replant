import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string().optional(),
    date: z.coerce.date(),
    author: z.string().default('Replant'),
    summary: z.string(),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
})

export const collections = { posts }
