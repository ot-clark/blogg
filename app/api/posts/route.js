import { getPosts } from '../../../lib/database';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const feedId = searchParams.get('feed_id');
    
    const posts = getPosts(feedId);
    
    return new Response(JSON.stringify({ posts }), { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/posts:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
} 