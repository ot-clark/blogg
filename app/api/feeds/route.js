import { addFeed, addPosts, getFeeds, deleteFeed } from '../../../lib/database';
import { scrapeWebsite } from '../../../lib/scraper';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing URL' }), { status: 400 });
    }

    // Scrape the website (RSS or HTML)
    const { feed, posts } = await scrapeWebsite(url);

    // Add feed to database
    const savedFeed = await addFeed(feed);

    // Add posts to database
    const postsWithFeedId = posts.map(post => ({
      ...post,
      feed_id: savedFeed.id
    }));
    
    const addedCount = await addPosts(postsWithFeedId);

    return new Response(JSON.stringify({ 
      feed: savedFeed, 
      postsCount: addedCount 
    }), { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/feeds:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function GET() {
  try {
    const feeds = await getFeeds();
    return new Response(JSON.stringify({ feeds }), { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/feeds:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const feedId = searchParams.get('id');
    
    if (!feedId) {
      return new Response(JSON.stringify({ error: 'Missing feed ID' }), { status: 400 });
    }

    const result = await deleteFeed(feedId);
    
    return new Response(JSON.stringify({ 
      message: `Feed "${result.feed.title}" deleted successfully`,
      deletedFeed: result.feed,
      deletedPostsCount: result.deletedPostsCount
    }), { status: 200 });
  } catch (error) {
    console.error('Error in DELETE /api/feeds:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
} 