import { NextResponse } from 'next/server'
import { getFileData, parseFileKeyFromUrl, getFigmaToken } from '@/lib/figma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileUrl = searchParams.get('url')
    const fileKey = searchParams.get('key')

    const token = await getFigmaToken()
    if (!token) {
      return NextResponse.json(
        { error: 'Figma access token not configured' },
        { status: 401 }
      )
    }

    // Get file key from URL or direct key
    let key = fileKey
    if (fileUrl) {
      key = parseFileKeyFromUrl(fileUrl)
      if (!key) {
        return NextResponse.json(
          { error: 'Invalid Figma file URL' },
          { status: 400 }
        )
      }
    }

    if (!key) {
      return NextResponse.json(
        { error: 'File URL or key is required' },
        { status: 400 }
      )
    }

    // Single API call gets everything - file details will be cached
    let retries = 3
    let waitTime = 10000
    
    while (retries > 0) {
      try {
        const fileData = await getFileData(token, key)
        return NextResponse.json({ 
          file: fileData.details, 
          fileKey: key,
          framesCount: fileData.frames.length 
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
          retries--
          if (retries > 0) {
            console.log(`[files] Rate limited, waiting ${waitTime / 1000}s... (${retries} retries left)`)
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
    
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
  } catch (error) {
    console.error('Error fetching Figma file:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch file'
    
    if (message.includes('429') || message.includes('Rate limit')) {
      return NextResponse.json(
        { error: 'Figma API rate limit exceeded. Please wait a few minutes and try again.' },
        { status: 429 }
      )
    }
    
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
