'use client'

import { useState } from 'react'
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
  createdAt: string
}

interface FlowCardProps {
  flow: Flow
  onClick: () => void
  onDelete: () => void
}

export default function FlowCard({ flow, onClick, onDelete }: FlowCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/flows/${flow.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete()
      }
    } catch (error) {
      console.error('Failed to delete flow:', error)
    }
    setShowDeleteConfirm(false)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }

  // Get first few frames for preview
  const previewFrames = flow.frames.slice(0, 4)

  return (
    <div
      className="group relative bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/50 hover:border-violet-500/50 transition-all cursor-pointer hover:shadow-xl hover:shadow-violet-500/10"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Preview Grid */}
      <div className="aspect-video relative bg-slate-900 overflow-hidden">
        {previewFrames.length > 0 ? (
          <div className={`grid ${previewFrames.length === 1 ? 'grid-cols-1' : previewFrames.length === 2 ? 'grid-cols-2' : 'grid-cols-2'} gap-0.5 h-full`}>
            {previewFrames.map((frame, index) => (
              <div key={frame.id} className={`relative ${previewFrames.length === 3 && index === 2 ? 'col-span-2' : ''}`}>
                <Image
                  src={frame.asset.url}
                  alt={frame.asset.name}
                  fill
                  className="object-cover"
                />
                {/* Frame number badge */}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-xs text-white/80">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        )}

        {/* Frame Count Badge */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-medium text-white">
          {flow.frames.length} frames
        </div>

        {/* Play Button Overlay */}
        {isHovered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity">
            <div className="w-14 h-14 rounded-full bg-violet-500/90 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white truncate mb-1">{flow.name}</h3>
        {flow.description && (
          <p className="text-sm text-slate-400 truncate mb-2">{flow.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {new Date(flow.createdAt).toLocaleDateString()}
          </span>
          <span>
            ~{Math.round(flow.frames.reduce((sum, f) => sum + f.delay, 0) / 1000)}s duration
          </span>
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="absolute top-3 left-3 p-2 bg-black/60 backdrop-blur-sm rounded-lg text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center p-4">
            <p className="text-white mb-4">Delete this flow?</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


