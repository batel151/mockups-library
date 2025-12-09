import { NextResponse } from 'next/server'
import { getFileData, exportFrames, getFigmaToken } from '@/lib/figma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileKey = searchParams.get('fileKey')
    const withThumbnails = searchParams.get('thumbnails') !== 'false'

    if (!fileKey) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      )
    }

    const token = await getFigmaToken()
    if (!token) {
      return NextResponse.json(
        { error: 'Figma access token not configured' },
        { status: 401 }
      )
    }

    // Get file data (uses cache if available)
    let retries = 3
    let waitTime = 10000
    let fileData
    
    while (retries > 0) {
      try {
        fileData = await getFileData(token, fileKey)
        break
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
          retries--
          if (retries > 0) {
            console.log(`[frames] Rate limited, waiting ${waitTime / 1000}s... (${retries} retries left)`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            waitTime = Math.min(waitTime * 2, 60000)
          } else {
            return NextResponse.json(
              { error: 'Figma API rate limit exceeded. Please wait a few minutes and try again.' },
              { status: 429 }
            )
          }
        } else {
          throw err
        }
      }
    }

    if (!fileData) {
      return NextResponse.json({ error: 'Failed to fetch frames' }, { status: 500 })
    }

    let frames = fileData.frames

    // Try to fetch thumbnails in a SINGLE batch call (optional)
    if (withThumbnails && frames.length > 0 && frames.length <= 50) {
      try {
        console.log(`[frames] Fetching thumbnails for ${frames.length} frames in single batch...`)
        const frameIds = frames.map(f => f.id)
        const thumbnails = await exportFrames(token, fileKey, frameIds, 'png', 0.25) // Small scale for thumbnails
        
        // Map thumbnails to frames
        const thumbnailMap = new Map(thumbnails.map(t => [t.nodeId, t.imageUrl]))
        frames = frames.map(f => ({
          ...f,
          thumbnailUrl: thumbnailMap.get(f.id) || undefined
        }))
        console.log(`[frames] Got ${thumbnails.length} thumbnails`)
      } catch (err) {
        // If thumbnail fetch fails (rate limit), just return frames without thumbnails
        console.log('[frames] Thumbnail fetch failed, returning frames without thumbnails:', 
          err instanceof Error ? err.message : String(err)
        )
      }
    }

    return NextResponse.json({ frames })
  } catch (error) {
    console.error('Error fetching Figma frames:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch frames'
    
    if (message.includes('429') || message.includes('Rate limit')) {
      return NextResponse.json(
        { error: 'Figma API rate limit exceeded. Please wait a few minutes and try again.' },
        { status: 429 }
      )
    }
    
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
