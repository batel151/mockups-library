'use client'

import { useState, useEffect } from 'react'
import { OEM_OPTIONS, SCREEN_TYPE_OPTIONS, ASSET_TYPE_OPTIONS } from './SearchFilter'

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

interface EditAssetModalProps {
  asset: Asset | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedAsset: Asset) => void
}

export default function EditAssetModal({ asset, isOpen, onClose, onSave }: EditAssetModalProps) {
  const [name, setName] = useState('')
  const [oem, setOem] = useState('')
  const [screenType, setScreenType] = useState('')
  const [assetType, setAssetType] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (asset) {
      setName(asset.name)
      setOem(asset.oem)
      setScreenType(asset.screenType)
      setAssetType(asset.assetType)
      setDescription(asset.description || '')
    }
  }, [asset])

  const handleSave = async () => {
    if (!asset) return
    
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          oem,
          screenType,
          assetType,
          description: description.trim() || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update asset')
      }

      const updatedAsset = await res.json()
      onSave(updatedAsset)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !asset) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-[10vh] overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-700 my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Edit Asset</h3>
          <button 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Compact */}
        <div className="p-4 space-y-3">
          {error && (
            <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              placeholder="Asset name"
            />
          </div>

          {/* OEM & Screen Type - Side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">OEM</label>
              <select
                value={oem}
                onChange={(e) => setOem(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                {OEM_OPTIONS.filter(o => o !== 'All OEMs').map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Screen Type</label>
              <select
                value={screenType}
                onChange={(e) => setScreenType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                {SCREEN_TYPE_OPTIONS.filter(o => o !== 'All Types').map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Asset Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Asset Type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {ASSET_TYPE_OPTIONS.filter(o => o !== 'All Assets').map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              placeholder="Add a description..."
            />
          </div>
        </div>

        {/* Footer - Always visible */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-700 bg-slate-900/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
