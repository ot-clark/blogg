import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { parseISO, format } from 'date-fns';

const parser = new Parser();

// User agent to avoid being blocked
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function scrapeWebsite(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const posts = [];

    // Try to find RSS feed first
    const rssLink = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').attr('href');
    
    if (rssLink) {
      const fullRssUrl = new URL(rssLink, url).href;
      try {
        const feed = await parser.parseURL(fullRssUrl);
        return {
          feed: {
            title: feed.title || 'Unknown Feed',
            description: feed.description || '',
            url: url,
          },
          posts: feed.items.map(item => ({
            title: item.title || 'Untitled',
            content: item.content || item.contentSnippet || '',
            excerpt: item.contentSnippet || item.content?.substring(0, 200) || '',
            author: item.creator || item.author || '',
            published_at: item.pubDate ? parseISO(item.pubDate) : new Date(),
            url: item.link || '',
            image_url: extractImageFromContent(item.content) || '',
          }))
        };
      } catch (rssError) {
        console.log('RSS parsing failed, falling back to HTML scraping');
      }
    }

    // Fallback to HTML scraping
    const scrapedPosts = scrapePostsFromHTML($, url);
    
    return {
      feed: {
        title: $('title').text() || 'Unknown Blog',
        description: $('meta[name="description"]').attr('content') || '',
        url: url,
      },
      posts: scrapedPosts
    };
  } catch (error) {
    console.error('Error scraping website:', error);
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
}

function scrapePostsFromHTML($, baseUrl) {
  const posts = [];
  
  // Common selectors for blog posts
  const selectors = [
    'article',
    '.post',
    '.blog-post',
    '.entry',
    '[class*="post"]',
    '[class*="article"]',
    '[class*="entry"]',
    '.content article',
    'main article',
  ];

  let articles = null;
  for (const selector of selectors) {
    articles = $(selector);
    if (articles.length > 0) break;
  }

  if (!articles || articles.length === 0) {
    // Fallback: look for any links that might be blog posts
    articles = $('a[href*="/blog"], a[href*="/post"], a[href*="/article"]').parent();
  }

  articles.each((i, element) => {
    const $article = $(element);
    
    // Extract title
    const title = $article.find('h1, h2, h3, .title, .post-title, .entry-title').first().text().trim();
    
    // Extract link
    const link = $article.find('a').first().attr('href');
    const fullUrl = link ? new URL(link, baseUrl).href : '';
    
    // Extract excerpt/content
    const excerpt = $article.find('.excerpt, .summary, .content, p').first().text().trim();
    
    // Extract author
    const author = $article.find('.author, .byline, [class*="author"]').text().trim();
    
    // Extract date
    const dateText = $article.find('.date, .published, time, [class*="date"]').text().trim();
    const published_at = dateText ? new Date(dateText) : new Date();
    
    // Extract image
    const image = $article.find('img').first().attr('src');
    const imageUrl = image ? new URL(image, baseUrl).href : '';

    if (title && fullUrl) {
      posts.push({
        title,
        content: excerpt,
        excerpt: excerpt.substring(0, 200),
        author,
        published_at,
        url: fullUrl,
        image_url: imageUrl,
      });
    }
  });

  return posts.slice(0, 10); // Limit to 10 posts
}

function extractImageFromContent(content) {
  if (!content) return '';
  const $ = cheerio.load(content);
  const img = $('img').first();
  return img.attr('src') || '';
} 