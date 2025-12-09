import { NextResponse } from 'next/server'
import { exportFrames, downloadImage, getFigmaToken } from '@/lib/figma'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

interface ImportFrameRequest {
  fileKey: string;
  fileName: string;
  frames: Array<{
    id: string;
    name: string;
  }>;
  metadata: {
    oem: string;
    screenType: string;
    assetType: string;
    description?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body: ImportFrameRequest = await request.json()
    const { fileKey, fileName, frames, metadata } = body

    if (!fileKey || !frames || frames.length === 0) {
      return NextResponse.json(
        { error: 'File key and frames are required' },
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

    // Export frames as PNG images
    const nodeIds = frames.map(f => f.id)
    const exports = await exportFrames(token, fileKey, nodeIds, 'png', 2)

    // Download and save each image
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const importedAssets = []

    for (const frame of frames) {
      const exportResult = exports.find(e => e.nodeId === frame.id)
      if (!exportResult?.imageUrl) continue

      // Download the image
      const imageBuffer = await downloadImage(exportResult.imageUrl)
      
      // Save to local uploads
      const filename = `${uuidv4()}.png`
      const filepath = path.join(uploadDir, filename)
      await writeFile(filepath, imageBuffer)

      const publicUrl = `/uploads/${filename}`

      // Create asset in database
      const asset = await prisma.asset.create({
        data: {
          name: frame.name,
          filename: `${frame.name}.png`,
          url: publicUrl,
          oem: metadata.oem,
          screenType: metadata.screenType,
          assetType: metadata.assetType,
          description: metadata.description || null,
          format: 'png',
          size: imageBuffer.length,
        },
      })

      // Create Figma import record
      await prisma.figmaImport.create({
        data: {
          fileId: fileKey,
          fileName: fileName,
          frameId: frame.id,
          frameName: frame.name,
          assetId: asset.id,
        },
      })

      importedAssets.push(asset)
    }

    return NextResponse.json({
      success: true,
      imported: importedAssets.length,
      assets: importedAssets,
    })
  } catch (error) {
    console.error('Error importing from Figma:', error)
    const message = error instanceof Error ? error.message : 'Failed to import'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

