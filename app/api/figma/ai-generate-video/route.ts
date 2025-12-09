import { NextResponse } from 'next/server'

// Video generation requires FFmpeg which is not available on Vercel serverless
// This feature only works in local development
export async function POST() {
  return NextResponse.json(
    { 
      error: 'Video generation is not available in cloud deployment. This feature requires FFmpeg which only works in local development.',
      suggestion: 'Run the app locally (npm run dev) to use video generation features.'
    },
    { status: 503 }
  )
}
