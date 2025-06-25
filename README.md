# Blog Aggregator

A Next.js web app that aggregates blog posts into a Substack-like interface, even for sites without RSS feeds. The app scrapes RSS feeds and HTML content, with robust date parsing to handle various formats.

## Features

- **RSS Feed Support**: Automatically detects and parses RSS feeds
- **HTML Scraping**: Falls back to scraping HTML content when RSS isn't available
- **Smart Date Parsing**: Handles various date formats with multiple fallback strategies
- **Archive Scraping**: Scrapes archive pages to get more posts when RSS feeds are limited
- **Infinite Scroll**: Loads posts progressively (10 initially, more on scroll)
- **Feed Management**: Add/remove feeds with delete buttons
- **Post Limiting**: Stores only the 50 most recent posts globally
- **Auto-refresh**: Refreshes feeds every 5 minutes

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes
- **Storage**: 
  - Development: Local JSON files
  - Production: Vercel Postgres
- **Scraping**: Axios, Cheerio, RSS Parser
- **Date Handling**: date-fns

## Local Development

1. **Clone and install**:
   ```bash
   git clone <your-repo>
   cd test_project
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Open browser**: http://localhost:3000

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Vercel.

### Quick Deploy

1. **Push to GitHub**
2. **Connect to Vercel**:
   ```bash
   npx vercel
   ```
3. **Add Postgres database** in Vercel dashboard
4. **Deploy**: `npx vercel --prod`

## How It Works

### Storage Strategy
- **Development**: Uses local JSON files in `/data/` directory
- **Production**: Uses Vercel Postgres database
- **Automatic Detection**: App detects environment and switches storage accordingly

### Data Flow
1. User adds a blog URL
2. App scrapes the website to find RSS feed
3. RSS feed is parsed for posts
4. Posts are stored with proper date parsing
5. Only 50 most recent posts are kept globally
6. Frontend displays posts with infinite scroll

### User Experience
- **No Authentication**: Public aggregator, all data shared
- **Real-time Updates**: Auto-refresh every 5 minutes
- **Responsive Design**: Works on desktop and mobile
- **Fast Loading**: Pagination and efficient data loading

## API Endpoints

- `GET /api/feeds` - Get all feeds
- `POST /api/feeds` - Add new feed
- `DELETE /api/feeds?id=<id>` - Delete feed
- `GET /api/posts` - Get posts (supports pagination)
- `POST /api/feeds/refresh` - Refresh all feeds
- `POST /api/posts` - Utility actions (fix dates, trim posts)

## Configuration

### Environment Variables
- `POSTGRES_URL` - Database connection (auto-set by Vercel)
- `NODE_ENV` - Environment detection

### Limits
- **Posts per feed**: Unlimited (but only 50 most recent globally)
- **Feeds**: Unlimited
- **Auto-refresh**: Every 5 minutes
- **Pagination**: 10 posts per page

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - feel free to use this for your own projects!
