import fs from 'fs/promises';
import path from 'path';
import { sql } from '@vercel/postgres';

const dbPath = path.join(process.cwd(), 'data');
const feedsPath = path.join(dbPath, 'feeds.json');
const postsPath = path.join(dbPath, 'posts.json');

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.access(dbPath);
  } catch {
    await fs.mkdir(dbPath, { recursive: true });
  }
}

// Initialize empty files if they don't exist
async function initializeFiles() {
  try {
    await fs.access(feedsPath);
  } catch {
    await fs.writeFile(feedsPath, JSON.stringify([]));
  }
  
  try {
    await fs.access(postsPath);
  } catch {
    await fs.writeFile(postsPath, JSON.stringify([]));
  }
}

// Initialize on module load
ensureDataDirectory().then(initializeFiles);

// Check if we're in production (Vercel) or development
const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// Cache for development to avoid repeated file reads
let feedsCache = null;
let postsCache = null;
let lastFeedsRead = 0;
let lastPostsRead = 0;
const CACHE_TTL = 5000; // 5 seconds cache

// Helper functions for database operations
export async function readFeeds() {
  if (isProduction) {
    try {
      const result = await sql`SELECT * FROM feeds ORDER BY created_at DESC`;
      return result.rows;
    } catch (error) {
      console.error('Error reading feeds from database:', error);
      return [];
    }
  } else {
    // Use cache for development
    const now = Date.now();
    if (feedsCache && (now - lastFeedsRead) < CACHE_TTL) {
      return feedsCache;
    }
    
    try {
      const data = await fs.readFile(feedsPath, 'utf8');
      feedsCache = JSON.parse(data);
      lastFeedsRead = now;
      return feedsCache;
    } catch (error) {
      console.error('Error reading feeds:', error);
      return [];
    }
  }
}

export async function writeFeeds(feeds) {
  if (isProduction) {
    try {
      // Clear existing feeds and insert new ones
      await sql`DELETE FROM feeds`;
      if (feeds.length > 0) {
        const values = feeds.map(feed => 
          `(${feed.id}, ${feed.title}, ${feed.description}, ${feed.url}, ${feed.originalUrl}, ${feed.created_at}, ${feed.last_fetched}, ${feed.last_updated})`
        ).join(', ');
        await sql`INSERT INTO feeds (id, title, description, url, original_url, created_at, last_fetched, last_updated) VALUES ${sql.unsafe(values)}`;
      }
    } catch (error) {
      console.error('Error writing feeds to database:', error);
      throw error;
    }
  } else {
    try {
      await fs.writeFile(feedsPath, JSON.stringify(feeds, null, 2));
      feedsCache = feeds; // Update cache
      lastFeedsRead = Date.now();
    } catch (error) {
      console.error('Error writing feeds:', error);
      throw error;
    }
  }
}

export async function readPosts() {
  if (isProduction) {
    try {
      const result = await sql`SELECT * FROM posts ORDER BY published_at DESC, created_at DESC`;
      return result.rows;
    } catch (error) {
      console.error('Error reading posts from database:', error);
      return [];
    }
  } else {
    // Use cache for development
    const now = Date.now();
    if (postsCache && (now - lastPostsRead) < CACHE_TTL) {
      return postsCache;
    }
    
    try {
      const data = await fs.readFile(postsPath, 'utf8');
      postsCache = JSON.parse(data);
      lastPostsRead = now;
      return postsCache;
    } catch (error) {
      console.error('Error reading posts:', error);
      return [];
    }
  }
}

export async function writePosts(posts) {
  if (isProduction) {
    try {
      // Clear existing posts and insert new ones
      await sql`DELETE FROM posts`;
      if (posts.length > 0) {
        const values = posts.map(post => 
          `(${post.id}, ${post.title}, ${post.content}, ${post.excerpt}, ${post.author}, ${post.url}, ${post.image_url}, ${post.feed_id}, ${post.published_at}, ${post.created_at})`
        ).join(', ');
        await sql`INSERT INTO posts (id, title, content, excerpt, author, url, image_url, feed_id, published_at, created_at) VALUES ${sql.unsafe(values)}`;
      }
    } catch (error) {
      console.error('Error writing posts to database:', error);
      throw error;
    }
  } else {
    try {
      await fs.writeFile(postsPath, JSON.stringify(posts, null, 2));
      postsCache = posts; // Update cache
      lastPostsRead = Date.now();
    } catch (error) {
      console.error('Error writing posts:', error);
      throw error;
    }
  }
}

export async function addFeed(feed) {
  const feeds = await readFeeds();
  const existingFeed = feeds.find(f => f.url === feed.url);
  if (!existingFeed) {
    const newFeed = {
      id: Date.now().toString(),
      ...feed,
      created_at: new Date().toISOString(),
      last_fetched: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };
    
    if (isProduction) {
      // Use single INSERT for production
      await sql`
        INSERT INTO feeds (id, title, description, url, original_url, created_at, last_fetched, last_updated)
        VALUES (${newFeed.id}, ${newFeed.title}, ${newFeed.description}, ${newFeed.url}, ${newFeed.originalUrl}, ${newFeed.created_at}, ${newFeed.last_fetched}, ${newFeed.last_updated})
      `;
    } else {
      // Append to file for development
      feeds.push(newFeed);
      await writeFeeds(feeds);
    }
    return newFeed;
  }
  return existingFeed;
}

export async function updateFeedLastFetched(feedId) {
  const now = new Date().toISOString();
  
  if (isProduction) {
    // Use single UPDATE for production
    await sql`
      UPDATE feeds 
      SET last_fetched = ${now}, last_updated = ${now}
      WHERE id = ${feedId}
    `;
  } else {
    // Update in file for development
    const feeds = await readFeeds();
    const feedIndex = feeds.findIndex(f => f.id === feedId);
    if (feedIndex !== -1) {
      feeds[feedIndex].last_fetched = now;
      feeds[feedIndex].last_updated = now;
      await writeFeeds(feeds);
    }
  }
}

// Function to trim posts to keep only the most recent 50
export async function trimPostsToLimit(limit = 50) {
  const posts = await readPosts();
  
  if (posts.length <= limit) {
    return 0; // No trimming needed
  }
  
  // Sort by date (newest first) and keep only the most recent posts
  const sortedPosts = posts.sort((a, b) => {
    const dateA = new Date(a.published_at || a.created_at || Date.now());
    const dateB = new Date(b.published_at || b.created_at || Date.now());
    return dateB - dateA; // Descending order (newest first)
  });
  
  const trimmedPosts = sortedPosts.slice(0, limit);
  const removedCount = posts.length - trimmedPosts.length;
  
  await writePosts(trimmedPosts);
  return removedCount;
}

export async function addPosts(newPosts) {
  const posts = await readPosts();
  const existingUrls = new Set(posts.map(p => p.url));
  
  const uniquePosts = newPosts.filter(post => !existingUrls.has(post.url));
  
  if (uniquePosts.length > 0) {
    const postsWithIds = uniquePosts.map(post => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...post,
      // Ensure published_at is stored as ISO string
      published_at: post.published_at ? new Date(post.published_at).toISOString() : new Date().toISOString(),
      created_at: new Date().toISOString()
    }));
    
    // Add new posts
    posts.push(...postsWithIds);
    
    // Sort by date (newest first) and keep only the 50 most recent posts
    const sortedPosts = posts.sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at || Date.now());
      const dateB = new Date(b.published_at || b.created_at || Date.now());
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Keep only the 50 most recent posts
    const limitedPosts = sortedPosts.slice(0, 50);
    
    await writePosts(limitedPosts);
    
    // Log if posts were trimmed
    if (posts.length > 50) {
      console.log(`Automatically trimmed posts from ${posts.length} to 50 most recent`);
    }
  }
  
  return uniquePosts.length;
}

export async function getFeeds() {
  return await readFeeds();
}

export async function getPosts(feedId = null, limit = null, offset = 0) {
  const posts = await readPosts();
  
  // Ensure all posts have valid dates
  const postsWithValidDates = posts.map(post => ({
    ...post,
    published_at: post.published_at ? new Date(post.published_at).toISOString() : new Date().toISOString(),
    created_at: post.created_at ? new Date(post.created_at).toISOString() : new Date().toISOString()
  }));
  
  // If a specific feed is requested, filter first
  if (feedId) {
    const filteredPosts = postsWithValidDates.filter(post => post.feed_id === feedId);
    const sortedPosts = filteredPosts.sort((a, b) => {
      // Try published_at first, then created_at as fallback
      const dateA = new Date(a.published_at || a.created_at || Date.now());
      const dateB = new Date(b.published_at || b.created_at || Date.now());
      
      // Ensure we have valid dates
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
        // If dates are invalid, fall back to created_at or current time
        const fallbackA = new Date(a.created_at || Date.now());
        const fallbackB = new Date(b.created_at || Date.now());
        return fallbackB - fallbackA;
      }
      
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Apply pagination if specified
    if (limit !== null) {
      return sortedPosts.slice(offset, offset + limit);
    }
    
    return sortedPosts;
  }
  
  // For all posts, sort purely by date without any grouping
  const sortedPosts = postsWithValidDates.sort((a, b) => {
    // Try published_at first, then created_at as fallback
    const dateA = new Date(a.published_at || a.created_at || Date.now());
    const dateB = new Date(b.published_at || b.created_at || Date.now());
    
    // Ensure we have valid dates
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      // If dates are invalid, fall back to created_at or current time
      const fallbackA = new Date(a.created_at || Date.now());
      const fallbackB = new Date(b.created_at || Date.now());
      return fallbackB - fallbackA;
    }
    
    return dateB - dateA; // Descending order (newest first)
  });
  
  // Apply pagination if specified
  if (limit !== null) {
    return sortedPosts.slice(offset, offset + limit);
  }
  
  return sortedPosts;
}

// Function to get total count of posts
export async function getPostsCount(feedId = null) {
  const posts = await readPosts();
  
  if (feedId) {
    return posts.filter(post => post.feed_id === feedId).length;
  }
  
  return posts.length;
}

// Function to get feeds that need refreshing (older than 1 hour)
export async function getFeedsNeedingRefresh() {
  const feeds = await readFeeds();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return feeds.filter(feed => {
    const lastFetched = feed.last_fetched ? new Date(feed.last_fetched) : new Date(0);
    return lastFetched < oneHourAgo;
  });
}

// Function to refresh a specific feed
export async function refreshFeed(feedId) {
  const feeds = await readFeeds();
  const feed = feeds.find(f => f.id === feedId);
  if (!feed) {
    throw new Error('Feed not found');
  }
  
  await updateFeedLastFetched(feedId);
  return feed;
}

// Function to fix existing posts with null published_at dates
export async function fixNullDates() {
  const posts = await readPosts();
  let fixedCount = 0;
  
  const fixedPosts = posts.map(post => {
    if (post.published_at === null) {
      fixedCount++;
      return {
        ...post,
        published_at: post.created_at || new Date().toISOString()
      };
    }
    return post;
  });
  
  if (fixedCount > 0) {
    await writePosts(fixedPosts);
    console.log(`Fixed ${fixedCount} posts with null published_at dates`);
  }
  
  return fixedCount;
}

// Function to delete a feed and its associated posts
export async function deleteFeed(feedId) {
  const feeds = await readFeeds();
  const feedIndex = feeds.findIndex(f => f.id === feedId);
  
  if (feedIndex === -1) {
    throw new Error('Feed not found');
  }
  
  // Remove the feed
  const deletedFeed = feeds.splice(feedIndex, 1)[0];
  await writeFeeds(feeds);
  
  // Remove all posts associated with this feed
  const posts = await readPosts();
  const postsToKeep = posts.filter(post => post.feed_id !== feedId);
  await writePosts(postsToKeep);
  
  const deletedPostsCount = posts.length - postsToKeep.length;
  
  return {
    feed: deletedFeed,
    deletedPostsCount
  };
}

// Function to clear cache (useful for testing or when data is modified externally)
export function clearCache() {
  feedsCache = null;
  postsCache = null;
  lastFeedsRead = 0;
  lastPostsRead = 0;
} 