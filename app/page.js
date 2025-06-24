"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState([]);
  const [feeds, setFeeds] = useState([]);

  useEffect(() => {
    fetchPosts();
    fetchFeeds();
  }, []);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error("Error fetching posts:", err);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add feed");
      setUrl("");
      fetchFeeds();
      fetchPosts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8 text-center">Blog Aggregator</h1>
      
      {/* Add Blog Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Add a Blog</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="url"
            placeholder="Enter blog URL (e.g., https://example.com/blog)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
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
      </div>

      {/* Feeds List */}
      {feeds.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Feeds ({feeds.length})</h2>
          <div className="grid gap-3">
            {feeds.map((feed) => (
              <div key={feed.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{feed.title || "Untitled Feed"}</div>
                  <div className="text-sm text-gray-600">{feed.url}</div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(feed.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Latest Posts ({posts.length})</h2>
        {posts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No posts yet. Add a blog to get started!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <article key={post.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                <div className="flex gap-4">
                  {post.image_url && (
                    <img 
                      src={post.image_url} 
                      alt="" 
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      <a 
                        href={post.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="hover:text-blue-600 transition-colors"
                      >
                        {post.title}
                      </a>
                    </h3>
                    <div className="text-sm text-gray-500 mb-2">
                      {post.author && <span>By {post.author} • </span>}
                      {post.published_at && (
                        <span>{new Date(post.published_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    {post.excerpt && (
                      <p className="text-gray-700 mb-3 line-clamp-3">{post.excerpt}</p>
                    )}
                    <a 
                      href={post.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Read full article →
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 