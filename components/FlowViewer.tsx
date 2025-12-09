'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

interface Asset {
  id: string
  name: string
  url: string
  format: string
}

interface FlowFrame {
  id: string
  assetId: string
  order: number
  delay: number
  asset: Asset
}

interface Flow {
  id: string
  name: string
  description?: string | null
  frames: FlowFrame[]
}

interface FlowViewerProps {
  flow: Flow
  onClose: () => void
}

export default function FlowViewer({ flow, onClose }: FlowViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const currentFrame = flow.frames[currentIndex]

  // Auto-play logic
  useEffect(() => {
    if (isPlaying && flow.frames.length > 1) {
      const delay = currentFrame?.delay || 1000
      intervalRef.current = setTimeout(() => {
        setCurrentIndex(prev => {
          if (prev >= flow.frames.length - 1) {
            // Loop back or stop at end
            return 0
          }
          return prev + 1
        })
      }, delay)
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
      }
    }
  }, [isPlaying, currentIndex, currentFrame, flow.frames.length])

  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(flow.frames.length - 1, prev + 1))
  }, [flow.frames.length])

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious()
          break
        case 'ArrowRight':
          handleNext()
          break
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'Escape':
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevious, handleNext, togglePlay, onClose])

  if (!currentFrame) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-6 py-4 bg-slate-900/80 backdrop-blur-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">{flow.name}</h2>
            <p className="text-sm text-slate-400">
              Frame {currentIndex + 1} of {flow.frames.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowThumbnails(!showThumbnails) }}
            className={`p-2 rounded-lg transition-colors ${showThumbnails ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative max-h-full max-w-full">
          {/* Navigation Arrows */}
          {currentIndex > 0 && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {currentIndex < flow.frames.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Current Frame */}
          <div className="relative">
            {currentFrame.asset.format === 'mp4' || currentFrame.asset.format === 'webm' || currentFrame.asset.format === 'mov' ? (
              <video
                src={currentFrame.asset.url}
                className="max-h-[70vh] w-auto rounded-lg shadow-2xl"
                autoPlay
                loop
                muted
              />
            ) : (
              <Image
                src={currentFrame.asset.url}
                alt={currentFrame.asset.name}
                width={800}
                height={1200}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div 
        className="px-6 py-4 bg-slate-900/80 backdrop-blur-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="p-4 bg-violet-600 hover:bg-violet-500 rounded-full text-white transition-colors"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === flow.frames.length - 1}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-4">
          {flow.frames.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-violet-500'
                  : index < currentIndex
                  ? 'bg-violet-500/50'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Thumbnail Strip */}
        {showThumbnails && (
          <div className="flex justify-center gap-2 overflow-x-auto pb-2">
            {flow.frames.map((frame, index) => (
              <button
                key={frame.id}
                onClick={() => setCurrentIndex(index)}
                className={`relative flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? 'border-violet-500 ring-2 ring-violet-500/50'
                    : 'border-transparent hover:border-slate-600'
                }`}
              >
                <Image
                  src={frame.asset.url}
                  alt={frame.asset.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-xs text-white font-medium">{index + 1}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Current Frame Info */}
        <div className="text-center mt-2">
          <p className="text-sm text-white font-medium">{currentFrame.asset.name}</p>
          <p className="text-xs text-slate-400">
            {currentFrame.delay}ms delay • Press Space to play/pause
          </p>
        </div>
      </div>
    </div>
  )
}


