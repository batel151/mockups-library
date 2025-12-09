import { NextResponse } from 'next/server'
import { 
  getFileDetails, 
  getFrames, 
  exportFrames, 
  downloadImage, 
  getFigmaToken,
  parseFileKeyFromUrl
} from '@/lib/figma'
import { generateFlowWithAI, FlowFrame } from '@/lib/claude'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink, readdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface AIGenerateVideoRequest {
  figmaUrl: string
  description: string
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
    // Single frame - just create a static video
    const frame = frameFiles[0]
    const cmd = `ffmpeg -y -loop 1 -i "${frame.path}" -c:v libx264 -t ${frame.duration} -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`
    await execAsync(cmd)
    return
  }

  // For multiple frames with transitions, we need to:
  // 1. Create individual video clips for each frame
  // 2. Concatenate them with transitions

  const tempDir = path.dirname(frameFiles[0].path)
  const clipFiles: string[] = []

  try {
    // Create individual clips for each frame
    for (let i = 0; i < frameFiles.length; i++) {
      const frame = frameFiles[i]
      const clipPath = path.join(tempDir, `clip_${i}.mp4`)
      clipFiles.push(clipPath)

      // Create a video clip from the image with the specified duration
      const clipCmd = `ffmpeg -y -loop 1 -i "${frame.path}" -c:v libx264 -t ${frame.duration} -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30" -preset ultrafast "${clipPath}"`
      await execAsync(clipCmd)
    }

    // Now concatenate with transitions
    if (clipFiles.length === 1) {
      // Just copy the single clip
      const copyCmd = `cp "${clipFiles[0]}" "${outputPath}"`
      await execAsync(copyCmd)
    } else {
      // Check if we need transitions
      const hasTransitions = frameFiles.some(f => f.transition === 'fade' || f.transition === 'slow_fade')

      if (hasTransitions) {
        // Use xfade filter for crossfade transitions
        // Build a complex filter chain
        let filterComplex = ''
        let currentInput = '[0:v]'
        
        for (let i = 1; i < clipFiles.length; i++) {
          const prevFrame = frameFiles[i - 1]
          const transitionDuration = prevFrame.transition === 'slow_fade' ? 1 : 
                                     prevFrame.transition === 'fade' ? 0.5 : 0
          
          if (transitionDuration > 0) {
            // Calculate offset (when the transition starts)
            const offset = prevFrame.duration - transitionDuration
            const outputLabel = i < clipFiles.length - 1 ? `[v${i}]` : '[outv]'
            
            filterComplex += `${currentInput}[${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${Math.max(0, offset)}${outputLabel};`
            currentInput = outputLabel
          } else {
            // No transition, just concat
            const outputLabel = i < clipFiles.length - 1 ? `[v${i}]` : '[outv]'
            filterComplex += `${currentInput}[${i}:v]concat=n=2:v=1:a=0${outputLabel};`
            currentInput = outputLabel
          }
        }

        // Remove trailing semicolon
        filterComplex = filterComplex.slice(0, -1)

        // Build input files string
        const inputFiles = clipFiles.map(f => `-i "${f}"`).join(' ')
        
        const mergeCmd = `ffmpeg -y ${inputFiles} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -pix_fmt yuv420p -preset ultrafast "${outputPath}"`
        
        try {
          await execAsync(mergeCmd)
        } catch (ffmpegError) {
          // Fallback to simple concat if complex filter fails
          console.log('Complex filter failed, falling back to simple concat')
          await simpleConcatVideos(clipFiles, outputPath, tempDir)
        }
      } else {
        // Simple concatenation without transitions
        await simpleConcatVideos(clipFiles, outputPath, tempDir)
      }
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

async function simpleConcatVideos(clipFiles: string[], outputPath: string, tempDir: string): Promise<void> {
  // Create a concat file
  const concatFilePath = path.join(tempDir, 'concat.txt')
  const concatContent = clipFiles.map(f => `file '${f}'`).join('\n')
  await writeFile(concatFilePath, concatContent)

  const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`
  await execAsync(concatCmd)

  // Cleanup concat file
  try {
    await unlink(concatFilePath)
  } catch {
    // Ignore
  }
}

export async function POST(request: Request) {
  const tempFiles: string[] = []
  
  try {
    const body: AIGenerateVideoRequest = await request.json()
    const { figmaUrl, description, metadata } = body

    if (!figmaUrl) {
      return NextResponse.json(
        { error: 'Figma URL is required' },
        { status: 400 }
      )
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    const figmaToken = await getFigmaToken()
    if (!figmaToken) {
      return NextResponse.json(
        { error: 'Figma access token not configured' },
        { status: 401 }
      )
    }

    // Parse file key from URL
    const fileKey = parseFileKeyFromUrl(figmaUrl)
    if (!fileKey) {
      return NextResponse.json(
        { error: 'Invalid Figma URL' },
        { status: 400 }
      )
    }

    // Get file details
    const fileDetails = await getFileDetails(figmaToken, fileKey)
    
    // Get all frames
    const allFrames = await getFrames(figmaToken, fileKey)
    
    if (allFrames.length === 0) {
      return NextResponse.json(
        { error: 'No frames found in the Figma file' },
        { status: 400 }
      )
    }

    // Generate flow plan using AI
    let flowPlan: { frames: FlowFrame[] }
    try {
      flowPlan = await generateFlowWithAI(
        allFrames.map(f => ({ id: f.id, name: f.name })),
        description
      )
    } catch (aiError) {
      console.error('AI generation failed:', aiError)
      return NextResponse.json(
        { error: `AI generation failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    if (flowPlan.frames.length === 0) {
      return NextResponse.json(
        { error: 'AI could not generate a valid flow from the description' },
        { status: 400 }
      )
    }

    // Create temp directory for frame images
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp', uuidv4())
    await mkdir(tempDir, { recursive: true })

    // Export frames in batches
    const BATCH_SIZE = 5
    const frameDataMap = new Map<string, { path: string; duration: number; transition: string }>()

    for (let batchStart = 0; batchStart < flowPlan.frames.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, flowPlan.frames.length)
      const batchFrames = flowPlan.frames.slice(batchStart, batchEnd)
      const batchIds = batchFrames.map(f => f.id)

      // Export this batch
      const batchExports = await exportFrames(figmaToken, fileKey, batchIds, 'png', 1)

      // Download each frame in this batch
      for (const frame of batchFrames) {
        const exportResult = batchExports.find(e => e.nodeId === frame.id)
        
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

      // Small delay between batches
      if (batchEnd < flowPlan.frames.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

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

    // Generate video with transitions
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
    const videoName = metadata.name || `${fileDetails.name} - AI Generated`
    const asset = await prisma.asset.create({
      data: {
        name: videoName,
        filename: videoFilename,
        url: `/uploads/${videoFilename}`,
        oem: metadata.oem,
        screenType: metadata.screenType,
        assetType: metadata.assetType,
        description: metadata.description || `AI-generated video from ${flowPlan.frames.length} frames. ${description}`,
        format: 'mp4',
        size: videoStats.size,
      },
    })

    // Create Figma import record
    await prisma.figmaImport.create({
      data: {
        fileId: fileKey,
        fileName: fileDetails.name,
        frameId: 'ai-flow',
        frameName: videoName,
        assetId: asset.id,
      },
    })

    // Clean up temp files
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile)
      } catch {
        // Ignore cleanup errors
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
        totalDuration: flowPlan.frames.reduce((sum, f) => sum + f.duration, 0),
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
        // Ignore cleanup errors
      }
    }
    
    console.error('Error generating AI video:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate video'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


