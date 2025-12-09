'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { OEM_OPTIONS, SCREEN_TYPE_OPTIONS, ASSET_TYPE_OPTIONS } from './SearchFilter'

export default function UploadForm() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [name, setName] = useState('')
  const [oem, setOem] = useState('')
  const [screenType, setScreenType] = useState('')
  const [assetType, setAssetType] = useState('')
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setIsVideo(selectedFile.type.startsWith('video/'))
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }, [name])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov']
    },
    maxFiles: 1,
    multiple: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name || !oem || !screenType || !assetType) {
      setError('Please fill in all required fields')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Step 1: Upload file to local storage
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) throw new Error('Failed to upload file')
      const { url } = await uploadRes.json()

      // Step 2: Save asset metadata
      const format = file.name.split('.').pop()?.toLowerCase() || 'unknown'
      const assetRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          filename: file.name,
          url,
          oem,
          screenType,
          assetType,
          description: description || null,
          format,
          size: file.size,
        }),
      })

      if (!assetRes.ok) throw new Error('Failed to save asset metadata')

      // Success - redirect to home
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setIsVideo(false)
  }

  const filteredOemOptions = OEM_OPTIONS.filter(o => o !== 'All OEMs')
  const filteredScreenTypeOptions = SCREEN_TYPE_OPTIONS.filter(o => o !== 'All Types')
  const filteredAssetTypeOptions = ASSET_TYPE_OPTIONS.filter(o => o !== 'All Assets')

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? 'border-violet-500 bg-violet-500/10'
            : file
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-slate-600 hover:border-violet-500/50 hover:bg-slate-800/50'
        }`}
      >
        <input {...getInputProps()} />
        
        {preview ? (
          <div className="space-y-4">
            <div className="relative w-full max-w-md mx-auto aspect-video rounded-xl overflow-hidden bg-slate-900">
              {isVideo ? (
                <video
                  src={preview}
                  className="w-full h-full object-contain"
                  controls
                  muted
                />
              ) : (
                <Image
                  src={preview}
                  alt="Preview"
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">{file?.name}</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearFile() }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Click to replace
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-white">
                {isDragActive ? 'Drop the file here' : 'Drag & drop your file here'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or click to browse (PNG, JPG, GIF, WebP, MP4, WebM, MOV)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid gap-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
            Asset Name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Xiaomi Lockscreen Q4 Campaign"
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
            required
          />
        </div>

        {/* OEM, Screen Type, and Asset Type */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="oem" className="block text-sm font-medium text-slate-300 mb-2">
              OEM <span className="text-red-400">*</span>
            </label>
            <select
              id="oem"
              value={oem}
              onChange={(e) => setOem(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
              required
            >
              <option value="" className="bg-slate-900">Select OEM...</option>
              {filteredOemOptions.map(option => (
                <option key={option} value={option} className="bg-slate-900">
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="screenType" className="block text-sm font-medium text-slate-300 mb-2">
              Screen Type <span className="text-red-400">*</span>
            </label>
            <select
              id="screenType"
              value={screenType}
              onChange={(e) => setScreenType(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
              required
            >
              <option value="" className="bg-slate-900">Select type...</option>
              {filteredScreenTypeOptions.map(option => (
                <option key={option} value={option} className="bg-slate-900">
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assetType" className="block text-sm font-medium text-slate-300 mb-2">
              Asset Type <span className="text-red-400">*</span>
            </label>
            <select
              id="assetType"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
              required
            >
              <option value="" className="bg-slate-900">Select asset type...</option>
              {filteredAssetTypeOptions.map(option => (
                <option key={option} value={option} className="bg-slate-900">
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
            Description <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any notes about this asset..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all resize-none"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isUploading || !file}
        className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-violet-500/25"
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Uploading...
          </span>
        ) : (
          'Upload Asset'
        )}
      </button>
    </form>
  )
}
