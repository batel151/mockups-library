'use client'

import AssetCard from './AssetCard'

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

interface AssetGridProps {
  assets: Asset[]
  isLoading: boolean
  onDelete: (id: string) => void
}

export default function AssetGrid({ assets, isLoading, onDelete }: AssetGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/50 animate-pulse">
            <div className="aspect-video bg-slate-700/50" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-slate-700/50 rounded w-3/4" />
              <div className="flex gap-2">
                <div className="h-6 bg-slate-700/50 rounded w-20" />
                <div className="h-6 bg-slate-700/50 rounded w-24" />
              </div>
              <div className="h-10 bg-slate-700/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
          <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No assets found</h3>
        <p className="text-slate-400 text-center max-w-md">
          No assets match your current filters. Try adjusting your search or upload some new assets.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {assets.map((asset, index) => (
        <div 
          key={asset.id}
          className="animate-fadeIn"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <AssetCard asset={asset} onDelete={onDelete} />
        </div>
      ))}
    </div>
  )
}

