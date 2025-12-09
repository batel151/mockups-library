'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface Asset {
  id: string
  name: string
  url: string
  format: string
}

interface SelectedFrame {
  assetId: string
  asset: Asset
  delay: number
}

interface CreateFlowModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateFlowModal({ isOpen, onClose, onSuccess }: CreateFlowModalProps) {
  const [step, setStep] = useState<'info' | 'select' | 'order'>('info')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedFrames, setSelectedFrames] = useState<SelectedFrame[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available assets
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assets')
      const data = await res.json()
      setAssets(data.assets || [])
    } catch (err) {
      setError('Failed to load assets')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchAssets()
    }
  }, [isOpen, fetchAssets])

  const resetModal = () => {
    setStep('info')
    setName('')
    setDescription('')
    setSelectedFrames([])
    setError(null)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  // Toggle asset selection
  const toggleAsset = (asset: Asset) => {
    const existing = selectedFrames.find(f => f.assetId === asset.id)
    if (existing) {
      setSelectedFrames(selectedFrames.filter(f => f.assetId !== asset.id))
    } else {
      setSelectedFrames([...selectedFrames, { assetId: asset.id, asset, delay: 1000 }])
    }
  }

  // Update frame delay
  const updateDelay = (assetId: string, delay: number) => {
    setSelectedFrames(selectedFrames.map(f => 
      f.assetId === assetId ? { ...f, delay } : f
    ))
  }

  // Move frame in order
  const moveFrame = (index: number, direction: 'up' | 'down') => {
    const newFrames = [...selectedFrames]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex >= 0 && newIndex < newFrames.length) {
      [newFrames[index], newFrames[newIndex]] = [newFrames[newIndex], newFrames[index]]
      setSelectedFrames(newFrames)
    }
  }

  // Remove frame
  const removeFrame = (assetId: string) => {
    setSelectedFrames(selectedFrames.filter(f => f.assetId !== assetId))
  }

  // Create the flow
  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a flow name')
      return
    }
    if (selectedFrames.length < 2) {
      setError('Please select at least 2 frames')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          frames: selectedFrames.map(f => ({
            assetId: f.assetId,
            delay: f.delay,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create flow')
      }

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create flow')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-slate-800 rounded-2xl overflow-hidden w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-700 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Create New Flow</h2>
            <p className="text-sm text-slate-400">
              {step === 'info' && 'Name your flow'}
              {step === 'select' && 'Select frames to include'}
              {step === 'order' && 'Arrange frame order and timing'}
            </p>
          </div>
          <button
            className="p-2 text-slate-400 hover:text-white transition-colors"
            onClick={handleClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Flow Info */}
          {step === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Flow Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Onboarding Flow"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this flow shows..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Select Frames */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  {selectedFrames.length} frames selected
                </span>
              </div>

              {loading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="aspect-[9/16] bg-slate-700 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">No assets available. Upload some assets first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {assets.map(asset => {
                    const isSelected = selectedFrames.some(f => f.assetId === asset.id)
                    const selectionOrder = selectedFrames.findIndex(f => f.assetId === asset.id) + 1
                    const isVideo = ['mp4', 'webm', 'mov'].includes(asset.format)

                    return (
                      <button
                        key={asset.id}
                        onClick={() => toggleAsset(asset)}
                        className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-violet-500 ring-2 ring-violet-500/50'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {isVideo ? (
                          <video
                            src={asset.url}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <Image
                            src={asset.url}
                            alt={asset.name}
                            fill
                            className="object-cover"
                          />
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                          <p className="text-[10px] text-white truncate">{asset.name}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-xs text-white font-medium">
                            {selectionOrder}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Order & Timing */}
          {step === 'order' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Drag to reorder frames. Set the delay (in ms) before showing the next frame.
              </p>

              <div className="space-y-2">
                {selectedFrames.map((frame, index) => (
                  <div
                    key={frame.assetId}
                    className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700"
                  >
                    {/* Order controls */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveFrame(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveFrame(index, 'down')}
                        disabled={index === selectedFrames.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Frame number */}
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-medium">
                      {index + 1}
                    </div>

                    {/* Thumbnail */}
                    <div className="relative w-12 h-20 rounded-lg overflow-hidden bg-slate-800">
                      <Image
                        src={frame.asset.url}
                        alt={frame.asset.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{frame.asset.name}</p>
                    </div>

                    {/* Delay input */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Delay:</label>
                      <input
                        type="number"
                        min={100}
                        max={10000}
                        step={100}
                        value={frame.delay}
                        onChange={(e) => updateDelay(frame.assetId, parseInt(e.target.value) || 1000)}
                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                      <span className="text-xs text-slate-400">ms</span>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeFrame(frame.assetId)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Total duration */}
              <div className="text-center text-sm text-slate-400 pt-4">
                Total duration: ~{(selectedFrames.reduce((sum, f) => sum + f.delay, 0) / 1000).toFixed(1)}s
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          {step === 'info' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => name.trim() ? setStep('select') : setError('Please enter a name')}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all"
              >
                Next
              </button>
            </>
          )}

          {step === 'select' && (
            <>
              <button
                onClick={() => setStep('info')}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => selectedFrames.length >= 2 ? setStep('order') : setError('Select at least 2 frames')}
                disabled={selectedFrames.length < 2}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next ({selectedFrames.length} selected)
              </button>
            </>
          )}

          {step === 'order' && (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Flow'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


