# Deployment Guide

This guide will help you deploy the Mockups & Videos Library to Vercel.

## Prerequisites

1. A GitHub account
2. A Vercel account (free at [vercel.com](https://vercel.com))
3. A PostgreSQL database (free options below)

---

## Step 1: Create a PostgreSQL Database

### Option A: Supabase (Recommended)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **Settings → Database**
4. Copy the **Connection string (URI)** - it looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
   ```

### Option B: Neon

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project
3. Copy the connection string from the dashboard

---

## Step 2: Push Code to GitHub

```bash
# In your mockups-library folder
git init
git add .
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/mockups-library.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `mockups-library` repository
4. **Configure Environment Variables** (click "Environment Variables"):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Your PostgreSQL connection string from Step 1 |
   | `FIGMA_ACCESS_TOKEN` | Your Figma Personal Access Token |

5. Click **Deploy**

---

## Step 4: Enable Vercel Blob Storage

1. In your Vercel project dashboard, go to **Storage**
2. Click **Create Database** → **Blob**
3. Follow the setup wizard
4. The `BLOB_READ_WRITE_TOKEN` will be automatically added to your environment

---

## Step 5: Set Up Database

After deployment, run the Prisma migration:

1. Install Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Run migration: `vercel env pull && npx prisma db push`

Or manually in your local terminal:
```bash
# Set DATABASE_URL to your production database
export DATABASE_URL="your-production-database-url"
npx prisma db push
```

---

## Environment Variables Summary

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | Supabase/Neon dashboard |
| `FIGMA_ACCESS_TOKEN` | Figma API token | [Figma Settings](https://www.figma.com/developers/api#access-tokens) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage | Auto-added by Vercel |

---

## Important Notes

### Video Generation
The "Create Video from Figma" feature uses FFmpeg which is **not available on Vercel serverless functions**. For production video generation, consider:
- Using a separate backend service with FFmpeg installed
- Using a video processing API (like Mux, Cloudinary, etc.)
- Running the video generation on a VPS/dedicated server

### File Uploads
- **Development**: Files saved to `public/uploads/`
- **Production**: Files uploaded to Vercel Blob storage

---

## Troubleshooting

### "Database connection failed"
- Check your `DATABASE_URL` is correct
- Make sure you're using the PostgreSQL connection string (not the pooler URL)

### "Failed to upload file"
- Make sure Vercel Blob is enabled
- Check that `BLOB_READ_WRITE_TOKEN` is set

### Prisma errors
Run `npx prisma generate` after any schema changes

---

## Local Development After Deployment

To run locally with the production database:

```bash
# Copy production env vars
vercel env pull .env.local

# Run development server
npm run dev
```

Or continue using SQLite locally by keeping your local `.env` file with:
```
DATABASE_URL="file:./dev.db"
```

