# Deployment Guide for Vercel

## Overview

This app uses a hybrid storage approach:
- **Development**: Local JSON files for easy testing
- **Production**: Vercel Postgres database for persistent storage

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub

## Step 1: Set up Vercel Postgres

1. **Create a new Vercel project**:
   ```bash
   npx vercel
   ```

2. **Add Postgres database**:
   - Go to your Vercel dashboard
   - Navigate to your project
   - Go to "Storage" tab
   - Click "Create Database"
   - Choose "Postgres"
   - Select a region close to your users

3. **Install dependencies**:
   ```bash
   npm install @vercel/postgres
   ```

## Step 2: Set up Database Schema

1. **Access your database**:
   - In Vercel dashboard, go to your Postgres database
   - Click "Connect" to get connection details

2. **Run the schema**:
   - Copy the contents of `lib/schema.sql`
   - Execute it in your database (using Vercel's SQL editor or any PostgreSQL client)

## Step 3: Environment Variables

Vercel will automatically set these environment variables when you connect Postgres:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

## Step 4: Deploy

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add database support"
   git push
   ```

2. **Deploy on Vercel**:
   - Vercel will automatically deploy when you push to GitHub
   - Or run: `npx vercel --prod`

## How It Works

### Storage Strategy

The app automatically detects the environment:

```javascript
const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
```

- **Development** (`npm run dev`): Uses local JSON files in `/data/`
- **Production** (Vercel): Uses Vercel Postgres database

### Data Persistence

- **Feeds**: Stored in `feeds` table
- **Posts**: Stored in `posts` table with foreign key to feeds
- **Automatic cleanup**: Only 50 most recent posts are kept
- **Cascade deletion**: When a feed is deleted, all its posts are removed

### User Data

**No cookies or user accounts** - this is a simple aggregator where:
- All data is shared across all users
- Anyone can add/remove feeds
- Posts are aggregated from RSS feeds publicly

## Alternative Storage Options

If you prefer different storage:

### Option 1: Vercel KV (Redis)
```bash
npm install @vercel/kv
```

### Option 2: Supabase
```bash
npm install @supabase/supabase-js
```

### Option 3: PlanetScale
```bash
npm install @planetscale/database
```

## Troubleshooting

### Database Connection Issues
- Check environment variables are set correctly
- Verify database schema is created
- Check Vercel logs for connection errors

### Performance Issues
- Database indexes are created automatically
- Posts are limited to 50 most recent
- Pagination is implemented for large datasets

### Local Development
- JSON files work for development
- No database setup required locally
- Switch to database by setting `NODE_ENV=production`

## Security Considerations

- No user authentication (public aggregator)
- RSS feeds are public data
- No sensitive data stored
- Database credentials are managed by Vercel

## Scaling

- Vercel Postgres handles up to 1GB storage
- Automatic backups included
- Can upgrade to Vercel Postgres Pro for more storage
- Consider read replicas for high traffic 