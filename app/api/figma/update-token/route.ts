import { NextResponse } from 'next/server'
import { writeFile, readFile } from 'fs/promises'
import path from 'path'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    
    if (!token || !token.startsWith('figd_')) {
      return NextResponse.json(
        { error: 'Invalid token format. Token should start with "figd_"' },
        { status: 400 }
      )
    }

    // Test the token first
    const testRes = await fetch('https://api.figma.com/v1/me', {
      headers: { 'X-Figma-Token': token }
    })

    if (testRes.status === 429) {
      return NextResponse.json(
        { error: 'This token is also rate limited. Try a token from a different Figma account.' },
        { status: 429 }
      )
    }

    if (!testRes.ok) {
      return NextResponse.json(
        { error: 'Invalid token. Please check your Figma access token.' },
        { status: 401 }
      )
    }

    const userData = await testRes.json()

    // Update the .env file
    const envPath = path.join(process.cwd(), '.env')
    let envContent = ''
    
    try {
      envContent = await readFile(envPath, 'utf-8')
    } catch {
      envContent = ''
    }

    // Replace or add the token
    if (envContent.includes('FIGMA_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /FIGMA_ACCESS_TOKEN=.*/,
        `FIGMA_ACCESS_TOKEN="${token}"`
      )
    } else {
      envContent += `\nFIGMA_ACCESS_TOKEN="${token}"\n`
    }

    await writeFile(envPath, envContent)

    return NextResponse.json({
      success: true,
      message: `Token updated! Connected as ${userData.email || userData.handle}`,
      user: userData.email || userData.handle
    })
  } catch (error) {
    console.error('Error updating token:', error)
    return NextResponse.json(
      { error: 'Failed to update token' },
      { status: 500 }
    )
  }
}


