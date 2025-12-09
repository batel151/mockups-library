import { NextResponse } from 'next/server'
import { 
  exportFrames, 
  downloadImage, 
  getFigmaToken,
  parseFileKeyFromUrl
} from '@/lib/figma'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'
import ffmpegPath from 'ffmpeg-static'

const execAsync = promisify(exec)

interface SequenceFrame {
  frameId: string
  frameName: string
  duration: number      // seconds
  transition: 'cut' | 'fade' | 'slide'
}

interface ImportVideoRequest {
  figmaUrl: string
  fileKey?: string
  videoName?: string
  metadata: {
    oem: string
    screenType: string
    assetType: string
    description?: string
  }
  sequence: SequenceFrame[]
}

export async function POST(request: Request) {
  const tempFiles: string[] = []
  
  try {
    console.log('[import-video] Starting video import...')
    const body: ImportVideoRequest = await request.json()
    const { figmaUrl, videoName, metadata, sequence } = body

    if (!figmaUrl) {
      console.log('[import-video] Error: No URL provided')
      return NextResponse.json(
        { error: 'Figma URL is required' },
        { status: 400 }
      )
    }

    if (!sequence || sequence.length < 2) {
      console.log('[import-video] Error: Sequence must have at least 2 frames')
      return NextResponse.json(
        { error: 'Sequence must have at least 2 frames' },
        { status: 400 }
      )
    }

    console.log('[import-video] URL:', figmaUrl)
    console.log('[import-video] Sequence length:', sequence.length)

    const token = await getFigmaToken()
    if (!token) {
      console.log('[import-video] Error: No Figma token')
      return NextResponse.json(
        { error: 'Figma access token not configured. Go to Settings to add it.' },
        { status: 401 }
      )
    }

    // Parse file key from URL
    const fileKey = body.fileKey || parseFileKeyFromUrl(figmaUrl)
    if (!fileKey) {
      console.log('[import-video] Error: Invalid URL format')
      return NextResponse.json(
        { error: 'Invalid Figma URL. Please use a valid file or prototype URL.' },
        { status: 400 }
      )
    }

    console.log('[import-video] File key:', fileKey)

    // Create temp directory for frame images
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp', uuidv4())
    await mkdir(tempDir, { recursive: true })
    
    // BATCH EXPORT: Export all frames in ONE API call
    const frameIds = sequence.map(f => f.frameId)
    
    console.log('[import-video] Exporting', frameIds.length, 'frames in a SINGLE batch call...')
    
    let batchExports: { nodeId: string; imageUrl: string }[] = []
    let retries = 3
    let waitTime = 15000
    
    while (retries > 0) {
      try {
        batchExports = await exportFrames(token, fileKey, frameIds, 'png', 1)
        console.log('[import-video] Batch export successful!')
        break
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
          retries--
          if (retries > 0) {
            console.log(`[import-video] Rate limited, waiting ${waitTime / 1000}s... (${retries} retries left)`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            waitTime = Math.min(waitTime * 2, 60000)
          } else {
            throw new Error('Figma API rate limit exceeded. Please wait 2-3 minutes and try again.')
          }
        } else {
          throw err
        }
      }
    }

    // Download images (S3 URLs, not API calls)
    const frameImages: { path: string; duration: number; transition: string }[] = []
    
    console.log('[import-video] Downloading', batchExports.length, 'images...')
    
    for (let i = 0; i < sequence.length; i++) {
      const frame = sequence[i]
      const exportResult = batchExports.find(r => r.nodeId === frame.frameId)
      
      if (exportResult?.imageUrl) {
        const imageBuffer = await downloadImage(exportResult.imageUrl)
        const framePath = path.join(tempDir, `frame_${String(i).padStart(4, '0')}.png`)
        await writeFile(framePath, imageBuffer)
        frameImages.push({
          path: framePath,
          duration: frame.duration,
          transition: frame.transition,
        })
        tempFiles.push(framePath)
      }
    }
    
    console.log('[import-video] Downloaded', frameImages.length, 'frames')
    
    if (frameImages.length === 0) {
      return NextResponse.json(
        { error: 'Failed to export any frames' },
        { status: 500 }
      )
    }

    // Create output video
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    
    const videoFilename = `${uuidv4()}.mp4`
    const videoPath = path.join(uploadDir, videoFilename)
    
    // Build FFmpeg command with transitions
    console.log('[import-video] Creating video with FFmpeg...')
    
    const ffmpegCmd = await buildFFmpegCommand(frameImages, videoPath)
    
    try {
      console.log('[import-video] FFmpeg command:', ffmpegCmd)
      await execAsync(ffmpegCmd, { maxBuffer: 50 * 1024 * 1024 })
      console.log('[import-video] Video created successfully')
    } catch (ffmpegError) {
      console.error('[import-video] FFmpeg error:', ffmpegError)
      return NextResponse.json(
        { error: 'Failed to create video. Make sure FFmpeg is installed on your system.' },
        { status: 500 }
      )
    }
    
    // Get video file size
    const { stat } = await import('fs/promises')
    const videoStats = await stat(videoPath)
    
    // Create asset in database
    const finalVideoName = videoName || 'Figma Flow Video'
    const asset = await prisma.asset.create({
      data: {
        name: finalVideoName,
        filename: videoFilename,
        url: `/uploads/${videoFilename}`,
        oem: metadata.oem,
        screenType: metadata.screenType,
        assetType: metadata.assetType,
        description: metadata.description || `Video with ${sequence.length} screens`,
        format: 'mp4',
        size: videoStats.size,
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
      const { rmdir } = await import('fs/promises')
      await rmdir(tempDir)
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      asset,
      framesCount: sequence.length,
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
    
    console.error('Error importing video from Figma:', error)
    const message = error instanceof Error ? error.message : 'Failed to import video'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Build FFmpeg command with transitions between frames
 */
async function buildFFmpegCommand(
  frames: { path: string; duration: number; transition: string }[],
  outputPath: string
): Promise<string> {
  // For simple cases or when all transitions are "cut", use a simpler approach
  const allCuts = frames.every(f => f.transition === 'cut')
  
  if (allCuts) {
    // Simple concatenation without transitions
    return buildSimpleFFmpegCommand(frames, outputPath)
  }
  
  // Complex case: use filter_complex for transitions
  return buildComplexFFmpegCommand(frames, outputPath)
}

/**
 * Simple FFmpeg command without transitions (all cuts)
 */
function buildSimpleFFmpegCommand(
  frames: { path: string; duration: number; transition: string }[],
  outputPath: string
): string {
  // Create a concat file content
  const inputArgs: string[] = []
  const filterParts: string[] = []
  
  frames.forEach((frame, i) => {
    inputArgs.push(`-loop 1 -t ${frame.duration} -i "${frame.path}"`)
    filterParts.push(`[${i}:v]scale=1080:-2,setsar=1[v${i}]`)
  })
  
  const concatInputs = frames.map((_, i) => `[v${i}]`).join('')
  const filterComplex = `${filterParts.join(';')};${concatInputs}concat=n=${frames.length}:v=1:a=0[outv]`
  
  return `"${ffmpegPath}" -y ${inputArgs.join(' ')} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -pix_fmt yuv420p -r 30 "${outputPath}"`
}

/**
 * Complex FFmpeg command with transitions (fade, slide)
 */
function buildComplexFFmpegCommand(
  frames: { path: string; duration: number; transition: string }[],
  outputPath: string
): string {
  const inputArgs: string[] = []
  const filterParts: string[] = []
  
  // Each frame needs to be loaded with its duration
  // For frames with transitions, we need extra time for the transition itself
  const transitionDuration = 0.5 // seconds
  
  frames.forEach((frame, i) => {
    // Add a bit of extra time for transitions
    const hasTransitionToNext = i < frames.length - 1 && frame.transition !== 'cut'
    const effectiveDuration = frame.duration + (hasTransitionToNext ? transitionDuration : 0)
    inputArgs.push(`-loop 1 -t ${effectiveDuration} -i "${frame.path}"`)
  })
  
  // Scale all inputs
  frames.forEach((_, i) => {
    filterParts.push(`[${i}:v]scale=1080:-2,setsar=1,fps=30[v${i}]`)
  })
  
  // Build transitions chain
  let currentStream = 'v0'
  let offset = frames[0].duration
  
  for (let i = 1; i < frames.length; i++) {
    const prevFrame = frames[i - 1]
    const nextStream = `v${i}`
    const outputStream = i === frames.length - 1 ? 'outv' : `trans${i}`
    
    if (prevFrame.transition === 'cut') {
      // Simple concatenation for cut
      filterParts.push(`[${currentStream}][${nextStream}]concat=n=2:v=1:a=0[${outputStream}]`)
    } else {
      // Use xfade for fade or slide transitions
      const xfadeType = prevFrame.transition === 'fade' ? 'fade' : 'slideleft'
      filterParts.push(`[${currentStream}][${nextStream}]xfade=transition=${xfadeType}:duration=${transitionDuration}:offset=${offset - transitionDuration}[${outputStream}]`)
    }
    
    currentStream = outputStream
    offset += frames[i].duration
  }
  
  // If only one frame after scaling (shouldn't happen with >= 2 frames)
  if (frames.length === 1) {
    filterParts.push(`[v0]copy[outv]`)
  }
  
  const filterComplex = filterParts.join(';')
  
  return `"${ffmpegPath}" -y ${inputArgs.join(' ')} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -pix_fmt yuv420p -r 30 "${outputPath}"`
}
