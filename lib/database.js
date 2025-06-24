import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data');
const feedsPath = path.join(dbPath, 'feeds.json');
const postsPath = path.join(dbPath, 'posts.json');

// Ensure data directory exists
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

// Initialize empty files if they don't exist
if (!fs.existsSync(feedsPath)) {
  fs.writeFileSync(feedsPath, JSON.stringify([]));
}
if (!fs.existsSync(postsPath)) {
  fs.writeFileSync(postsPath, JSON.stringify([]));
}

// Helper functions for database operations
export function readFeeds() {
  try {
    const data = fs.readFileSync(feedsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading feeds:', error);
    return [];
  }
}

export function writeFeeds(feeds) {
  try {
    fs.writeFileSync(feedsPath, JSON.stringify(feeds, null, 2));
  } catch (error) {
    console.error('Error writing feeds:', error);
    throw error;
  }
}

export function readPosts() {
  try {
    const data = fs.readFileSync(postsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading posts:', error);
    return [];
  }
}

export function writePosts(posts) {
  try {
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
  } catch (error) {
    console.error('Error writing posts:', error);
    throw error;
  }
}

export function addFeed(feed) {
  const feeds = readFeeds();
  const existingFeed = feeds.find(f => f.url === feed.url);
  if (!existingFeed) {
    const newFeed = {
      id: Date.now().toString(),
      ...feed,
      created_at: new Date().toISOString()
    };
    feeds.push(newFeed);
    writeFeeds(feeds);
    return newFeed;
  }
  return existingFeed;
}

export function addPosts(newPosts) {
  const posts = readPosts();
  const existingUrls = new Set(posts.map(p => p.url));
  
  const uniquePosts = newPosts.filter(post => !existingUrls.has(post.url));
  
  if (uniquePosts.length > 0) {
    const postsWithIds = uniquePosts.map(post => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...post,
      created_at: new Date().toISOString()
    }));
    
    posts.push(...postsWithIds);
    writePosts(posts);
  }
  
  return uniquePosts.length;
}

export function getFeeds() {
  return readFeeds();
}

export function getPosts(feedId = null) {
  const posts = readPosts();
  if (feedId) {
    return posts.filter(post => post.feed_id === feedId);
  }
  return posts.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
} 