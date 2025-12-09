'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import FigmaImportModal from './FigmaImportModal'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [showFigmaModal, setShowFigmaModal] = useState(false)
  
  const handleFigmaImportSuccess = () => {
    // Refresh the current page to show new assets
    router.refresh()
    window.location.reload()
  }
  
  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Mockups & Videos</h1>
                <p className="text-xs text-slate-400">Asset Library</p>
              </div>
            </Link>
            
            <nav className="flex items-center gap-2">
              <Link 
                href="/"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/' 
                    ? 'bg-slate-700/50 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Library
              </Link>
              <Link 
                href="/settings"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/settings' 
                    ? 'bg-slate-700/50 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Settings
              </Link>
              
              {/* Figma Import Button */}
              <button
                onClick={() => setShowFigmaModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-slate-700/50 text-white hover:bg-slate-600/50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.5 3.5A2 2 0 0 1 7.5 2H12v5H7.5a2.5 2.5 0 0 1 0-5zM12 2h4.5a2.5 2.5 0 0 1 0 5H12V2zM5.5 9.5A2.5 2.5 0 0 1 8 7h4v5H8a2.5 2.5 0 0 1-2.5-2.5zM12 7h4.5a2.5 2.5 0 0 1 0 5H12V7zM5.5 15.5A2.5 2.5 0 0 1 8 13h4v5a2.5 2.5 0 0 1-5 0v-2.5z"/>
                </svg>
                Import Figma
              </button>
              
              <Link 
                href="/upload"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  pathname === '/upload' 
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' 
                    : 'bg-violet-600/80 text-white hover:bg-violet-600 hover:shadow-lg hover:shadow-violet-500/25'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload
              </Link>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Figma Import Modal */}
      <FigmaImportModal
        isOpen={showFigmaModal}
        onClose={() => setShowFigmaModal(false)}
        onSuccess={handleFigmaImportSuccess}
      />
    </>
  )
}
