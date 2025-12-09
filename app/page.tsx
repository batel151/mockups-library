'use client'

import { useState, useEffect, useCallback } from 'react'
import SearchFilter from '@/components/SearchFilter'
import AssetGrid from '@/components/AssetGrid'

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

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', oem: '', screenType: '', assetType: '' })

  const fetchAssets = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.oem) params.set('oem', filters.oem)
      if (filters.screenType) params.set('screenType', filters.screenType)
      if (filters.assetType) params.set('assetType', filters.assetType)

      const res = await fetch(`/api/assets?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAssets(data)
      }
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const handleFilterChange = useCallback((newFilters: { search: string; oem: string; screenType: string; assetType: string }) => {
    setFilters(newFilters)
  }, [])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAssets(prev => prev.filter(asset => asset.id !== id))
      }
    } catch (error) {
      console.error('Error deleting asset:', error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Asset Library</h2>
        <p className="text-slate-400">
          {isLoading ? 'Loading...' : `${assets.length} asset${assets.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      <div className="mb-8">
        <SearchFilter onFilterChange={handleFilterChange} />
      </div>

      <AssetGrid assets={assets} isLoading={isLoading} onDelete={handleDelete} />
    </div>
  )
}
