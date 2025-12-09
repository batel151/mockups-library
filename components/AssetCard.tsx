'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import EditAssetModal from './EditAssetModal'

interface Asset {
  id: string
  name: string
  filename: string
  url: string
  oem: string
  screenType: string
  assetType: string
  description?: string
  format: string
  size: number
  createdAt: string
}

interface AssetCardProps {
  asset: Asset
  onDelete: (id: string) => void
  onUpdate?: (updatedAsset: Asset) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'avi', 'mkv']

export default function AssetCard({ asset: initialAsset, onDelete, onUpdate }: AssetCardProps) {
  const [asset, setAsset] = useState(initialAsset)
  const [isHovered, setIsHovered] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [exportMode, setExportMode] = useState<'screenshot' | 'gif'>('screenshot')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [gifStartTime, setGifStartTime] = useState(0)
  const [gifDuration, setGifDuration] = useState(3)
  const [gifFps, setGifFps] = useState(10)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const isVideo = VIDEO_FORMATS.includes(asset.format.toLowerCase())

  const handleAssetUpdate = (updatedAsset: Asset) => {
    setAsset({ ...asset, ...updatedAsset })
    onUpdate?.(updatedAsset)
  }

  const handleDownloadOriginal = async () => {
    const response = await fetch(asset.url)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = asset.filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    setShowDownloadMenu(false)
  }

  const handleOpenExportModal = (mode: 'screenshot' | 'gif') => {
    setExportMode(mode)
    setShowDownloadMenu(false)
    setShowExportModal(true)
    setCurrentTime(0)
    setGifStartTime(0)
  }

  const handleCloseExportModal = () => {
    if (!isConverting) {
      setShowExportModal(false)
      setConversionProgress(0)
    }
  }

  const handleCaptureScreenshot = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${asset.name}_screenshot_${currentTime.toFixed(2)}s.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }, 'image/png')
    
    setShowExportModal(false)
  }

  const handleCreateGif = async () => {
    if (!videoRef.current) return
    
    setIsConverting(true)
    setConversionProgress(0)

    try {
      const GIF = (await import('gif.js-upgrade')).default

      const video = videoRef.current
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) throw new Error('Could not get canvas context')

      const maxWidth = 480
      const scale = Math.min(1, maxWidth / video.videoWidth)
      canvas.width = Math.floor(video.videoWidth * scale)
      canvas.height = Math.floor(video.videoHeight * scale)

      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: canvas.width,
        height: canvas.height,
        workerScript: '/gif.worker.js'
      })

      const totalFrames = Math.floor(gifDuration * gifFps)
      const frameDelay = 1000 / gifFps

      for (let i = 0; i < totalFrames; i++) {
        const frameTime = gifStartTime + (i / gifFps)
        if (frameTime > video.duration) break

        video.currentTime = frameTime
        await new Promise(resolve => {
          video.onseeked = resolve
        })

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        const frameCanvas = document.createElement('canvas')
        frameCanvas.width = canvas.width
        frameCanvas.height = canvas.height
        const frameCtx = frameCanvas.getContext('2d')
        if (frameCtx) {
          frameCtx.drawImage(canvas, 0, 0)
          gif.addFrame(frameCtx, { copy: true, delay: frameDelay })
        }
        setConversionProgress(Math.round(((i + 1) / totalFrames) * 50))
      }

      gif.on('progress', (p: number) => {
        setConversionProgress(50 + Math.round(p * 50))
      })

      gif.on('finished', (blob: Blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${asset.name}.gif`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        setIsConverting(false)
        setShowExportModal(false)
        setConversionProgress(0)
      })

      gif.render()
    } catch (error) {
      console.error('Error creating GIF:', error)
      alert('Failed to create GIF. Please try again.')
      setIsConverting(false)
      setConversionProgress(0)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this asset?')) return
    
    setIsDeleting(true)
    try {
      await onDelete(asset.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration
      setDuration(videoDuration)
      setGifDuration(Math.min(3, videoDuration))
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const oemColors: Record<string, string> = {
    'Xiaomi': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'Realme': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'Motorola': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Samsung': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    'OnePlus': 'bg-red-500/20 text-red-300 border-red-500/30',
    'OPPO': 'bg-green-500/20 text-green-300 border-green-500/30',
    'Vivo': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  }

  return (
    <>
      <div 
        className="group relative bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/50 hover:border-violet-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 h-[420px] flex flex-col"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Media Container - Taller aspect ratio for better preview */}
        <div 
          className="relative flex-1 min-h-[240px] bg-slate-900 cursor-pointer overflow-hidden"
          onClick={() => setShowModal(true)}
        >
          {isVideo ? (
            <video
              src={asset.url}
              className="w-full h-full object-contain"
              muted
              playsInline
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
            />
          ) : (
            <Image
              src={asset.url}
              alt={asset.name}
              fill
              className="object-contain transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}
          
          {/* Hover Overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent flex items-end justify-center pb-4 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-white text-sm font-medium">
              {isVideo ? 'Click to play' : 'Click to view'}
            </span>
          </div>

          {/* Format Badge */}
          <div className="absolute top-3 right-3">
            <span className={`px-2 py-1 text-xs font-mono font-bold uppercase rounded-md border ${
              isVideo 
                ? 'bg-fuchsia-900/80 text-fuchsia-300 border-fuchsia-700/50' 
                : 'bg-slate-900/80 text-slate-300 border-slate-700/50'
            }`}>
              {asset.format}
            </span>
          </div>

          {/* Video Play Icon */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Content - Compact */}
        <div className="p-3 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-white text-base truncate flex-1" title={asset.name}>
              {asset.name}
            </h3>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {formatFileSize(asset.size)}
            </span>
          </div>

          {/* Tags - Single row */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${oemColors[asset.oem] || 'bg-slate-700/50 text-slate-300 border-slate-600/50'}`}>
              {asset.oem}
            </span>
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded">
              {asset.screenType}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${
              asset.assetType === 'Mockup' 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              {asset.assetType}
            </span>
          </div>

          {/* Actions - Compact */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowDownloadMenu(true)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            
            <button
              onClick={() => setShowEditModal(true)}
              className="p-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors"
              title="Edit asset"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
              title="Delete asset"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Download Options Modal */}
      {showDownloadMenu && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowDownloadMenu(false)}
        >
          <div 
            className="bg-slate-800 rounded-2xl overflow-hidden w-80 shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white">Download As</h3>
              <button 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                onClick={() => setShowDownloadMenu(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-3 space-y-2">
              <button
                onClick={handleDownloadOriginal}
                className="w-full px-4 py-3 text-left text-sm text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">Original File</div>
                  <div className="text-xs text-slate-400">{asset.format.toUpperCase()} format</div>
                </div>
              </button>
              
              {isVideo && (
                <>
                  <button
                    onClick={() => handleOpenExportModal('screenshot')}
                    className="w-full px-4 py-3 text-left text-sm text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Screenshot</div>
                      <div className="text-xs text-slate-400">PNG image from frame</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleOpenExportModal('gif')}
                    className="w-full px-4 py-3 text-left text-sm text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Animated GIF</div>
                      <div className="text-xs text-slate-400">Create from video clip</div>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Close button - top right corner of the content */}
            <button 
              className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white/90 hover:text-white transition-all z-20 backdrop-blur-sm border border-white/20"
              onClick={() => setShowModal(false)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {isVideo ? (
              <video
                src={asset.url}
                className="max-h-[90vh] w-auto rounded-lg"
                controls
                autoPlay
              />
            ) : (
              <Image
                src={asset.url}
                alt={asset.name}
                width={1920}
                height={1080}
                className="max-h-[90vh] w-auto object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      {/* Unified Export Modal (Screenshot & GIF) */}
      {showExportModal && isVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={handleCloseExportModal}
        >
          <div 
            className="bg-slate-800 rounded-2xl overflow-hidden w-full max-w-2xl mx-4 shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">
                {exportMode === 'screenshot' ? 'Capture Screenshot' : 'Create Animated GIF'}
              </h3>
              <button 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                onClick={handleCloseExportModal}
                disabled={isConverting}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              {/* Video Preview */}
              <div className="relative bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  src={asset.url}
                  className="w-full max-h-[35vh] object-contain mx-auto"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  controls={exportMode === 'gif'}
                />
              </div>
              
              {/* Screenshot Mode Controls */}
              {exportMode === 'screenshot' && (
                <>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.01}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-400 text-center">
                    Drag the slider to select the frame you want to capture
                  </p>
                </>
              )}

              {/* GIF Mode Controls */}
              {exportMode === 'gif' && (
                <>
                  {/* Settings Row - Clean grid layout */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 text-center">
                        Start (sec)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, duration - 0.5)}
                        step={0.1}
                        value={gifStartTime}
                        onChange={(e) => setGifStartTime(parseFloat(e.target.value) || 0)}
                        disabled={isConverting}
                        className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 text-center">
                        Duration (sec)
                      </label>
                      <input
                        type="number"
                        min={0.5}
                        max={duration - gifStartTime}
                        step={0.5}
                        value={gifDuration}
                        onChange={(e) => setGifDuration(parseFloat(e.target.value) || 2)}
                        disabled={isConverting}
                        className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 text-center">
                        Frame Rate
                      </label>
                      <select
                        value={gifFps}
                        onChange={(e) => setGifFps(parseInt(e.target.value))}
                        disabled={isConverting}
                        className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 cursor-pointer"
                      >
                        <option value={5}>5 FPS</option>
                        <option value={10}>10 FPS</option>
                        <option value={15}>15 FPS</option>
                        <option value={20}>20 FPS</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-sm text-slate-400 text-center">
                    Output: {gifDuration}s • {Math.round(gifDuration * gifFps)} frames
                  </p>
                  
                  {/* Progress Bar */}
                  {isConverting && (
                    <div className="space-y-2">
                      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300"
                          style={{ width: `${conversionProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-400 text-center">
                        {conversionProgress < 50 ? 'Capturing frames...' : 'Encoding GIF...'} {conversionProgress}%
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Action Button */}
              <button
                onClick={exportMode === 'screenshot' ? handleCaptureScreenshot : handleCreateGif}
                disabled={isConverting}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConverting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating GIF...
                  </>
                ) : exportMode === 'screenshot' ? (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Capture Screenshot
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Create GIF
                  </>
                )}
              </button>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      <EditAssetModal
        asset={asset}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleAssetUpdate}
      />
    </>
  )
}
