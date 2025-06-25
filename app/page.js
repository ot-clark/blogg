"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export default function Home() {
  const [feeds, setFeeds] = useState([]);
  const [posts, setPosts] = useState([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [totalPostsCount, setTotalPostsCount] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [lastPostCount, setLastPostCount] = useState(0);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const observerRef = useRef();
  const loadingRef = useRef();

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMorePosts) return;
    
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/posts?limit=10&offset=${visibleCount}`);
      const data = await response.json();
      
      if (data.posts.length > 0) {
        // Add feed titles to new posts
        const postsWithFeedTitles = data.posts.map(post => ({
          ...post,
          feed_title: feeds.find(f => f.id === post.feed_id)?.title || 'Unknown Feed'
        }));
        
        setPosts(prevPosts => [...prevPosts, ...postsWithFeedTitles]);
        setVisibleCount(prev => prev + 10);
        setHasMorePosts(visibleCount + 10 < data.totalCount);
      } else {
        setHasMorePosts(false);
      }
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMorePosts, visibleCount, feeds]);

  useEffect(() => {
    setDisplayedPosts(posts.slice(0, visibleCount));
  }, [posts, visibleCount]);

  // Reset pagination when new posts are added
  useEffect(() => {
    if (posts.length > 0 && visibleCount === 10) {
      setVisibleCount(10);
      setHasMorePosts(true);
    }
  }, [posts.length, visibleCount]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePosts && !loadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visibleCount, hasMorePosts, loadMorePosts, loadingMore]);

  // Enhanced auto-refresh functionality
  useEffect(() => {
    fetchPosts();
    fetchFeeds();
    
    if (!autoRefreshEnabled) return;

    // Quick check for new posts every 30 seconds
    const quickCheckInterval = setInterval(async () => {
      try {
        setIsCheckingForUpdates(true);
        const response = await fetch('/api/posts?limit=1');
        const data = await response.json();
        const currentPostCount = data.totalCount;
        
        if (currentPostCount > lastPostCount && lastPostCount > 0) {
          const newCount = currentPostCount - lastPostCount;
          setNewPostsCount(newCount);
          console.log(`Found ${newCount} new posts! Refreshing immediately...`);
          
          // Immediately refresh posts to show new content
          fetchPosts();
          setNewPostsCount(0);
        }
        
        setLastPostCount(currentPostCount);
      } catch (error) {
        console.error('Quick check failed:', error);
      } finally {
        setIsCheckingForUpdates(false);
      }
    }, 30 * 1000); // 30 seconds

    // Full refresh every 2 minutes (more frequent than before)
    const fullRefreshInterval = setInterval(async () => {
      if (!refreshing) {
        console.log('Auto-refreshing feeds...');
        setRefreshing(true);
        try {
          // Force refresh to get the most recent posts
          const response = await fetch('/api/feeds/refresh', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true })
          });
          const data = await response.json();
          console.log('Auto-refresh result:', data);
          setLastRefresh(new Date());
          fetchFeeds();
          fetchPosts();
        } catch (err) {
          console.error('Auto-refresh failed:', err);
        } finally {
          setRefreshing(false);
        }
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => {
      clearInterval(quickCheckInterval);
      clearInterval(fullRefreshInterval);
    };
  }, [autoRefreshEnabled, refreshing, lastPostCount]);

  async function fetchPosts() {
    try {
      const response = await fetch('/api/posts?limit=10');
      const data = await response.json();
      
      // Debug: Log the posts we're getting
      console.log('Fetched posts:', data.posts.map(p => ({
        title: p.title,
        published_at: p.published_at,
        created_at: p.created_at,
        feed_id: p.feed_id
      })));
      
      // Debug: Check if we have any posts with recent dates
      const now = new Date();
      const recentPosts = data.posts.filter(p => {
        const postDate = new Date(p.published_at);
        const diffInHours = (now - postDate) / (1000 * 60 * 60);
        return diffInHours < 24; // Posts from last 24 hours
      });
      console.log(`Found ${recentPosts.length} posts from last 24 hours:`, recentPosts.map(p => p.title));
      
      // Add feed titles to posts
      const postsWithFeedTitles = data.posts.map(post => ({
        ...post,
        feed_title: feeds.find(f => f.id === post.feed_id)?.title || 'Unknown Feed'
      }));
      
      setPosts(postsWithFeedTitles);
      setVisibleCount(10);
      setTotalPostsCount(data.totalCount);
      setLastPostCount(data.totalCount);
      setHasMorePosts(data.posts.length === 10 && data.totalCount > 10);
    } catch (err) {
      setError(err.message);
    }
  }

  async function fetchFeeds() {
    try {
      const res = await fetch("/api/feeds");
      const data = await res.json();
      setFeeds(data.feeds || []);
    } catch (err) {
      console.error("Error fetching feeds:", err);
    }
  }

  async function refreshFeeds() {
    setRefreshing(true);
    try {
      // Force refresh to get the most recent posts
      const response = await fetch('/api/feeds/refresh', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await response.json();
      console.log('Refresh result:', data);
      setLastRefresh(new Date());
      fetchFeeds();
      fetchPosts();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function fixDates() {
    try {
      const response = await fetch('/api/posts', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix-dates' })
      });
      const data = await response.json();
      console.log('Fix dates result:', data);
      fetchPosts(); // Refresh the posts display
    } catch (err) {
      setError(err.message);
    }
  }

  async function trimPosts() {
    try {
      const response = await fetch('/api/posts', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trim-posts' })
      });
      const data = await response.json();
      console.log('Trim posts result:', data);
      fetchPosts(); // Refresh the posts display
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteFeed(feedId) {
    if (!confirm('Are you sure you want to delete this feed? This will also remove all its posts.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/feeds?id=${feedId}`, { 
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete feed');
      }
      
      console.log('Delete feed result:', data);
      fetchFeeds(); // Refresh the feeds list
      fetchPosts(); // Refresh the posts display
    } catch (err) {
      setError(err.message);
    }
  }

  async function testRecentPosts() {
    try {
      // Test with a specific feed to see what the most recent posts are
      const response = await fetch('/api/feeds');
      const feedsData = await response.json();
      
      if (feedsData.feeds && feedsData.feeds.length > 0) {
        const firstFeed = feedsData.feeds[0];
        console.log('Testing recent posts for feed:', firstFeed.title, firstFeed.url);
        
        // Manually trigger a refresh for this specific feed
        const refreshResponse = await fetch('/api/feeds/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true })
        });
        const refreshData = await refreshResponse.json();
        console.log('Refresh result:', refreshData);
        
        // Now fetch posts again
        setTimeout(async () => {
          const postsResponse = await fetch('/api/posts?limit=5');
          const postsData = await postsResponse.json();
          console.log('Most recent 5 posts after refresh:', postsData.posts.map(p => ({
            title: p.title,
            published_at: p.published_at,
            feed_title: feeds.find(f => f.id === p.feed_id)?.title || 'Unknown'
          })));
        }, 2000);
      }
    } catch (err) {
      console.error('Test failed:', err);
    }
  }

  async function cleanupInvalidPosts() {
    try {
      const response = await fetch('/api/posts', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup-invalid' })
      });
      const data = await response.json();
      console.log('Cleanup result:', data);
      fetchPosts(); // Refresh the posts display
    } catch (err) {
      setError(err.message);
    }
  }

  async function debugPosts() {
    try {
      const response = await fetch('/api/posts?limit=50');
      const data = await response.json();
      console.log('All posts in database:', data.posts.map(p => ({
        title: p.title,
        published_at: p.published_at,
        created_at: p.created_at,
        feed_id: p.feed_id,
        url: p.url
      })));
      alert(`Total posts: ${data.totalCount}. Check console for details.`);
    } catch (err) {
      console.error('Debug failed:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newFeedUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add feed");
      setNewFeedUrl("");
      fetchFeeds();
      fetchPosts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return "Unknown time";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Unknown time";
      
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      
      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    } catch (error) {
      return "Unknown time";
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Unknown date";
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return "Unknown date";
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8 text-center">Blog Aggregator</h1>
      
      {/* New Posts Notification */}
      {newPostsCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              <span className="text-green-800 font-medium">
                🎉 {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'} found! Refreshing...
              </span>
            </div>
            <button
              onClick={() => setNewPostsCount(0)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Add Blog Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Add a Blog</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="url"
            placeholder="Enter blog URL or specific post URL (e.g., https://substack.com/home/post/p-165095091)"
            value={newFeedUrl}
            onChange={(e) => setNewFeedUrl(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Blog"}
          </button>
        </form>
        {error && (
          <div className="text-red-600 mt-2 text-sm">{error}</div>
        )}
        <p className="text-sm text-gray-600 mt-2">
          💡 Tip: You can paste a specific post URL and the app will automatically find the main blog!
        </p>
      </div>

      {/* Refresh Status and Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Feed Status</h2>
          <div className="flex gap-2">
            <button
              onClick={testRecentPosts}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Test Recent Posts
            </button>
            <button
              onClick={cleanupInvalidPosts}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cleanup Invalid Posts
            </button>
            <button
              onClick={debugPosts}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Debug Posts
            </button>
            <button
              onClick={fixDates}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Fix Dates
            </button>
            <button
              onClick={trimPosts}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Trim to 50 Posts
            </button>
            <button
              onClick={refreshFeeds}
              disabled={refreshing}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {refreshing ? "Refreshing..." : "Force Refresh All"}
            </button>
          </div>
        </div>
        
        {/* Auto-refresh toggle */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Auto-refresh</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefreshEnabled(true)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  autoRefreshEnabled 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                ON
              </button>
              <button
                onClick={() => setAutoRefreshEnabled(false)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  !autoRefreshEnabled 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                OFF
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {autoRefreshEnabled ? '🟢 Active' : '🔴 Disabled'}
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          <p>• Auto-refresh: Every 2 minutes (full refresh) + 30 seconds (quick check)</p>
          <p>• Last manual refresh: {lastRefresh ? formatTimeAgo(lastRefresh.toISOString()) : "Never"}</p>
          <p>• Total feeds: {feeds.length}</p>
          <p>• Posts stored: {totalPostsCount}/50 (most recent)</p>
          {autoRefreshEnabled && (
            <p className="text-green-600 font-medium">• Auto-refresh is active - new posts will appear automatically!</p>
          )}
          {isCheckingForUpdates && (
            <div className="text-blue-600 font-medium flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              Checking for new posts...
            </div>
          )}
        </div>
      </div>

      {/* Feeds List */}
      {feeds.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Feeds ({feeds.length})</h2>
          <div className="grid gap-3">
            {feeds.map((feed) => (
              <div key={feed.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{feed.title || "Untitled Feed"}</div>
                  <div className="text-sm text-gray-600">{feed.url}</div>
                  {feed.originalUrl && (
                    <div className="text-xs text-blue-600">
                      Added from: {feed.originalUrl}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      Last updated: {formatTimeAgo(feed.last_fetched)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(feed.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteFeed(feed.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                    title="Delete feed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">
          Latest Posts ({posts.length} of {totalPostsCount} loaded)
        </h2>
        {posts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No posts yet. Add a blog to get started!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayedPosts.map((post) => (
              <article key={post.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden">
                      {post.image_url ? (
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center text-gray-500 text-xs ${post.image_url ? 'hidden' : 'flex'}`}
                        style={{ display: post.image_url ? 'none' : 'flex' }}
                      >
                        {post.title.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">
                        <a href={post.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                          {post.title}
                        </a>
                      </h2>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {post.feed_title || 'Unknown Feed'}
                      </span>
                    </div>
                    
                    {post.author && (
                      <p className="text-sm text-gray-600 mb-2">
                        By <span className="font-medium">{post.author}</span>
                      </p>
                    )}
                    
                    <p className="text-gray-700 mb-3 line-clamp-2">{post.excerpt}</p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-4">
                        <span>{formatDate(post.published_at)}</span>
                        <span>{formatTimeAgo(post.published_at)}</span>
                      </div>
                      <a 
                        href={post.url} 
          target="_blank"
          rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Read more →
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            
            {/* Loading indicator */}
            {hasMorePosts && !loadingMore && (
              <div 
                ref={loadingRef}
                className="flex justify-center py-8"
              >
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span>Loading more posts...</span>
                </div>
              </div>
            )}
            
            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span>Loading more posts...</span>
                </div>
              </div>
            )}
            
            {/* End of posts indicator */}
            {!hasMorePosts && posts.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>You've reached the end of all posts</p>
                <p className="text-sm mt-1">Showing {posts.length} of {totalPostsCount} total posts from {feeds.length} feeds</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}