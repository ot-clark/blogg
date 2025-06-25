import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { parseISO, format, isValid } from 'date-fns';

const parser = new Parser();

// User agent to avoid being blocked
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Helper function to parse dates more robustly
function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Try parsing with date-fns first
    const parsed = parseISO(dateString);
    if (isValid(parsed)) {
      return parsed;
    }
    
    // Try native Date constructor
    const nativeDate = new Date(dateString);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate;
    }
    
    // Try common date formats
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY or Month DD YYYY
      /(\d{1,2})\s+(\w+)\s+(\d{4})/, // DD Month YYYY
    ];
    
    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        let year, month, day;
        
        if (format.source.includes('\\w+')) {
          // Handle text month formats
          const monthNames = {
            'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
            'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'july': 6, 'august': 7, 'aug': 7,
            'september': 8, 'sep': 8, 'october': 9, 'oct': 9, 'november': 10, 'nov': 10,
            'december': 11, 'dec': 11
          };
          
          if (format.source.includes('Month DD')) {
            // Month DD, YYYY format
            const monthName = match[1].toLowerCase();
            day = parseInt(match[2]);
            year = parseInt(match[3]);
            month = monthNames[monthName];
          } else {
            // DD Month YYYY format
            day = parseInt(match[1]);
            const monthName = match[2].toLowerCase();
            year = parseInt(match[3]);
            month = monthNames[monthName];
          }
        } else {
          // Handle numeric formats
          if (format.source.includes('MM/DD/YYYY')) {
            month = parseInt(match[1]) - 1;
            day = parseInt(match[2]);
            year = parseInt(match[3]);
          } else {
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          }
        }
        
        if (month !== undefined && !isNaN(month) && !isNaN(day) && !isNaN(year)) {
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log('Date parsing failed for:', dateString, error.message);
    return null;
  }
}

// Function to extract main blog URL from a post URL
export function extractBlogUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Handle Substack URLs
    if (urlObj.hostname.includes('substack.com') || urlObj.hostname.includes('.blog')) {
      // For Substack blogs, the main blog URL is typically the domain root
      // Examples: 
      // - https://www.noahpinion.blog/p/the-economic-consequences-of-a-war -> https://www.noahpinion.blog
      // - https://substack.com/home/post/p-165095091 -> https://substack.com
      
      const pathParts = urlObj.pathname.split('/');
      
      // If it's a post URL (contains /p/ or /post/), extract the main blog
      if (pathParts.includes('p') || pathParts.includes('post')) {
        // Return the domain root for Substack blogs
        return `${urlObj.protocol}//${urlObj.hostname}`;
      }
    }
    
    // Handle Medium URLs
    if (urlObj.hostname.includes('medium.com')) {
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.length >= 2 && pathParts[1].startsWith('@')) {
        // This is a Medium author post, extract the author's main page
        return `https://medium.com/${pathParts[1]}`;
      }
    }
    
    // Handle WordPress URLs
    if (urlObj.pathname.includes('/blog/') || urlObj.pathname.includes('/post/') || urlObj.pathname.includes('/article/')) {
      // Try to find the main blog URL by removing post-specific parts
      const pathParts = urlObj.pathname.split('/');
      const blogIndex = pathParts.findIndex(part => ['blog', 'post', 'article'].includes(part));
      if (blogIndex !== -1) {
        const mainPath = pathParts.slice(0, blogIndex + 1).join('/');
        return `${urlObj.protocol}//${urlObj.hostname}${mainPath}`;
      }
    }
    
    // For other URLs, try to find the main blog by looking for common patterns
    const pathParts = urlObj.pathname.split('/');
    if (pathParts.length > 1) {
      // Try to find a reasonable main URL by removing date patterns and post IDs
      const cleanParts = pathParts.filter(part => {
        // Remove date patterns (YYYY/MM/DD or YYYY-MM-DD)
        if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(part)) return false;
        // Remove post IDs (long strings of letters/numbers)
        if (/^[a-zA-Z0-9]{8,}$/.test(part)) return false;
        return true;
      });
      
      if (cleanParts.length > 1) {
        const mainPath = cleanParts.slice(0, 2).join('/');
        return `${urlObj.protocol}//${urlObj.hostname}${mainPath}`;
      }
    }
    
    // Default: return the domain root
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (error) {
    console.error('Error extracting blog URL:', error);
    return url; // Fallback to original URL
  }
}

export async function scrapeWebsite(url) {
  try {
    // First, try to extract the main blog URL if this is a post URL
    const mainBlogUrl = extractBlogUrl(url);
    const isPostUrl = mainBlogUrl !== url;
    
    if (isPostUrl) {
      console.log(`Extracted main blog URL: ${mainBlogUrl} from post URL: ${url}`);
    }
    
    const targetUrl = isPostUrl ? mainBlogUrl : url;
    
    const response = await axios.get(targetUrl, {
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
    const rssUrl = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').attr('href');
    
    if (rssUrl) {
      const fullRssUrl = new URL(rssUrl, targetUrl).href;
      try {
        console.log(`Found RSS feed: ${fullRssUrl}`);
        const feed = await parser.parseURL(fullRssUrl);
        return {
          feed: {
            title: feed.title || 'Unknown Feed',
            description: feed.description || '',
            url: targetUrl,
            originalUrl: isPostUrl ? url : null, // Keep track of original URL if it was a post
          },
          posts: feed.items.map(item => {
            // Robust date parsing
            let published_at = null;
            
            // Try multiple date sources
            const dateSources = [
              item.pubDate,
              item.isoDate,
              item.date,
              item.published,
              item.updated
            ];
            
            for (const dateSource of dateSources) {
              if (dateSource) {
                const parsed = parseDate(dateSource);
                if (parsed) {
                  published_at = parsed;
                  break;
                }
              }
            }
            
            // If no date found, try to extract from content
            if (!published_at && item.content) {
              const dateMatch = item.content.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
              if (dateMatch) {
                const parsed = parseDate(dateMatch[0]);
                if (parsed) {
                  published_at = parsed;
                }
              }
            }
            
            // Final fallback to current date only if absolutely necessary
            if (!published_at) {
              published_at = new Date();
              console.log('Using fallback date for:', item.title);
            }
            
            return {
              title: item.title || 'Untitled',
              content: item.content || item.contentSnippet || '',
              excerpt: item.contentSnippet || item.content?.substring(0, 200) || '',
              author: item.creator || item.author || '',
              published_at: published_at,
              url: item.link || '',
              image_url: extractImageFromContent(item.content) || '',
            };
          })
        };
      } catch (rssError) {
        console.log('RSS parsing failed, falling back to HTML scraping:', rssError.message);
      }
    }

    // For Substack blogs, try to construct RSS URL manually
    if (targetUrl.includes('substack.com') || targetUrl.includes('.blog')) {
      try {
        // Try common Substack RSS patterns
        const rssUrls = [
          `${targetUrl}/feed`,
          `${targetUrl}/rss`,
          `${targetUrl}/feed.xml`,
          `${targetUrl}/rss.xml`
        ];
        
        for (const rssUrl of rssUrls) {
          try {
            console.log(`Trying RSS URL: ${rssUrl}`);
            return await scrapeRssFeed(rssUrl, targetUrl);
          } catch (rssError) {
            console.log(`RSS URL ${rssUrl} failed:`, rssError.message);
            continue;
          }
        }
      } catch (error) {
        console.log('All RSS attempts failed, falling back to HTML scraping');
      }
    }

    // Try RSS feed first
    if (rssUrl) {
      return await scrapeRssFeed(rssUrl, targetUrl);
    }

    // Fallback to HTML scraping
    const scrapedPosts = scrapePostsFromHTML($, targetUrl);
    
    return {
      feed: {
        title: $('title').text() || 'Unknown Blog',
        description: $('meta[name="description"]').attr('content') || '',
        url: targetUrl,
        originalUrl: isPostUrl ? url : null, // Keep track of original URL if it was a post
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
  
  // Substack-specific selectors
  if (baseUrl.includes('substack.com') || baseUrl.includes('.blog')) {
    // Try Substack-specific selectors
    const substackSelectors = [
      'article[data-testid="post-preview"]',
      '.post-preview',
      '[data-testid="post-preview"]',
      '.post',
      'article',
      '.feed-item'
    ];
    
    let articles = null;
    for (const selector of substackSelectors) {
      articles = $(selector);
      if (articles.length > 0) {
        console.log(`Found ${articles.length} posts using selector: ${selector}`);
        break;
      }
    }
    
    if (articles && articles.length > 0) {
      articles.each((i, element) => {
        const $article = $(element);
        
        // Extract title
        const title = $article.find('h1, h2, h3, .title, .post-title, [data-testid="post-title"]').first().text().trim();
        
        // Extract link
        const link = $article.find('a').first().attr('href');
        const fullUrl = link ? new URL(link, baseUrl).href : '';
        
        // Extract excerpt/content
        const excerpt = $article.find('.excerpt, .summary, .content, p, [data-testid="post-excerpt"]').first().text().trim();
        
        // Extract author
        const author = $article.find('.author, .byline, [class*="author"], [data-testid="author"]').text().trim();
        
        // Extract date
        const dateText = $article.find('.date, .published, time, [class*="date"], [data-testid="publish-date"]').text().trim();
        let published_at = null;
        
        if (dateText) {
          published_at = parseDate(dateText);
        }
        
        // If no date found in HTML, try to extract from content
        if (!published_at) {
          const contentText = $article.text();
          const dateMatch = contentText.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
          if (dateMatch) {
            published_at = parseDate(dateMatch[0]);
          }
        }
        
        // Final fallback to current date only if absolutely necessary
        if (!published_at) {
          published_at = new Date();
          console.log('Using fallback date for HTML scraping');
        }
        
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
      
      if (posts.length > 0) {
        return posts.slice(0, 10); // Limit to 10 posts
      }
    }
  }
  
  // Common selectors for blog posts (fallback)
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
    articles = $('a[href*="/blog"], a[href*="/post"], a[href*="/article"], a[href*="/p/"]').parent();
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
    const dateText = $article.find('.date, .published, time, [class*="date"], [data-testid="publish-date"]').text().trim();
    let published_at = null;
    
    if (dateText) {
      published_at = parseDate(dateText);
    }
    
    // If no date found in HTML, try to extract from content
    if (!published_at) {
      const contentText = $article.text();
      const dateMatch = contentText.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (dateMatch) {
        published_at = parseDate(dateMatch[0]);
      }
    }
    
    // Final fallback to current date only if absolutely necessary
    if (!published_at) {
      published_at = new Date();
      console.log('Using fallback date for HTML scraping');
    }
    
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

async function scrapeRssFeed(rssUrl, targetUrl) {
  try {
    console.log('Found RSS feed:', rssUrl);
    const feed = await parser.parseURL(rssUrl);
    
    // Check if we got a reasonable number of posts
    const postCount = feed.items.length;
    console.log(`RSS feed returned ${postCount} posts`);
    
    // If we got very few posts, try to get more from archive pages
    let additionalPosts = [];
    if (postCount < 50 && targetUrl.includes('noahpinion.blog')) {
      console.log('Attempting to scrape additional posts from archive...');
      try {
        additionalPosts = await scrapeArchivePages(targetUrl);
        console.log(`Found ${additionalPosts.length} additional posts from archive`);
      } catch (error) {
        console.log('Archive scraping failed:', error.message);
      }
    }
    
    return {
      feed: {
        title: feed.title || 'Unknown Feed',
        description: feed.description || '',
        url: targetUrl,
        originalUrl: isPostUrl ? url : null, // Keep track of original URL if it was a post
      },
      posts: [
        ...feed.items.map(item => {
          // Robust date parsing
          let published_at = null;
          
          // Try multiple date sources
          const dateSources = [
            item.pubDate,
            item.isoDate,
            item.date,
            item.published,
            item.updated
          ];
          
          for (const dateSource of dateSources) {
            if (dateSource) {
              const parsed = parseDate(dateSource);
              if (parsed) {
                published_at = parsed;
                break;
              }
            }
          }
          
          // If no date found, try to extract from content
          if (!published_at && item.content) {
            const dateMatch = item.content.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
            if (dateMatch) {
              const parsed = parseDate(dateMatch[0]);
              if (parsed) {
                published_at = parsed;
              }
            }
          }
          
          // Final fallback to current date only if absolutely necessary
          if (!published_at) {
            published_at = new Date();
            console.log('Using fallback date for:', item.title);
          }
          
          return {
            title: item.title || 'Untitled',
            content: item.content || item.contentSnippet || '',
            excerpt: item.contentSnippet || item.content?.substring(0, 200) || '',
            author: item.creator || item.author || '',
            published_at: published_at,
            url: item.link || '',
            image_url: extractImageFromContent(item.content) || '',
          };
        }),
        ...additionalPosts
      ]
    };
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
    throw error;
  }
}

// Function to scrape additional posts from archive pages
async function scrapeArchivePages(baseUrl) {
  const additionalPosts = [];
  
  try {
    // Try to find archive links
    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Look for archive links or pagination
    const archiveLinks = [];
    
    // Common archive link patterns
    $('a[href*="archive"], a[href*="page"], a[href*="older"], a[href*="previous"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && !archiveLinks.includes(href)) {
        archiveLinks.push(href);
      }
    });
    
    // For Noahpinion specifically, try to find more posts
    if (baseUrl.includes('noahpinion.blog')) {
      // Look for post links in the main page
      $('a[href*="/p/"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/p/') && !href.includes('#')) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
          archiveLinks.push(fullUrl);
        }
      });
    }
    
    // Limit to first 5 archive pages to avoid overwhelming the server
    const limitedLinks = archiveLinks.slice(0, 5);
    
    for (const link of limitedLinks) {
      try {
        const fullUrl = link.startsWith('http') ? link : new URL(link, baseUrl).href;
        const archiveResponse = await axios.get(fullUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          },
          timeout: 8000
        });
        
        const $archive = cheerio.load(archiveResponse.data);
        
        // Extract posts from archive page
        $archive('article, .post, .entry, [class*="post"]').each((i, el) => {
          const $article = $archive(el);
          
          const title = $article.find('h1, h2, h3, .title, [class*="title"]').first().text().trim();
          const link = $article.find('a[href*="/p/"]').first().attr('href');
          const excerpt = $article.find('.excerpt, .summary, p').first().text().trim();
          const author = $article.find('.author, [class*="author"]').text().trim();
          const dateText = $article.find('.date, .published, time').text().trim();
          
          if (title && link) {
            const fullLink = link.startsWith('http') ? link : new URL(link, baseUrl).href;
            
            // Check if we already have this post
            const existingPost = additionalPosts.find(p => p.url === fullLink);
            if (!existingPost) {
              const published_at = parseDate(dateText) || new Date();
              
              additionalPosts.push({
                title: title,
                content: excerpt,
                excerpt: excerpt.substring(0, 200),
                author: author || '',
                published_at: published_at,
                url: fullLink,
                image_url: '',
              });
            }
          }
        });
        
        // Small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`Failed to scrape archive page ${link}:`, error.message);
      }
    }
    
  } catch (error) {
    console.log('Archive scraping failed:', error.message);
  }
  
  return additionalPosts;
} 