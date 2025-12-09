'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import FlowCard from '@/components/FlowCard'
import FlowViewer from '@/components/FlowViewer'
import CreateFlowModal from '@/components/CreateFlowModal'

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

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/flows')
      const data = await res.json()
      setFlows(data.flows || [])
    } catch (error) {
      console.error('Failed to fetch flows:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlows()
  }, [fetchFlows])

  const handleFlowDeleted = () => {
    fetchFlows()
  }

  const handleFlowCreated = () => {
    setShowCreateModal(false)
    fetchFlows()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Mockups & Videos
                </h1>
              </Link>
              <nav className="flex items-center gap-6">
                <Link 
                  href="/" 
                  className="text-slate-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Library
                </Link>
                <Link 
                  href="/flows" 
                  className="text-white text-sm font-medium"
                >
                  Flows
                </Link>
                <Link 
                  href="/upload" 
                  className="text-slate-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Upload
                </Link>
                <Link 
                  href="/settings" 
                  className="text-slate-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Flow
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Prototype Flows</h2>
          <p className="text-slate-400">
            Create and view animated sequences of frames from your assets.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-video bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No flows yet</h3>
            <p className="text-slate-400 mb-6 max-w-md">
              Create your first flow by combining frames from your asset library into an animated sequence.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
            >
              Create Your First Flow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {flows.map(flow => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onClick={() => setSelectedFlow(flow)}
                onDelete={handleFlowDeleted}
              />
            ))}
          </div>
        )}
      </main>

      {/* Flow Viewer Modal */}
      {selectedFlow && (
        <FlowViewer
          flow={selectedFlow}
          onClose={() => setSelectedFlow(null)}
        />
      )}

      {/* Create Flow Modal */}
      {showCreateModal && (
        <CreateFlowModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleFlowCreated}
        />
      )}
    </div>
  )
}


