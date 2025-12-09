import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

// Check if we're in production (Vercel) or local development
const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop()
    const uniqueName = `${uuidv4()}.${ext}`

    let publicUrl: string

    if (isProduction && process.env.BLOB_READ_WRITE_TOKEN) {
      // Production: Use Vercel Blob
      const blob = await put(uniqueName, file, {
        access: 'public',
      })
      publicUrl = blob.url
    } else {
      // Local development: Save to public/uploads
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      const uploadDir = join(process.cwd(), 'public', 'uploads')
      
      // Ensure upload directory exists
      try {
        await mkdir(uploadDir, { recursive: true })
      } catch {
        // Directory might already exist
      }
      
      const filePath = join(uploadDir, uniqueName)
      await writeFile(filePath, buffer)
      
      publicUrl = `/uploads/${uniqueName}`
    }
    
    return NextResponse.json({
      url: publicUrl,
      filename: file.name,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
