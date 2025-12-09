import { NextResponse } from 'next/server'
import { getFigmaToken } from '@/lib/figma'

// Simple endpoint to test if Figma API is available
export async function GET() {
  try {
    const token = await getFigmaToken()
    if (!token) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'No Figma token configured' 
      })
    }

    // Use the /me endpoint which has lower rate limits
    const response = await fetch('https://api.figma.com/v1/me', {
      headers: { 'X-Figma-Token': token }
    })

    if (response.status === 429) {
      return NextResponse.json({ 
        status: 'rate_limited', 
        message: 'Still rate limited. Please wait a few more minutes.',
        retryAfter: response.headers.get('Retry-After') || 'unknown'
      })
    }

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ 
        status: 'error', 
        message: `Figma API error: ${error}` 
      })
    }

    const data = await response.json()
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Figma API is available!',
      user: data.email || data.handle
    })
  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}


