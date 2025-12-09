'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function SettingsPage() {
  const [figmaToken, setFigmaToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState<'idle' | 'testing' | 'saving' | 'success' | 'error' | 'rate_limited'>('idle')
  const [message, setMessage] = useState('')
  const [rateLimitInfo, setRateLimitInfo] = useState<string | null>(null)

  // Check current API status on load
  useEffect(() => {
    checkApiStatus()
  }, [])

  const checkApiStatus = async () => {
    try {
      const res = await fetch('/api/figma/test')
      const data = await res.json()
      
      if (data.status === 'rate_limited') {
        setRateLimitInfo('Current token is rate limited by Figma API')
      } else if (data.status === 'ok') {
        setRateLimitInfo(null)
        setMessage(`Currently connected as: ${data.user}`)
      } else if (data.status === 'error') {
        setRateLimitInfo(data.message)
      }
    } catch {
      // Ignore errors
    }
  }

  const handleTestToken = async () => {
    if (!figmaToken.trim()) {
      setStatus('error')
      setMessage('Please enter a Figma access token first')
      return
    }

    setStatus('testing')
    setMessage('')

    try {
      const res = await fetch('https://api.figma.com/v1/me', {
        headers: { 'X-Figma-Token': figmaToken.trim() }
      })

      if (res.status === 429) {
        setStatus('rate_limited')
        setMessage('This token is rate limited. Try a different Figma account.')
        return
      }

      if (res.ok) {
        const data = await res.json()
        setStatus('success')
        setMessage(`Token valid! Account: ${data.email || data.handle}`)
      } else {
        setStatus('error')
        setMessage('Invalid token')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Failed to test token')
    }
  }

  const handleSaveToken = async () => {
    if (!figmaToken.trim()) {
      setStatus('error')
      setMessage('Please enter a token first')
      return
    }

    setStatus('saving')
    setMessage('')

    try {
      const res = await fetch('/api/figma/update-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: figmaToken.trim() })
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage(data.message)
        setRateLimitInfo(null)
        // Clear the input after successful save
        setFigmaToken('')
      } else {
        setStatus(res.status === 429 ? 'rate_limited' : 'error')
        setMessage(data.error)
      }
    } catch (error) {
      setStatus('error')
      setMessage('Failed to save token')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950">
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
          <p className="text-slate-400">Configure your Figma integration.</p>
        </div>

        {/* Rate Limit Warning */}
        {rateLimitInfo && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm text-red-300 font-medium">Figma API Rate Limited</p>
                <p className="text-xs text-red-400/70 mt-1">
                  {rateLimitInfo}. To fix this, you need to use a token from a <strong>different Figma account</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Figma Integration Section */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.5 3.5A2 2 0 0 1 7.5 2H12v5H7.5a2.5 2.5 0 0 1 0-5zM12 2h4.5a2.5 2.5 0 0 1 0 5H12V2zM5.5 9.5A2.5 2.5 0 0 1 8 7h4v5H8a2.5 2.5 0 0 1-2.5-2.5zM12 7h4.5a2.5 2.5 0 0 1 0 5H12V7zM5.5 15.5A2.5 2.5 0 0 1 8 13h4v5a2.5 2.5 0 0 1-5 0v-2.5z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Figma Integration</h3>
                <p className="text-sm text-slate-400">Update your Figma access token</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Current Status */}
            {message && status !== 'testing' && status !== 'saving' && (
              <div className={`p-3 rounded-lg text-sm ${
                status === 'success' ? 'bg-emerald-500/20 text-emerald-300' :
                status === 'rate_limited' ? 'bg-amber-500/20 text-amber-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {message}
              </div>
            )}

            {/* Token Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Personal Access Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={figmaToken}
                  onChange={(e) => setFigmaToken(e.target.value)}
                  placeholder="figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 pr-12 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 font-mono text-sm"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
                >
                  {showToken ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Get a token from{' '}
                <a 
                  href="https://www.figma.com/developers/api#access-tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 underline"
                >
                  Figma Settings → Personal Access Tokens
                </a>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleTestToken}
                disabled={status === 'testing' || status === 'saving' || !figmaToken.trim()}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {status === 'testing' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Testing...
                  </>
                ) : (
                  'Test Token'
                )}
              </button>

              <button
                onClick={handleSaveToken}
                disabled={status === 'testing' || status === 'saving' || !figmaToken.trim()}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {status === 'saving' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save & Update Token'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
          <h4 className="text-sm font-medium text-slate-300 mb-2">How to get a new token:</h4>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://www.figma.com/settings" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">Figma Settings</a></li>
            <li>Scroll down to "Personal access tokens"</li>
            <li>Click "Generate new token"</li>
            <li>Copy the token (starts with "figd_")</li>
            <li>Paste it above and click "Save & Update Token"</li>
          </ol>
          <p className="text-xs text-amber-400 mt-3">
            <strong>Tip:</strong> If you're rate limited, use a token from a different Figma account.
          </p>
        </div>

        {/* Back to Library */}
        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← Back to Library
          </Link>
        </div>
      </main>
    </div>
  )
}
