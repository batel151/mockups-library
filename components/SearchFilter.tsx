'use client'

import { useState, useEffect } from 'react'

const OEM_OPTIONS = [
  'All OEMs',
  'Xiaomi',
  'Realme',
  'Motorola',
  'Samsung',
  'OnePlus',
  'OPPO',
  'Vivo',
  'Other'
]

const SCREEN_TYPE_OPTIONS = [
  'All Types',
  'Lockscreen',
  'Post-click',
  'Game',
  'Home Screen',
  'Settings',
  'Notification',
  'Carousel',
  'Video Page',
  'Hub',
  'Story Page',
  'Other'
]

const ASSET_TYPE_OPTIONS = [
  'All Assets',
  'Mockup',
  'Live Experience'
]

interface SearchFilterProps {
  onFilterChange: (filters: { search: string; oem: string; screenType: string; assetType: string }) => void
}

export default function SearchFilter({ onFilterChange }: SearchFilterProps) {
  const [search, setSearch] = useState('')
  const [oem, setOem] = useState('All OEMs')
  const [screenType, setScreenType] = useState('All Types')
  const [assetType, setAssetType] = useState('All Assets')

  useEffect(() => {
    onFilterChange({
      search,
      oem: oem === 'All OEMs' ? '' : oem,
      screenType: screenType === 'All Types' ? '' : screenType,
      assetType: assetType === 'All Assets' ? '' : assetType,
    })
  }, [search, oem, screenType, assetType, onFilterChange])

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
      {/* Search Input */}
      <div className="flex-1 relative">
        <svg 
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
        />
      </div>

      {/* OEM Filter */}
      <div className="relative">
        <select
          value={oem}
          onChange={(e) => setOem(e.target.value)}
          className="appearance-none w-full sm:w-44 px-4 py-3 pr-10 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
        >
          {OEM_OPTIONS.map(option => (
            <option key={option} value={option} className="bg-slate-900">
              {option}
            </option>
          ))}
        </select>
        <svg 
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Screen Type Filter */}
      <div className="relative">
        <select
          value={screenType}
          onChange={(e) => setScreenType(e.target.value)}
          className="appearance-none w-full sm:w-44 px-4 py-3 pr-10 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
        >
          {SCREEN_TYPE_OPTIONS.map(option => (
            <option key={option} value={option} className="bg-slate-900">
              {option}
            </option>
          ))}
        </select>
        <svg 
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Asset Type Filter */}
      <div className="relative">
        <select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          className="appearance-none w-full sm:w-44 px-4 py-3 pr-10 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
        >
          {ASSET_TYPE_OPTIONS.map(option => (
            <option key={option} value={option} className="bg-slate-900">
              {option}
            </option>
          ))}
        </select>
        <svg 
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

export { OEM_OPTIONS, SCREEN_TYPE_OPTIONS, ASSET_TYPE_OPTIONS }

