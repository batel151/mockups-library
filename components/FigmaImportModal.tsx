'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { OEM_OPTIONS, SCREEN_TYPE_OPTIONS, ASSET_TYPE_OPTIONS } from './SearchFilter'

// Types
interface FigmaPage {
  id: string
  name: string
}

interface FigmaFrame {
  id: string
  name: string
  thumbnailUrl?: string
  width?: number
  height?: number
}

// New types for video creation
interface PrototypeScreen {
  id: string
  name: string
  thumbnailUrl?: string
  width?: number
  height?: number
}

interface SequenceItem {
  screen: PrototypeScreen
  duration: number       // seconds (default: 2)
  transition: 'cut' | 'fade' | 'slide'  // transition to NEXT screen
}

interface FigmaImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ImportMode = 'choose' | 'frames' | 'video'
type Step = 'mode' | 'url' | 'select' | 'sequence' | 'metadata' | 'importing' | 'done'

const TRANSITION_OPTIONS: { value: SequenceItem['transition']; label: string }[] = [
  { value: 'cut', label: 'Cut (instant)' },
  { value: 'fade', label: 'Fade (0.5s)' },
  { value: 'slide', label: 'Slide (0.5s)' },
]

export default function FigmaImportModal({ isOpen, onClose, onSuccess }: FigmaImportModalProps) {
  const [importMode, setImportMode] = useState<ImportMode>('choose')
  const [step, setStep] = useState<Step>('mode')
  const [figmaUrl, setFigmaUrl] = useState('')
  const [fileKey, setFileKey] = useState('')
  const [fileName, setFileName] = useState('')
  const [pages, setPages] = useState<FigmaPage[]>([])
  const [selectedPage, setSelectedPage] = useState<string>('')
  const [frames, setFrames] = useState<FigmaFrame[]>([])
  const [selectedFrames, setSelectedFrames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)

  // Video-specific state
  const [allScreens, setAllScreens] = useState<PrototypeScreen[]>([])
  const [sequence, setSequence] = useState<SequenceItem[]>([])

  // Metadata
  const [oem, setOem] = useState(OEM_OPTIONS[1])
  const [screenType, setScreenType] = useState(SCREEN_TYPE_OPTIONS[1])
  const [assetType, setAssetType] = useState(ASSET_TYPE_OPTIONS[1])
  const [description, setDescription] = useState('')
  const [videoName, setVideoName] = useState('')

  const resetModal = useCallback(() => {
    setImportMode('choose')
    setStep('mode')
    setFigmaUrl('')
    setFileKey('')
    setFileName('')
    setPages([])
    setSelectedPage('')
    setFrames([])
    setSelectedFrames(new Set())
    setLoading(false)
    setError(null)
    setImportProgress(0)
    setImportedCount(0)
    setAllScreens([])
    setSequence([])
    setOem(OEM_OPTIONS[1])
    setScreenType(SCREEN_TYPE_OPTIONS[1])
    setAssetType(ASSET_TYPE_OPTIONS[1])
    setDescription('')
    setVideoName('')
  }, [])

  const handleClose = () => {
    resetModal()
    onClose()
  }

  // Select import mode
  const handleSelectMode = (mode: ImportMode) => {
    setImportMode(mode)
    setStep('url')
  }

  // Step 1: Load Figma file from URL
  const handleLoadFile = async () => {
    if (!figmaUrl.trim()) {
      setError('Please enter a Figma file URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/figma/files?url=${encodeURIComponent(figmaUrl)}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load file')
      }

      setFileKey(data.fileKey)
      setFileName(data.file.name)
      setVideoName(`${data.file.name} - Flow`)
      setPages(data.file.pages)
      
      if (data.file.pages.length > 0) {
        setSelectedPage(data.file.pages[0].id)
      }
      
      // For both video and frames mode, go to select step
      setStep('select')
      
      // Auto-load frames
      await loadFramesForFile(data.fileKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Figma file')
    } finally {
      setLoading(false)
    }
  }

  // Load frames helper - tries to get thumbnails in single batch
  const loadFramesForFile = async (key: string, pageId?: string) => {
    setLoading(true)
    try {
      const pageParam = pageId ? `&pageId=${pageId}` : ''
      // Request thumbnails - API will try once, gracefully fails if rate limited
      const res = await fetch(`/api/figma/frames?fileKey=${key}${pageParam}&thumbnails=true`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load frames')
      }

      if (importMode === 'video') {
        setAllScreens(data.frames)
      } else {
        setFrames(data.frames)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load frames')
    } finally {
      setLoading(false)
    }
  }

  // Load frames when page changes
  const handleLoadFrames = async () => {
    if (!fileKey) return
    await loadFramesForFile(fileKey, selectedPage)
  }

  // Toggle frame/screen selection
  const toggleFrame = (frameId: string) => {
    const newSelected = new Set(selectedFrames)
    if (newSelected.has(frameId)) {
      newSelected.delete(frameId)
    } else {
      newSelected.add(frameId)
    }
    setSelectedFrames(newSelected)
  }

  // Select all
  const selectAllFrames = () => {
    const items = importMode === 'video' ? allScreens : frames
    if (selectedFrames.size === items.length) {
      setSelectedFrames(new Set())
    } else {
      setSelectedFrames(new Set(items.map(f => f.id)))
    }
  }

  // Proceed from select to next step
  const handleProceedFromSelect = () => {
    if (selectedFrames.size === 0) {
      setError('Please select at least one screen')
      return
    }
    
    if (importMode === 'video') {
      if (selectedFrames.size < 2) {
        setError('Please select at least 2 screens for video')
        return
      }
      
      // Build initial sequence from selected screens
      const selectedScreens = allScreens.filter(s => selectedFrames.has(s.id))
      const initialSequence: SequenceItem[] = selectedScreens.map(screen => ({
        screen,
        duration: 2,
        transition: 'cut',
      }))
      setSequence(initialSequence)
      setStep('sequence')
    } else {
      setStep('metadata')
    }
    setError(null)
  }

  // Sequence manipulation functions
  const moveSequenceItem = (index: number, direction: 'up' | 'down') => {
    const newSequence = [...sequence]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newSequence.length) return
    
    const temp = newSequence[index]
    newSequence[index] = newSequence[targetIndex]
    newSequence[targetIndex] = temp
    
    setSequence(newSequence)
  }

  const updateSequenceItem = (index: number, updates: Partial<SequenceItem>) => {
    const newSequence = [...sequence]
    newSequence[index] = { ...newSequence[index], ...updates }
    setSequence(newSequence)
  }

  const removeSequenceItem = (index: number) => {
    if (sequence.length <= 2) {
      setError('Video requires at least 2 screens')
      return
    }
    setSequence(sequence.filter((_, i) => i !== index))
  }

  // Proceed from sequence to metadata
  const handleProceedToMetadata = () => {
    if (sequence.length < 2) {
      setError('Please keep at least 2 screens in the sequence')
      return
    }
    setError(null)
    setStep('metadata')
  }

  // Import selected frames (original mode)
  const handleImportFrames = async () => {
    setStep('importing')
    setImportProgress(0)
    setError(null)

    try {
      const framesToImport = frames.filter(f => selectedFrames.has(f.id))
      
      const res = await fetch('/api/figma/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey,
          fileName,
          frames: framesToImport.map(f => ({ id: f.id, name: f.name })),
          metadata: {
            oem,
            screenType,
            assetType,
            description: description || undefined,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import')
      }

      setImportedCount(data.imported)
      setImportProgress(100)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import frames')
      setStep('metadata')
    }
  }

  // Create video from sequence
  const handleCreateVideo = async () => {
    setStep('importing')
    setImportProgress(0)
    setError(null)

    try {
      const res = await fetch('/api/figma/import-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          figmaUrl,
          fileKey,
          videoName: videoName || `${fileName} - Flow`,
          metadata: {
            oem,
            screenType,
            assetType,
            description: description || undefined,
          },
          sequence: sequence.map(item => ({
            frameId: item.screen.id,
            frameName: item.screen.name,
            duration: item.duration,
            transition: item.transition,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create video')
      }

      setImportedCount(sequence.length)
      setImportProgress(100)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create video')
      setStep('metadata')
    }
  }

  // Complete and close
  const handleDone = () => {
    onSuccess()
    handleClose()
  }

  if (!isOpen) return null

  const currentItems = importMode === 'video' ? allScreens : frames

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.5 3.5A2 2 0 0 1 7.5 2H12v5H7.5a2.5 2.5 0 0 1 0-5zM12 2h4.5a2.5 2.5 0 0 1 0 5H12V2zM5.5 9.5A2.5 2.5 0 0 1 8 7h4v5H8a2.5 2.5 0 0 1-2.5-2.5zM12 7h4.5a2.5 2.5 0 0 1 0 5H12V7zM5.5 15.5A2.5 2.5 0 0 1 8 13h4v5a2.5 2.5 0 0 1-5 0v-2.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import from Figma</h2>
              <p className="text-sm text-slate-400">
                {step === 'mode' && 'Choose how to import'}
                {step === 'url' && (importMode === 'video' ? 'Paste your prototype URL' : 'Paste your Figma file URL')}
                {step === 'select' && (importMode === 'video' ? `${fileName} - Select screens for video` : `${fileName} - Select frames`)}
                {step === 'sequence' && 'Configure video sequence'}
                {step === 'metadata' && (importMode === 'video' ? 'Video settings' : 'Add metadata')}
                {step === 'importing' && (importMode === 'video' ? 'Creating video...' : 'Importing frames...')}
                {step === 'done' && 'Import complete!'}
              </p>
            </div>
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
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-sm">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p>{error}</p>
                  {error.toLowerCase().includes('rate limit') && (
                    <p className="mt-2 text-xs text-red-400">
                      Tip: Figma limits API requests. Wait 2-3 minutes before trying again.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 0: Choose Mode */}
          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-6">
                Choose how you want to import from Figma:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Import as Video */}
                <button
                  onClick={() => handleSelectMode('video')}
                  className="p-6 bg-slate-900/50 border-2 border-slate-700 hover:border-fuchsia-500 rounded-2xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 flex items-center justify-center mb-4 group-hover:bg-fuchsia-500/30 transition-colors">
                    <svg className="w-6 h-6 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Create a Video</h3>
                  <p className="text-sm text-slate-400">
                    Select screens, arrange their order, set timing and transitions, then generate an MP4 video.
                  </p>
                </button>

                {/* Import Frames */}
                <button
                  onClick={() => handleSelectMode('frames')}
                  className="p-6 bg-slate-900/50 border-2 border-slate-700 hover:border-violet-500 rounded-2xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/30 transition-colors">
                    <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Import Individual Frames</h3>
                  <p className="text-sm text-slate-400">
                    Select and import specific frames as individual image assets.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Enter URL */}
          {step === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {importMode === 'video' ? 'Figma Prototype URL' : 'Figma File URL'}
                </label>
                <input
                  type="text"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  placeholder={importMode === 'video' 
                    ? "https://www.figma.com/proto/..." 
                    : "https://www.figma.com/file/..."
                  }
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              <p className="text-sm text-slate-400">
                {importMode === 'video' 
                  ? 'Paste your Figma prototype URL. You\'ll be able to select screens and configure the video sequence.'
                  : 'Paste the URL from your Figma file. Make sure you have configured your Figma access token in the settings.'
                }
              </p>
            </div>
          )}

          {/* Step 2: Select Screens/Frames */}
          {step === 'select' && (
            <div className="space-y-4">
              {/* Page selector */}
              {pages.length > 1 && (
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-slate-300">Page:</label>
                  <select
                    value={selectedPage}
                    onChange={(e) => setSelectedPage(e.target.value)}
                    className="px-4 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {pages.map(page => (
                      <option key={page.id} value={page.id}>{page.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleLoadFrames}
                    disabled={loading}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load Frames'}
                  </button>
                </div>
              )}

              {/* Loading state */}
              {loading && currentItems.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Screens/Frames grid */}
              {currentItems.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      {selectedFrames.size} of {currentItems.length} {importMode === 'video' ? 'screens' : 'frames'} selected
                      {importMode === 'video' && selectedFrames.size < 2 && (
                        <span className="text-amber-400 ml-2">(select at least 2)</span>
                      )}
                    </span>
                    <button
                      onClick={selectAllFrames}
                      className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      {selectedFrames.size === currentItems.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2">
                    {currentItems.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => toggleFrame(item.id)}
                        className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all ${
                          selectedFrames.has(item.id)
                            ? 'border-violet-500 ring-2 ring-violet-500/50 bg-violet-500/10'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                        }`}
                      >
                        {item.thumbnailUrl ? (
                          <Image
                            src={item.thumbnailUrl}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                              selectedFrames.has(item.id) ? 'bg-violet-500/30' : 'bg-slate-700/50'
                            }`}>
                              <svg className={`w-6 h-6 ${selectedFrames.has(item.id) ? 'text-violet-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <p className={`text-xs font-medium line-clamp-3 ${selectedFrames.has(item.id) ? 'text-violet-300' : 'text-slate-400'}`}>
                              {item.name}
                            </p>
                          </div>
                        )}
                        {item.thumbnailUrl && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-xs text-white truncate">{item.name}</p>
                          </div>
                        )}
                        {selectedFrames.has(item.id) && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                            <span className="text-xs text-white font-bold">
                              {Array.from(selectedFrames).indexOf(item.id) + 1}
                            </span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Configure Sequence (video mode only) */}
          {step === 'sequence' && importMode === 'video' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Arrange the order of screens and configure timing and transitions for your video.
              </p>

              {/* Sequence list */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {sequence.map((item, index) => (
                  <div
                    key={item.screen.id}
                    className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-xl"
                  >
                    {/* Order number */}
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm">
                      {index + 1}
                    </div>

                    {/* Thumbnail placeholder */}
                    <div className="w-10 h-14 relative rounded-lg overflow-hidden bg-violet-500/20 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate font-medium">{item.screen.name}</p>
                    </div>

                    {/* Duration */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Duration:</label>
                      <input
                        type="number"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={item.duration}
                        onChange={(e) => updateSequenceItem(index, { duration: parseFloat(e.target.value) || 2 })}
                        className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                      <span className="text-xs text-slate-400">sec</span>
                    </div>

                    {/* Transition (not for last item) */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Transition:</label>
                      <select
                        value={item.transition}
                        onChange={(e) => updateSequenceItem(index, { transition: e.target.value as SequenceItem['transition'] })}
                        disabled={index === sequence.length - 1}
                        className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                      >
                        {TRANSITION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveSequenceItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveSequenceItem(index, 'down')}
                        disabled={index === sequence.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeSequenceItem(index)}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                      title="Remove from sequence"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Total duration */}
              <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-xl">
                <span className="text-sm text-slate-400">Total video duration:</span>
                <span className="text-sm text-white font-medium">
                  ~{sequence.reduce((acc, item) => acc + item.duration, 0).toFixed(1)} seconds
                </span>
              </div>
            </div>
          )}

          {/* Step 4: Metadata */}
          {step === 'metadata' && (
            <div className="space-y-4">
              {importMode === 'video' ? (
                <p className="text-sm text-slate-400 mb-4">
                  Set the video name and metadata for your {sequence.length}-screen video.
                </p>
              ) : (
                <p className="text-sm text-slate-400 mb-4">
                  Set metadata for {selectedFrames.size} selected frame{selectedFrames.size > 1 ? 's' : ''}
                </p>
              )}
              
              {/* Video Name (only for video mode) */}
              {importMode === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Video Name</label>
                  <input
                    type="text"
                    value={videoName}
                    onChange={(e) => setVideoName(e.target.value)}
                    placeholder="My Prototype Flow"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">OEM</label>
                  <select
                    value={oem}
                    onChange={(e) => setOem(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {OEM_OPTIONS.filter(o => o !== 'All OEMs').map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Screen Type</label>
                  <select
                    value={screenType}
                    onChange={(e) => setScreenType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {SCREEN_TYPE_OPTIONS.filter(o => o !== 'All Types').map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Asset Type</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {ASSET_TYPE_OPTIONS.filter(o => o !== 'All Assets').map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={importMode === 'video' 
                    ? "Add a description for this video..."
                    : "Add a description for these assets..."
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 5: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-slate-300">
                {importMode === 'video' 
                  ? `Creating video from ${sequence.length} screens...`
                  : `Importing ${selectedFrames.size} frames from Figma...`
                }
              </p>
              <p className="text-sm text-slate-500">
                {importMode === 'video' && 'This may take a minute while we export frames and encode the video.'}
              </p>
              <div className="w-full max-w-xs h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 6: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {importMode === 'video' ? 'Video Created!' : 'Import Complete!'}
                </h3>
                <p className="text-slate-400">
                  {importMode === 'video' 
                    ? `Successfully created video from ${importedCount} screens`
                    : `Successfully imported ${importedCount} frame${importedCount > 1 ? 's' : ''} from Figma`
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          {step === 'mode' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <div />
            </>
          )}

          {step === 'url' && (
            <>
              <button
                onClick={() => setStep('mode')}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleLoadFile}
                disabled={loading || !figmaUrl.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Continue'}
              </button>
            </>
          )}

          {step === 'select' && (
            <>
              <button
                onClick={() => setStep('url')}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleProceedFromSelect}
                disabled={selectedFrames.size === 0 || (importMode === 'video' && selectedFrames.size < 2)}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue ({selectedFrames.size} selected)
              </button>
            </>
          )}

          {step === 'sequence' && (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleProceedToMetadata}
                disabled={sequence.length < 2}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </>
          )}

          {step === 'metadata' && (
            <>
              <button
                onClick={() => setStep(importMode === 'video' ? 'sequence' : 'select')}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={importMode === 'video' ? handleCreateVideo : handleImportFrames}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all flex items-center gap-2"
              >
                {importMode === 'video' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Create Video
                  </>
                ) : (
                  'Import Frames'
                )}
              </button>
            </>
          )}

          {step === 'importing' && (
            <div className="w-full text-center text-sm text-slate-400">
              Please wait...
            </div>
          )}

          {step === 'done' && (
            <>
              <div />
              <button
                onClick={handleDone}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-xl transition-all"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
