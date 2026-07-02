import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'

export async function GET(context) {
  const all = await getCollection('posts', ({ data }) => data.draft !== true)
  const sorted = all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())

  return rss({
    title: 'Replant Blog',
    description: 'Letters, scripture, and field reports from Replant.',
    site: context.site,
    items: sorted.map((post) => ({
      title: post.data.title.replace(/<\/?em>/g, ''),
      pubDate: post.data.date,
      description: post.data.summary,
      author: post.data.author,
      link: `/posts/${post.id.replace(/\.(md|mdx)$/, '')}/`,
    })),
    customData: '<language>en-us</language>',
  })
}
