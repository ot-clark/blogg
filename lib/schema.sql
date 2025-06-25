-- Create feeds table
CREATE TABLE IF NOT EXISTS feeds (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT,
  description TEXT,
  url TEXT NOT NULL,
  original_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_fetched TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  author TEXT,
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  feed_id VARCHAR(255) REFERENCES feeds(id) ON DELETE CASCADE,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_feed_id ON posts(feed_id);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_created_at ON feeds(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_last_fetched ON feeds(last_fetched); 