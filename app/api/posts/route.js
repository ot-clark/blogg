import { getPosts, getPostsCount, fixNullDates, trimPostsToLimit } from '../../../lib/database';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const feedId = searchParams.get('feedId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 10;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')) : 0;
    
    // Get posts with proper sorting from database
    const posts = await getPosts(feedId, limit, offset);
    const totalCount = await getPostsCount(feedId);
    
    return new Response(JSON.stringify({ posts, totalCount }), { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/posts:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { action } = await request.json();
    
    if (action === 'fix-dates') {
      const fixedCount = await fixNullDates();
      return new Response(JSON.stringify({ 
        message: `Fixed ${fixedCount} posts with null dates`,
        fixedCount 
      }), { status: 200 });
    }
    
    if (action === 'trim-posts') {
      const removedCount = await trimPostsToLimit(50);
      return new Response(JSON.stringify({ 
        message: `Trimmed posts to 50 most recent. Removed ${removedCount} older posts.`,
        removedCount 
      }), { status: 200 });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/posts:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
} 