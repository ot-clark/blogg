import { getFeedsNeedingRefresh, refreshFeed, addPosts, getFeeds } from '../../../../lib/database';
import { scrapeWebsite } from '../../../../lib/scraper';

export async function POST(request) {
  try {
    const { force } = await request.json();
    
    // Get all feeds if forced, otherwise only feeds needing refresh
    const feeds = force ? await getFeeds() : await getFeedsNeedingRefresh();
    let refreshedCount = 0;
    
    for (const feed of feeds) {
      const lastFetched = new Date(feed.last_fetched);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Allow refresh if forced or if feed is older than 1 hour
      if (force || lastFetched < oneHourAgo) {
        try {
          const result = await scrapeWebsite(feed.url);
          
          // Update feed with new data
          const updatedFeed = {
            ...feed,
            title: result.feed.title,
            description: result.feed.description,
            last_fetched: new Date().toISOString(),
            last_updated: new Date().toISOString()
          };
          
          await refreshFeed(feed.id);
          
          // Add new posts
          const postsWithFeedId = result.posts.map(post => ({
            ...post,
            feed_id: feed.id
          }));
          
          const addedCount = await addPosts(postsWithFeedId);
          console.log(`Added ${addedCount} new posts from ${feed.title}`);
          refreshedCount++;
        } catch (error) {
          console.error(`Error refreshing feed ${feed.title}:`, error.message);
        }
      }
    }
    
    const message = force ? 
      `Forced refresh completed. ${refreshedCount} feeds refreshed.` :
      (refreshedCount > 0 ? `${refreshedCount} feeds refreshed` : 'No feeds need refreshing');
    
    return new Response(JSON.stringify({ message, refreshedCount }), { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/feeds/refresh:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function GET() {
  try {
    const feedsToRefresh = await getFeedsNeedingRefresh();
    
    return new Response(JSON.stringify({
      feedsNeedingRefresh: feedsToRefresh.length,
      feeds: feedsToRefresh.map(feed => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        last_fetched: feed.last_fetched
      }))
    }), { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/feeds/refresh:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
} 