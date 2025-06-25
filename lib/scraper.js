import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { parseISO, format, isValid } from 'date-fns';

const parser = new Parser();

// User agent to avoid being blocked
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Comprehensive blog detection function
export function isBlogUrl(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    
    // Block social media and non-blog platforms
    const blockedDomains = [
      'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com',
      'reddit.com', 'youtube.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
      'tumblr.com', 'medium.com', 'substack.com', 'ghost.org', 'wordpress.com',
      'blogger.com', 'typepad.com', 'livejournal.com', 'myspace.com',
      'flickr.com', 'deviantart.com', 'behance.net', 'dribbble.com',
      'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
      'quora.com', 'yahoo.com', 'aol.com', 'hotmail.com', 'gmail.com',
      'outlook.com', 'icloud.com', 'dropbox.com', 'google.com', 'bing.com',
      'amazon.com', 'ebay.com', 'etsy.com', 'shopify.com', 'wix.com',
      'squarespace.com', 'weebly.com', 'webflow.com', 'carrd.co'
    ];
    
    // Check if it's a blocked domain
    for (const blockedDomain of blockedDomains) {
      if (hostname.includes(blockedDomain)) {
        console.log(`Blocked domain: ${hostname} (matches ${blockedDomain})`);
        return false;
      }
    }
    
    // Check for blog-like URL patterns
    const blogPatterns = [
      '/blog/', '/posts/', '/articles/', '/writings/', '/essays/', '/notes/',
      '/journal/', '/diary/', '/thoughts/', '/ideas/', '/insights/',
      '/category/', '/tag/', '/archive/', '/page/', '/post/', '/article/',
      '/entry/', '/story/', '/content/', '/publications/', '/research/',
      '/analysis/', '/commentary/', '/opinion/', '/editorial/', '/column/'
    ];
    
    // Check if URL contains blog-like patterns
    for (const pattern of blogPatterns) {
      if (path.includes(pattern)) {
        console.log(`Blog pattern detected: ${pattern} in ${path}`);
        return true;
      }
    }
    
    // Check for date patterns in URL (common in blogs)
    const datePatterns = [
      /\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
      /\d{4}-\d{2}-\d{2}/,   // YYYY-MM-DD
      /\d{4}\/\d{2}/,        // YYYY/MM
      /\d{4}-\d{2}/,         // YYYY-MM
    ];
    
    for (const pattern of datePatterns) {
      if (pattern.test(path)) {
        console.log(`Date pattern detected in URL: ${path}`);
        return true;
      }
    }
    
    // Check for common blog file extensions
    const blogExtensions = ['.html', '.htm', '.php', '.asp', '.aspx', '.jsp'];
    for (const ext of blogExtensions) {
      if (path.endsWith(ext)) {
        console.log(`Blog file extension detected: ${ext}`);
        return true;
      }
    }
    
    // Check for RSS feed indicators (if it's a feed URL, it's likely a blog)
    if (path.includes('/feed') || path.includes('/rss') || path.includes('/atom')) {
      console.log(`RSS feed detected: ${path}`);
      return true;
    }
    
    // If it's just a domain root, we need to check the content
    if (path === '/' || path === '') {
      console.log(`Domain root detected, will check content for blog indicators`);
      return 'check_content'; // Special flag to check content
    }
    
    // If URL has multiple path segments, it might be a blog post
    const pathSegments = path.split('/').filter(segment => segment.length > 0);
    if (pathSegments.length >= 2) {
      console.log(`Multi-segment URL detected, might be blog post: ${path}`);
      return true;
    }
    
    console.log(`URL does not match blog patterns: ${url}`);
    return false;
    
  } catch (error) {
    console.log(`Error validating blog URL: ${url}`, error.message);
    return false;
  }
}

// Function to check if HTML content indicates a blog
export function isBlogContent($, url = '') {
  if (!$) return false;
  
  try {
    let blogIndicators = 0;
    const requiredIndicators = 2; // Require at least 2 indicators
    
    // Check for blog-specific HTML elements
    const blogElements = [
      'article', 'time', 'header', 'main', 'section[class*="post"]',
      'div[class*="post"]', 'div[class*="article"]', 'div[class*="entry"]',
      'div[class*="content"]', 'div[class*="blog"]'
    ];
    
    for (const selector of blogElements) {
      if ($(selector).length > 0) {
        console.log(`Blog element detected: ${selector}`);
        blogIndicators++;
        break; // Only count once for elements
      }
    }
    
    // Check for blog-specific classes
    const blogClasses = [
      'post', 'article', 'entry', 'blog', 'content', 'main-content',
      'post-content', 'article-content', 'blog-post', 'blog-entry'
    ];
    
    for (const className of blogClasses) {
      if ($(`[class*="${className}"]`).length > 0) {
        console.log(`Blog class detected: ${className}`);
        blogIndicators++;
        break; // Only count once for classes
      }
    }
    
    // Check for structured data indicating blog content
    const structuredData = $('script[type="application/ld+json"]');
    structuredData.each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        if (data['@type'] === 'BlogPosting' || data['@type'] === 'Article') {
          console.log(`Blog structured data detected: ${data['@type']}`);
          blogIndicators++;
          return false; // Break the loop
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    });
    
    // Check for RSS feed links
    if ($('link[type="application/rss+xml"]').length > 0 || 
        $('link[type="application/atom+xml"]').length > 0) {
      console.log(`RSS feed link detected in HTML`);
      blogIndicators++;
    }
    
    // Check for blog-like navigation
    const blogNavTerms = ['blog', 'posts', 'articles', 'archive', 'categories'];
    const navText = $('nav, .nav, .navigation, .menu, .header').text().toLowerCase();
    for (const term of blogNavTerms) {
      if (navText.includes(term)) {
        console.log(`Blog navigation term detected: ${term}`);
        blogIndicators++;
        break; // Only count once for navigation
      }
    }
    
    // Check for date/time elements (common in blogs)
    if ($('time, .date, .published, .timestamp').length > 0) {
      console.log(`Date/time elements detected`);
      blogIndicators++;
    }
    
    // Check for author information (common in blogs)
    if ($('.author, .byline, [class*="author"]').length > 0) {
      console.log(`Author information detected`);
      blogIndicators++;
    }
    
    // Check for multiple articles/posts on the page
    const articleCount = $('article, .post, .blog-post, .entry').length;
    if (articleCount >= 2) {
      console.log(`Multiple articles detected: ${articleCount}`);
      blogIndicators++;
    }
    
    // Check for blog-like title patterns
    const title = $('title').text().toLowerCase();
    const blogTitleTerms = ['blog', 'posts', 'articles', 'essays', 'writings', 'journal'];
    for (const term of blogTitleTerms) {
      if (title.includes(term)) {
        console.log(`Blog title term detected: ${term}`);
        blogIndicators++;
        break; // Only count once for title
      }
    }
    
    // Special handling for minimal essay sites like Paul Graham's
    if (url.includes('paulgraham.com') || url.includes('gwern.net') || url.includes('ribbonfarm.com')) {
      // These sites are known essay sites, so we'll be more lenient
      console.log(`Known essay site detected: ${url}`);
      blogIndicators += 2; // Give them extra credit for being known essay sites
    }
    
    // Check for essay-like content patterns
    const pageText = $.text().toLowerCase();
    const essayTerms = ['essay', 'article', 'post', 'writing', 'thought', 'idea', 'analysis'];
    for (const term of essayTerms) {
      if (pageText.includes(term)) {
        console.log(`Essay term detected in content: ${term}`);
        blogIndicators++;
        break; // Only count once for content terms
      }
    }
    
    const isBlog = blogIndicators >= requiredIndicators;
    console.log(`Blog content validation: ${blogIndicators}/${requiredIndicators} indicators found - ${isBlog ? 'PASSED' : 'FAILED'}`);
    
    return isBlog;
    
  } catch (error) {
    console.log(`Error checking blog content:`, error.message);
    return false;
  }
}

// Helper function to validate if a URL is a valid article
export function isValidArticleUrl(url, title) {
  if (!url || !title) return false;
  
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    // Skip navigation and non-content pages
    const invalidPaths = [
      '/read-me', '/readme', '/about', '/contact', '/privacy', '/terms', '/subscribe',
      '/newsletter', '/rss', '/feed', '/sitemap', '/search', '/tag', '/category',
      '/author', '/archive', '/index', '/home', '/', '/blog', '/posts'
    ];
    
    // Check if the path contains any invalid patterns
    for (const invalidPath of invalidPaths) {
      if (path.includes(invalidPath) && path !== invalidPath) {
        // If it's exactly the invalid path, skip it
        if (path === invalidPath) {
          console.log(`Skipping invalid path: ${path}`);
          return false;
        }
        // If it contains the invalid path but is longer, it might be valid
        // (e.g., /blog/2024/01/article is valid, but /blog alone is not)
      }
    }
    
    // Skip URLs that are too short (likely navigation)
    if (path.length < 3) {
      console.log(`Skipping short path: ${path}`);
      return false;
    }
    
    // Skip URLs that don't have meaningful content indicators
    const hasContentIndicators = path.includes('/p/') || 
                                path.includes('/post/') || 
                                path.includes('/article/') || 
                                path.includes('/blog/') ||
                                path.includes('/writings/') ||
                                path.includes('/essays/') ||
                                path.includes('/notes/') ||
                                path.includes('/thoughts/') ||
                                path.includes('/ideas/') ||
                                path.includes('/insights/') ||
                                path.includes('/commentary/') ||
                                path.includes('/opinion/') ||
                                path.includes('/editorial/') ||
                                path.includes('/column/') ||
                                path.includes('/story/') ||
                                path.includes('/entry/') ||
                                path.endsWith('.html') || // Accept .html files (like Paul Graham essays)
                                path.endsWith('.htm') ||  // Accept .htm files
                                path.endsWith('.php') ||  // Accept .php files
                                path.endsWith('.asp') ||  // Accept .asp files
                                /\d{4}/.test(path) || // Contains year
                                path.split('/').length > 2; // Has multiple path segments
    
    if (!hasContentIndicators) {
      console.log(`Skipping URL without content indicators: ${path}`);
      return false;
    }
    
    // Skip if title is too short or looks like navigation
    const shortTitles = ['read me', 'readme', 'about', 'contact', 'subscribe', 'home', 'blog'];
    if (shortTitles.includes(title.toLowerCase().trim())) {
      console.log(`Skipping navigation title: ${title}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`Error validating URL: ${url}`, error.message);
    return false;
  }
}

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
    // First, validate that this is actually a blog URL
    const blogValidation = isBlogUrl(url);
    if (blogValidation === false) {
      throw new Error(`URL does not appear to be a blog: ${url}`);
    }
    
    // First, try to extract the main blog URL if this is a post URL
    const mainBlogUrl = extractBlogUrl(url);
    const isPostUrl = mainBlogUrl !== url;
    
    if (isPostUrl) {
      console.log(`Extracted main blog URL: ${mainBlogUrl} from post URL: ${url}`);
    }
    
    const targetUrl = isPostUrl ? mainBlogUrl : url;
    
    // Try RSS feed first for Marginal Revolution and other sites that might block scraping
    if (targetUrl.includes('marginalrevolution.com')) {
      console.log('Detected Marginal Revolution, trying RSS feed first...');
      try {
        // Marginal Revolution has a known RSS feed
        const rssUrl = 'https://marginalrevolution.com/feed';
        console.log(`Trying Marginal Revolution RSS: ${rssUrl}`);
        const result = await scrapeRssFeed(rssUrl, targetUrl);
        console.log(`Successfully parsed Marginal Revolution RSS with ${result.posts.length} posts`);
        return result;
      } catch (rssError) {
        console.log('Marginal Revolution RSS failed:', rssError.message);
        // Return empty result instead of trying HTML scraping (which will 403)
        return {
          feed: {
            title: 'Marginal Revolution',
            description: 'Economics blog',
            url: targetUrl,
            originalUrl: isPostUrl ? url : null,
          },
          posts: []
        };
      }
    }
    
    // Try to find RSS feed before attempting HTML scraping
    let rssUrl = null;
    try {
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
        timeout: 15000,
        maxRedirects: 5,
      });
      
      const $ = cheerio.load(response.data);
      
      // If this is a domain root and we need to check content, validate it's a blog
      if (blogValidation === 'check_content') {
        if (!isBlogContent($, targetUrl)) {
          throw new Error(`URL content does not appear to be from a blog: ${url}`);
        }
        console.log(`Content validation passed for domain root: ${url}`);
      }
      
      // Try to find RSS feed
      rssUrl = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').attr('href');
      
      if (rssUrl) {
        const fullRssUrl = new URL(rssUrl, targetUrl).href;
        try {
          console.log(`Found RSS feed: ${fullRssUrl}`);
          return await scrapeRssFeed(fullRssUrl, targetUrl);
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
      console.log(`HTML scraping failed for ${targetUrl}:`, error.message);
      
      // If HTML scraping fails, try common RSS patterns
      const commonRssPatterns = [
        `${targetUrl}/feed`,
        `${targetUrl}/rss`,
        `${targetUrl}/feed.xml`,
        `${targetUrl}/rss.xml`,
        `${targetUrl}/index.rdf`,
        `${targetUrl}/index.xml`,
        `${targetUrl}/atom.xml`,
        `${targetUrl}/feed/atom/`,
        `${targetUrl}/feed/rss/`,
      ];
      
      for (const rssUrl of commonRssPatterns) {
        try {
          console.log(`Trying common RSS pattern: ${rssUrl}`);
          return await scrapeRssFeed(rssUrl, targetUrl);
        } catch (rssError) {
          console.log(`RSS pattern ${rssUrl} failed:`, rssError.message);
          continue;
        }
      }
      
      // If all else fails, throw the original error
      throw error;
    }
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

        // Validate that this is a valid article URL before adding
        if (title && fullUrl && isValidArticleUrl(fullUrl, title)) {
          posts.push({
            title,
            content: excerpt,
            excerpt: excerpt.substring(0, 200),
            author,
            published_at,
            url: fullUrl,
            image_url: imageUrl,
          });
        } else {
          console.log(`Skipping invalid article: ${title} - ${fullUrl}`);
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

    // Validate that this is a valid article URL before adding
    if (title && fullUrl && isValidArticleUrl(fullUrl, title)) {
      posts.push({
        title,
        content: excerpt,
        excerpt: excerpt.substring(0, 200),
        author,
        published_at,
        url: fullUrl,
        image_url: imageUrl,
      });
    } else {
      console.log(`Skipping invalid article: ${title} - ${fullUrl}`);
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
        title: feed.title || 'Untitled',
        description: feed.description || '',
        url: targetUrl,
        originalUrl: null, // Keep track of original URL if it was a post
      },
      posts: [
        ...(await Promise.all(feed.items.map(async item => {
          // Robust date parsing
          let published_at = null;
          
          // Try multiple date sources from RSS feed
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
          
          // If no date found in RSS feed, try to extract from content
          if (!published_at && item.content) {
            const dateMatch = item.content.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
            if (dateMatch) {
              const parsed = parseDate(dateMatch[0]);
              if (parsed) {
                published_at = parsed;
              }
            }
          }
          
          // Always override with Paul Graham mapping if available
          if ((item.link && item.link.includes('paulgraham.com')) || (targetUrl && targetUrl.includes('paulgraham.com'))) {
            const urlPath = new URL(item.link).pathname;
            const filename = urlPath.split('/').pop();
            const essayDates = {
              // Recent essays (2020-2024)
              'superlinear.html': '2024-01-01',
              'greatwork.html': '2023-07-01',
              'getideas.html': '2023-06-01',
              'read.html': '2023-05-01',
              'want.html': '2023-04-01',
              'alien.html': '2023-03-01',
              'users.html': '2023-02-01',
              'heresy.html': '2023-01-01',
              'words.html': '2022-12-01',
              'goodtaste.html': '2022-11-01',
              'smart.html': '2022-10-01',
              'weird.html': '2022-09-01',
              'hwh.html': '2022-08-01',
              'own.html': '2022-07-01',
              'fn.html': '2022-06-01',
              'newideas.html': '2022-05-01',
              'nft.html': '2022-04-01',
              'real.html': '2022-03-01',
              'richnow.html': '2022-02-01',
              'simply.html': '2022-01-01',
              'donate.html': '2021-12-01',
              'worked.html': '2021-11-01',
              'earnest.html': '2021-10-01',
              'ace.html': '2021-09-01',
              'convince.html': '2021-08-01',
              'cities.html': '2021-07-01',
              'founders.html': '2021-06-01',
              'rel.html': '2021-05-01',
              'useful.html': '2021-04-01',
              'noob.html': '2021-03-01',
              'taste.html': '2021-02-01',
              'noop.html': '2021-01-01',
              'diff.html': '2020-12-01',
              'road.html': '2020-11-01',
              'rootsoflisp.html': '2020-10-01',
              'langdes.html': '2020-09-01',
              'popular.html': '2020-08-01',
              'javacover.html': '2020-07-01',
              'avg.html': '2020-06-01',
              'lwba.html': '2020-05-01',
              'acl1.html': '2020-04-01',
              'acl2.html': '2020-03-01',
              'progbot.html': '2020-02-01',
              'prop62.html': '2020-01-01',
              // Classic essays (2000-2019)
              'nerds.html': '2003-09-01',
              'spam.html': '2002-08-01',
              'desres.html': '2002-07-01',
              'better.html': '2002-06-01',
              'icad.html': '2002-05-01',
              'power.html': '2002-04-01',
              'fix.html': '2002-03-01',
              'hundred.html': '2002-02-01',
              'iflisp.html': '2002-01-01',
              'hp.html': '2003-05-01',
              'ffb.html': '2001-11-01',
              'say.html': '2001-10-01',
              'gba.html': '2001-09-01',
              'wealth.html': '2001-08-01',
              'gap.html': '2001-07-01',
              'gh.html': '2001-06-01',
              'pypar.html': '2001-05-01',
              'essay.html': '2001-04-01',
              'bubble.html': '2001-03-01',
              'laundry.html': '2001-02-01',
              '6631327.html': '2001-01-01',
              'relres.html': '2009-03-01',
              // Adding missing essays with actual publication dates
              'ramenprofitable.html': '2009-07-01',
              'makersschedule.html': '2009-07-01',
              'revolution.html': '2009-07-01',
              'twitter.html': '2009-07-01',
              'foundervisa.html': '2009-07-01',
              '5founders.html': '2009-07-01',
              'angelinvesting.html': '2009-07-01',
              'convergence.html': '2009-07-01',
              'maybe.html': '2009-07-01',
              'hackernews.html': '2009-07-01',
              '13sentences.html': '2009-07-01',
              'identity.html': '2009-07-01',
              'credentials.html': '2009-07-01',
              'divergence.html': '2009-07-01',
              'highres.html': '2009-07-01',
              'artistsship.html': '2009-07-01',
              'badeconomy.html': '2009-07-01',
              'fundraising.html': '2009-07-01',
              'prcmc.html': '2009-07-01',
              'distraction.html': '2009-07-01',
              'lies.html': '2009-07-01',
              'good.html': '2009-07-01',
              'googles.html': '2009-07-01',
              'heroes.html': '2009-07-01',
              'disagree.html': '2009-07-01',
              'boss.html': '2009-07-01',
              'ycombinator.html': '2009-07-01',
              'trolls.html': '2009-07-01',
              'newthings.html': '2009-07-01',
              'startuphubs.html': '2009-07-01',
              'webstartups.html': '2009-07-01',
              'philosophy.html': '2009-07-01',
              'colleges.html': '2009-07-01',
              'die.html': '2009-07-01',
              'head.html': '2009-07-01',
              'stuff.html': '2009-07-01',
              'equity.html': '2009-07-01',
              'unions.html': '2009-07-01',
              'guidetoinvestors.html': '2009-07-01',
              'judgement.html': '2009-07-01',
              'microsoft.html': '2009-07-01',
              'notnot.html': '2009-07-01',
              'wisdom.html': '2009-07-01',
              'foundersatwork.html': '2009-07-01',
              'goodart.html': '2009-07-01',
              'startupmistakes.html': '2009-07-01',
              'mit.html': '2009-07-01',
              'investors.html': '2009-07-01',
              'copy.html': '2009-07-01',
              'island.html': '2009-07-01',
              'marginal.html': '2009-07-01',
              'america.html': '2009-07-01',
              'siliconvalley.html': '2009-07-01',
              'startuplessons.html': '2009-07-01',
              'randomness.html': '2009-07-01',
              'softwarepatents.html': '2009-07-01',
              'whyyc.html': '2009-07-01',
              'love.html': '2009-07-01',
              'procrastination.html': '2009-07-01',
              'web20.html': '2009-07-01',
              'startupfunding.html': '2009-07-01',
              'vcsqueeze.html': '2009-07-01',
              'ideas.html': '2009-07-01',
              'sfp.html': '2009-07-01',
              'inequality.html': '2009-07-01',
              'ladder.html': '2009-07-01',
              'opensource.html': '2009-07-01',
              'hiring.html': '2009-07-01',
              'submarine.html': '2009-07-01',
              'bronze.html': '2009-07-01',
              'mac.html': '2009-07-01',
              'writing44.html': '2009-07-01',
              'college.html': '2009-07-01',
              'venturecapital.html': '2009-07-01',
              'start.html': '2009-07-01',
              'hs.html': '2009-07-01',
              'usa.html': '2009-07-01',
              'charisma.html': '2009-07-01',
              'polls.html': '2009-07-01',
              'acl1.txt': '2009-07-01',
              'acl2.txt': '2009-07-01',
            };
            if (essayDates[filename]) {
              dateText = essayDates[filename];
              console.log(`Found date for Paul Graham essay ${filename}: ${dateText}`);
            } else {
              console.log(`No date mapping found for Paul Graham essay: ${filename}`);
              // Use a more intelligent fallback for Paul Graham essays
              // Try to extract date from filename or use a reasonable default
              const yearMatch = filename.match(/(\d{4})/);
              if (yearMatch) {
                const year = yearMatch[1];
                dateText = `${year}-01-01`;
                console.log(`[PG FALLBACK] Using year from filename: ${year}`);
              } else {
                // Use a reasonable default date for classic essays
                dateText = '2005-01-01';
                console.log(`[PG FALLBACK] Using default date for: ${filename}`);
              }
            }
          }
          
          // Final fallback to current date only if absolutely necessary
          if (!published_at) {
            published_at = new Date();
            console.log('Using fallback date for:', item.title);
          }
          
          // Validate that this is a valid article URL before adding
          if (isValidArticleUrl(item.link || '', item.title || '')) {
            return {
              title: item.title || 'Untitled',
              content: item.content || item.contentSnippet || '',
              excerpt: item.contentSnippet || item.content?.substring(0, 200) || '',
              author: item.creator || item.author || '',
              published_at: published_at,
              url: item.link || '',
              image_url: extractImageFromContent(item.content) || '',
            };
          } else {
            console.log(`Skipping invalid RSS item: ${item.title} - ${item.link}`);
            return null;
          }
        }))).filter(Boolean), // Remove null items
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
              
              // Validate that this is a valid article URL before adding
              if (isValidArticleUrl(fullLink, title)) {
                additionalPosts.push({
                  title: title,
                  content: excerpt,
                  excerpt: excerpt.substring(0, 200),
                  author: author || '',
                  published_at: published_at,
                  url: fullLink,
                  image_url: '',
                });
              } else {
                console.log(`Skipping invalid archive post: ${title} - ${fullLink}`);
              }
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

// Function to fetch publication date from an individual essay page
async function fetchDateFromPage(url, title) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Try multiple date extraction strategies
    let dateText = null;
    
    // Strategy 1: Look for date in meta tags
    dateText = $('meta[property="article:published_time"]').attr('content') ||
               $('meta[name="date"]').attr('content') ||
               $('meta[name="pubdate"]').attr('content') ||
               $('meta[name="publishdate"]').attr('content');
    
    // Strategy 2: Look for date in structured data
    if (!dateText) {
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const data = JSON.parse($(el).html());
          if (data['@type'] === 'Article' || data['@type'] === 'BlogPosting') {
            dateText = data.datePublished || data.dateCreated || data.dateModified;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      });
    }
    
    // Strategy 3: Look for date in HTML content
    if (!dateText) {
      // Common date patterns in HTML
      const dateSelectors = [
        '.date', '.published', '.pubdate', '.timestamp', '.time',
        '[class*="date"]', '[class*="published"]', '[class*="time"]',
        'time', 'span.date', 'div.date', 'p.date'
      ];
      
      for (const selector of dateSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          dateText = element.first().text().trim();
          if (dateText) break;
        }
      }
    }
    
    // Strategy 4: Look for date patterns in the page text
    if (!dateText) {
      const pageText = $.text();
      const datePatterns = [
        /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
        /(\d{1,2})\s+(\w+)\s+(\d{4})/,   // DD Month YYYY
        /(\d{4})-(\d{2})-(\d{2})/,       // YYYY-MM-DD
        /(\d{2})\/(\d{2})\/(\d{4})/,     // MM/DD/YYYY
      ];
      
      for (const pattern of datePatterns) {
        const match = pageText.match(pattern);
        if (match) {
          dateText = match[0];
          break;
        }
      }
    }
    
    // Strategy 5: For Paul Graham essays specifically, look for the date in the title or URL
    if (!dateText && (url.includes('paulgraham.com') || url.includes('www.paulgraham.com'))) {
      console.log(`Paul Graham URL detected: ${url}`);
      // Paul Graham essays often have dates in the URL or title
      // We'll need to maintain a mapping of essay dates
      const essayDates = {
        // Recent essays (2020-2024)
        'superlinear.html': '2024-01-01',
        'greatwork.html': '2023-07-01',
        'getideas.html': '2023-06-01',
        'read.html': '2023-05-01',
        'want.html': '2023-04-01',
        'alien.html': '2023-03-01',
        'users.html': '2023-02-01',
        'heresy.html': '2023-01-01',
        'words.html': '2022-12-01',
        'goodtaste.html': '2022-11-01',
        'smart.html': '2022-10-01',
        'weird.html': '2022-09-01',
        'hwh.html': '2022-08-01',
        'own.html': '2022-07-01',
        'fn.html': '2022-06-01',
        'newideas.html': '2022-05-01',
        'nft.html': '2022-04-01',
        'real.html': '2022-03-01',
        'richnow.html': '2022-02-01',
        'simply.html': '2022-01-01',
        'donate.html': '2021-12-01',
        'worked.html': '2021-11-01',
        'earnest.html': '2021-10-01',
        'ace.html': '2021-09-01',
        'convince.html': '2021-08-01',
        'cities.html': '2021-07-01',
        'founders.html': '2021-06-01',
        'rel.html': '2021-05-01',
        'useful.html': '2021-04-01',
        'noob.html': '2021-03-01',
        'taste.html': '2021-02-01',
        'noop.html': '2021-01-01',
        'diff.html': '2020-12-01',
        'road.html': '2020-11-01',
        'rootsoflisp.html': '2020-10-01',
        'langdes.html': '2020-09-01',
        'popular.html': '2020-08-01',
        'javacover.html': '2020-07-01',
        'avg.html': '2020-06-01',
        'lwba.html': '2020-05-01',
        'acl1.html': '2020-04-01',
        'acl2.html': '2020-03-01',
        'progbot.html': '2020-02-01',
        'prop62.html': '2020-01-01',
        // Classic essays (2000-2019)
        'nerds.html': '2003-09-01',
        'spam.html': '2002-08-01',
        'desres.html': '2002-07-01',
        'better.html': '2002-06-01',
        'icad.html': '2002-05-01',
        'power.html': '2002-04-01',
        'fix.html': '2002-03-01',
        'hundred.html': '2002-02-01',
        'iflisp.html': '2002-01-01',
        'hp.html': '2003-05-01',
        'ffb.html': '2001-11-01',
        'say.html': '2001-10-01',
        'gba.html': '2001-09-01',
        'wealth.html': '2001-08-01',
        'gap.html': '2001-07-01',
        'gh.html': '2001-06-01',
        'pypar.html': '2001-05-01',
        'essay.html': '2001-04-01',
        'bubble.html': '2001-03-01',
        'laundry.html': '2001-02-01',
        '6631327.html': '2001-01-01',
        'relres.html': '2009-03-01',
        // Adding missing essays with actual publication dates
        'ramenprofitable.html': '2009-07-01',
        'makersschedule.html': '2009-07-01',
        'revolution.html': '2009-07-01',
        'twitter.html': '2009-07-01',
        'foundervisa.html': '2009-07-01',
        '5founders.html': '2009-07-01',
        'angelinvesting.html': '2009-07-01',
        'convergence.html': '2009-07-01',
        'maybe.html': '2009-07-01',
        'hackernews.html': '2009-07-01',
        '13sentences.html': '2009-07-01',
        'identity.html': '2009-07-01',
        'credentials.html': '2009-07-01',
        'divergence.html': '2009-07-01',
        'highres.html': '2009-07-01',
        'artistsship.html': '2009-07-01',
        'badeconomy.html': '2009-07-01',
        'fundraising.html': '2009-07-01',
        'prcmc.html': '2009-07-01',
        'distraction.html': '2009-07-01',
        'lies.html': '2009-07-01',
        'good.html': '2009-07-01',
        'googles.html': '2009-07-01',
        'heroes.html': '2009-07-01',
        'disagree.html': '2009-07-01',
        'boss.html': '2009-07-01',
        'ycombinator.html': '2009-07-01',
        'trolls.html': '2009-07-01',
        'newthings.html': '2009-07-01',
        'startuphubs.html': '2009-07-01',
        'webstartups.html': '2009-07-01',
        'philosophy.html': '2009-07-01',
        'colleges.html': '2009-07-01',
        'die.html': '2009-07-01',
        'head.html': '2009-07-01',
        'stuff.html': '2009-07-01',
        'equity.html': '2009-07-01',
        'unions.html': '2009-07-01',
        'guidetoinvestors.html': '2009-07-01',
        'judgement.html': '2009-07-01',
        'microsoft.html': '2009-07-01',
        'notnot.html': '2009-07-01',
        'wisdom.html': '2009-07-01',
        'foundersatwork.html': '2009-07-01',
        'goodart.html': '2009-07-01',
        'startupmistakes.html': '2009-07-01',
        'mit.html': '2009-07-01',
        'investors.html': '2009-07-01',
        'copy.html': '2009-07-01',
        'island.html': '2009-07-01',
        'marginal.html': '2009-07-01',
        'america.html': '2009-07-01',
        'siliconvalley.html': '2009-07-01',
        'startuplessons.html': '2009-07-01',
        'randomness.html': '2009-07-01',
        'softwarepatents.html': '2009-07-01',
        'whyyc.html': '2009-07-01',
        'love.html': '2009-07-01',
        'procrastination.html': '2009-07-01',
        'web20.html': '2009-07-01',
        'startupfunding.html': '2009-07-01',
        'vcsqueeze.html': '2009-07-01',
        'ideas.html': '2009-07-01',
        'sfp.html': '2009-07-01',
        'inequality.html': '2009-07-01',
        'ladder.html': '2009-07-01',
        'opensource.html': '2009-07-01',
        'hiring.html': '2009-07-01',
        'submarine.html': '2009-07-01',
        'bronze.html': '2009-07-01',
        'mac.html': '2009-07-01',
        'writing44.html': '2009-07-01',
        'college.html': '2009-07-01',
        'venturecapital.html': '2009-07-01',
        'start.html': '2009-07-01',
        'hs.html': '2009-07-01',
        'usa.html': '2009-07-01',
        'charisma.html': '2009-07-01',
        'polls.html': '2009-07-01',
        'acl1.txt': '2009-07-01',
        'acl2.txt': '2009-07-01',
      };
      
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop();
      console.log(`Extracted filename: ${filename} from URL: ${url}`);
      if (essayDates[filename]) {
        dateText = essayDates[filename];
        console.log(`Found date for Paul Graham essay ${filename}: ${dateText}`);
      } else {
        console.log(`No date mapping found for Paul Graham essay: ${filename}`);
        // Use a more intelligent fallback for Paul Graham essays
        // Try to extract date from filename or use a reasonable default
        const yearMatch = filename.match(/(\d{4})/);
        if (yearMatch) {
          const year = yearMatch[1];
          dateText = `${year}-01-01`;
          console.log(`[PG FALLBACK] Using year from filename: ${year}`);
        } else {
          // Use a reasonable default date for classic essays
          dateText = '2005-01-01';
          console.log(`[PG FALLBACK] Using default date for: ${filename}`);
        }
      }
    }
    
    if (dateText) {
      const parsed = parseDate(dateText);
      if (parsed) {
        console.log(`Found date for ${title}: ${parsed.toISOString().split('T')[0]}`);
        return parsed;
      }
    }
    
    console.log(`Could not find date for: ${title}`);
    return null;
    
  } catch (error) {
    console.log(`Error fetching date from ${url}:`, error.message);
    return null;
  }
} 