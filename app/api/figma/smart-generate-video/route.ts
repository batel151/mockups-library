import { NextResponse } from 'next/server'
import { 
  getFileData,
  exportFrames, 
  downloadImage, 
  getFigmaToken,
  parseFileKeyFromUrl
} from '@/lib/figma'
import { generateFlowFromPrototype, FlowSettings } from '@/lib/flow-generator'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink, readdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'
import ffmpegStatic from 'ffmpeg-static'

const execAsync = promisify(exec)
const FFMPEG_PATH = ffmpegStatic as string

interface SmartGenerateVideoRequest {
  figmaUrl: string
  settings: {
    duration: number // seconds per frame
    transition: 'cut' | 'fade' | 'slow_fade'
  }
  metadata: {
    name?: string
    oem: string
    screenType: string
    assetType: string
    description?: string
  }
}

// Helper to create video with transitions using FFmpeg
async function createVideoWithTransitions(
  frameFiles: { path: string; duration: number; transition: string }[],
  outputPath: string
): Promise<void> {
  if (frameFiles.length === 0) {
    throw new Error('No frames to process')
  }

  if (frameFiles.length === 1) {
    const frame = frameFiles[0]
    const cmd = `"${FFMPEG_PATH}" -y -loop 1 -i "${frame.path}" -c:v libx264 -t ${frame.duration} -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`
    await execAsync(cmd)
    return
  }

  const tempDir = path.dirname(frameFiles[0].path)
  const clipFiles: string[] = []

  try {
    // Create individual clips for each frame
    for (let i = 0; i < frameFiles.length; i++) {
      const frame = frameFiles[i]
      const clipPath = path.join(tempDir, `clip_${i}.mp4`)
      clipFiles.push(clipPath)

      const clipCmd = `"${FFMPEG_PATH}" -y -loop 1 -i "${frame.path}" -c:v libx264 -t ${frame.duration} -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30" -preset ultrafast "${clipPath}"`
      await execAsync(clipCmd)
    }

    // Simple concatenation (transitions are handled by frame timing)
    const concatFilePath = path.join(tempDir, 'concat.txt')
    const concatContent = clipFiles.map(f => `file '${f}'`).join('\n')
    await writeFile(concatFilePath, concatContent)

    const concatCmd = `"${FFMPEG_PATH}" -y -f concat -safe 0 -i "${concatFilePath}" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`
    await execAsync(concatCmd)

    // Cleanup concat file
    try {
      await unlink(concatFilePath)
    } catch {
      // Ignore
    }
  } finally {
    // Cleanup clip files
    for (const clipFile of clipFiles) {
      try {
        await unlink(clipFile)
      } catch {
        // Ignore
      }
    }
  }
}

export async function POST(request: Request) {
  const tempFiles: string[] = []
  
  try {
    const body: SmartGenerateVideoRequest = await request.json()
    const { figmaUrl, settings, metadata } = body

    if (!figmaUrl) {
      return NextResponse.json(
        { error: 'Figma URL is required' },
        { status: 400 }
      )
    }

    const figmaToken = await getFigmaToken()
    if (!figmaToken) {
      return NextResponse.json(
        { error: 'Figma access token not configured. Go to Settings to add it.' },
        { status: 401 }
      )
    }

    // Parse file key from URL
    const fileKey = parseFileKeyFromUrl(figmaUrl)
    if (!fileKey) {
      return NextResponse.json(
        { error: 'Invalid Figma URL. Please use a valid Figma file or prototype URL.' },
        { status: 400 }
      )
    }

    // Get all file data in a single API call (optimized)
    const fileData = await getFileData(figmaToken, fileKey)
    const fileDetails = fileData.details
    const allFrames = fileData.frames
    const connections = fileData.connections
    
    if (allFrames.length === 0) {
      return NextResponse.json(
        { error: 'No frames found in the Figma file' },
        { status: 400 }
      )
    }

    // Generate flow based on prototype connections
    const flowSettings: FlowSettings = {
      duration: settings.duration || 2,
      transition: settings.transition || 'fade',
    }

    const flowPlan = generateFlowFromPrototype(
      allFrames.map(f => ({ id: f.id, name: f.name })),
      connections,
      flowSettings
    )

    if (flowPlan.frames.length === 0) {
      return NextResponse.json(
        { error: 'Could not generate flow from the Figma file' },
        { status: 400 }
      )
    }

    // Create temp directory for frame images
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp', uuidv4())
    await mkdir(tempDir, { recursive: true })

    // BATCH EXPORT: Get all frame IDs and export in ONE API call
    const frameIds = flowPlan.frames.map(f => f.id)
    
    console.log('[smart-video] Exporting', frameIds.length, 'frames in a SINGLE batch call...')
    
    let exportResults: { nodeId: string; imageUrl: string }[] = []
    let retries = 3
    let waitTime = 15000
    
    while (retries > 0) {
      try {
        // Single API call for ALL frames
        exportResults = await exportFrames(figmaToken, fileKey, frameIds, 'png', 1)
        console.log('[smart-video] Batch export successful!')
        break
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
          retries--
          if (retries > 0) {
            console.log(`[smart-video] Rate limited, waiting ${waitTime / 1000}s... (${retries} retries left)`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            waitTime = Math.min(waitTime * 2, 60000)
          } else {
            throw new Error('Figma API rate limit exceeded. Please wait a few minutes and try again.')
          }
        } else {
          throw err
        }
      }
    }

    // Download all images (these are S3 URLs, not Figma API calls)
    const frameDataMap = new Map<string, { path: string; duration: number; transition: string }>()
    
    console.log('[smart-video] Downloading', exportResults.length, 'images...')
    
    for (const frame of flowPlan.frames) {
      const exportResult = exportResults.find(r => r.nodeId === frame.id)
      if (exportResult?.imageUrl) {
        const imageBuffer = await downloadImage(exportResult.imageUrl)
        const framePath = path.join(tempDir, `frame_${frame.id.replace(/[^a-zA-Z0-9]/g, '_')}.png`)
        await writeFile(framePath, imageBuffer)
        tempFiles.push(framePath)
        
        frameDataMap.set(frame.id, {
          path: framePath,
          duration: frame.duration,
          transition: frame.transition,
        })
      }
    }
    
    console.log('[smart-video] Downloaded', frameDataMap.size, 'frames')

    // Build ordered frame list for video generation
    const orderedFrameFiles = flowPlan.frames
      .filter(f => frameDataMap.has(f.id))
      .map(f => frameDataMap.get(f.id)!)

    if (orderedFrameFiles.length === 0) {
      return NextResponse.json(
        { error: 'Failed to export any frames from Figma' },
        { status: 500 }
      )
    }

    // Create output video
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    
    const videoFilename = `${uuidv4()}.mp4`
    const videoPath = path.join(uploadDir, videoFilename)

    // Generate video
    try {
      await createVideoWithTransitions(orderedFrameFiles, videoPath)
    } catch (ffmpegError) {
      console.error('FFmpeg error:', ffmpegError)
      return NextResponse.json(
        { error: 'Failed to create video. Make sure FFmpeg is installed.' },
        { status: 500 }
      )
    }

    // Get video file size
    const { stat } = await import('fs/promises')
    const videoStats = await stat(videoPath)

    // Create asset in database
    const videoName = metadata.name || `${fileDetails.name} - Flow Video`
    const asset = await prisma.asset.create({
      data: {
        name: videoName,
        filename: videoFilename,
        url: `/uploads/${videoFilename}`,
        oem: metadata.oem,
        screenType: metadata.screenType,
        assetType: metadata.assetType,
        description: metadata.description || `Video from ${flowPlan.frames.length} frames, ${flowSettings.duration}s per frame`,
        format: 'mp4',
        size: videoStats.size,
      },
    })

    // Create Figma import record
    await prisma.figmaImport.create({
      data: {
        fileId: fileKey,
        fileName: fileDetails.name,
        frameId: 'smart-flow',
        frameName: videoName,
        assetId: asset.id,
      },
    })

    // Clean up temp files
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile)
      } catch {
        // Ignore
      }
    }

    // Try to remove temp directory
    try {
      const remainingFiles = await readdir(tempDir)
      if (remainingFiles.length === 0) {
        const { rmdir } = await import('fs/promises')
        await rmdir(tempDir)
      }
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      asset,
      flowPlan: {
        framesCount: flowPlan.frames.length,
        totalDuration: flowPlan.totalDuration,
        hasPrototypeConnections: connections.length > 0,
        frames: flowPlan.frames.map(f => ({
          name: f.name,
          duration: f.duration,
          transition: f.transition,
        })),
      },
    })
  } catch (error) {
    // Clean up temp files on error
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile)
      } catch {
        // Ignore
      }
    }
    
    console.error('Error generating video:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate video'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

