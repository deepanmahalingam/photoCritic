import { useState } from 'react'
import ImageUpload from '../components/ImageUpload'
import CircularRating from '../components/CircularRating'
import SkeletonLoader from '../components/SkeletonLoader'
import { comparePhotos, generateCaptions, getGeminiKey, saveGeminiKey } from '../lib/ai'
import { addToHistory } from '../lib/storage'
import { useAuth } from '../context/AuthContext'

export default function Compare() {
  const { user } = useAuth()
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [previewA, setPreviewA] = useState(null)
  const [previewB, setPreviewB] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Caption state
  const [captionsA, setCaptionsA] = useState([])
  const [captionsB, setCaptionsB] = useState([])
  const [captionsLoading, setCaptionsLoading] = useState(false)
  const [captionError, setCaptionError] = useState('')
  const [apiKey, setApiKey] = useState(getGeminiKey())
  const [keyInput, setKeyInput] = useState('')
  const [copied, setCopied] = useState(null) // { side: 'A'|'B', idx: number }

  const handleSelectA = (f) => {
    setFileA(f); setPreviewA(URL.createObjectURL(f)); setResult(null); setError('')
    setCaptionsA([]); setCaptionError('')
  }
  const handleSelectB = (f) => {
    setFileB(f); setPreviewB(URL.createObjectURL(f)); setResult(null); setError('')
    setCaptionsB([]); setCaptionError('')
  }

  const handleCompare = async () => {
    setLoading(true); setError('')
    setCaptionsA([]); setCaptionsB([]); setCaptionError('')

    try {
      const comparison = await comparePhotos(fileA, fileB)
      setResult(comparison)
      if (user) {
        addToHistory({
          type: 'compare',
          ratingA: comparison.image_a.overall_rating,
          ratingB: comparison.image_b.overall_rating,
          winner: comparison.winner,
          reason: comparison.reason,
          thumbnailA: previewA,
          thumbnailB: previewB,
        })
      }

      // Generate captions in parallel if API key exists
      const key = getGeminiKey()
      if (key) {
        fetchCaptions(key)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCaptions = async (key) => {
    setCaptionsLoading(true)
    setCaptionError('')
    try {
      const [capsA, capsB] = await Promise.all([
        generateCaptions(fileA, key),
        generateCaptions(fileB, key),
      ])
      setCaptionsA(capsA)
      setCaptionsB(capsB)
    } catch (err) {
      setCaptionError(err.message)
    } finally {
      setCaptionsLoading(false)
    }
  }

  const handleSaveKey = () => {
    if (!keyInput.trim()) return
    saveGeminiKey(keyInput)
    setApiKey(keyInput.trim())
    setKeyInput('')
    // If result already exists, generate captions now
    if (result && fileA && fileB) {
      fetchCaptions(keyInput.trim())
    }
  }

  const handleCopy = (text, side, idx) => {
    navigator.clipboard?.writeText(text)
    setCopied({ side, idx })
    setTimeout(() => setCopied(null), 1500)
  }

  const renderImageResult = (data, label, isWinner) => (
    <div className={`glass-card p-4 relative ${isWinner ? 'ring-2 ring-green-500/40' : ''}`}>
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.04 6.04 0 0 1-2.019 1.127M16.27 9.728a6.04 6.04 0 0 1-2.019 1.127m0 0a6 6 0 0 1-4.502 0" />
          </svg>
          WINNER
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{label}</h3>
      <div className="flex justify-center mb-3">
        <CircularRating rating={data.overall_rating} size={80} strokeWidth={5} />
      </div>
      <p className="text-xs text-gray-400 text-center mb-3 leading-relaxed">{data.summary}</p>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {[
          { l: 'Composition', v: data.composition },
          { l: 'Lighting', v: data.lighting },
          { l: 'Color', v: data.color_balance },
          { l: 'Technical', v: data.technical_quality },
          { l: 'Artistic', v: data.artistic_quality },
        ].map((c) => (
          <div key={c.l} className="bg-white/[0.04] rounded-lg p-2 flex justify-between">
            <span className="text-gray-500">{c.l}</span>
            <span className="font-semibold">{c.v}/10</span>
          </div>
        ))}
      </div>
      {data.feedback && data.feedback.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/[0.06]">
          {data.feedback.map((point, i) => (
            <p key={i} className="text-xs text-gray-400 leading-relaxed pl-3 border-l-2 border-brand-600/20">
              {point}
            </p>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compare & Contrast</h1>
        <p className="text-sm text-gray-400 mt-1">Upload two photos to find out which one is better.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ImageUpload onSelect={handleSelectA} preview={previewA} label="Image A" />
        <ImageUpload onSelect={handleSelectB} preview={previewB} label="Image B" />
      </div>

      {fileA && fileB && !loading && !result && (
        <button onClick={handleCompare} className="btn-primary w-full flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          Compare Photos
        </button>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-brand-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-400">Comparing photos using smart vision engine...</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonLoader type="critique" />
            <SkeletonLoader type="critique" />
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card p-4 border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={handleCompare} className="text-sm text-brand-400 hover:text-brand-300 mt-2">
            Try again
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderImageResult(result.image_a, 'Image A', result.winner === 'A')}
            {renderImageResult(result.image_b, 'Image B', result.winner === 'B')}
          </div>

          <div className="glass-card p-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              <span className="font-semibold text-brand-400">Verdict: </span>
              {result.reason}
            </p>
          </div>

          {/* Caption Suggestions */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
              </svg>
              Caption Suggestions
            </h3>

            {!apiKey ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Add your free Gemini API key to generate captions for both photos.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                    placeholder="Paste your Gemini API key"
                    className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  />
                  <button onClick={handleSaveKey} className="btn-primary px-4 py-2 text-sm">
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  Get a free key at{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                    aistudio.google.com/apikey
                  </a>
                </p>
              </div>
            ) : captionsLoading ? (
              <div className="flex items-center gap-3 py-2">
                <svg className="animate-spin h-4 w-4 text-brand-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-gray-400">Generating captions for both photos...</span>
              </div>
            ) : captionError ? (
              <div className="space-y-2">
                <p className="text-sm text-red-400">{captionError}</p>
                <button
                  onClick={() => fetchCaptions(apiKey)}
                  className="text-sm text-brand-400 hover:text-brand-300"
                >
                  Try again
                </button>
              </div>
            ) : (captionsA.length > 0 || captionsB.length > 0) ? (
              <div className="space-y-5">
                {captionsA.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Image A</p>
                    <div className="space-y-2">
                      {captionsA.slice(0, 3).map((caption, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 group cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-white/[0.04] transition-colors"
                          onClick={() => handleCopy(caption, 'A', i)}
                          title="Click to copy"
                        >
                          <p className="text-xs text-gray-300 leading-relaxed italic flex-1 pl-3 border-l-2 border-brand-600/20">
                            &ldquo;{caption}&rdquo;
                          </p>
                          {copied?.side === 'A' && copied?.idx === i ? (
                            <svg className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-brand-400 transition-colors mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {captionsB.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Image B</p>
                    <div className="space-y-2">
                      {captionsB.slice(0, 3).map((caption, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 group cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-white/[0.04] transition-colors"
                          onClick={() => handleCopy(caption, 'B', i)}
                          title="Click to copy"
                        >
                          <p className="text-xs text-gray-300 leading-relaxed italic flex-1 pl-3 border-l-2 border-purple-600/20">
                            &ldquo;{caption}&rdquo;
                          </p>
                          {copied?.side === 'B' && copied?.idx === i ? (
                            <svg className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-brand-400 transition-colors mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-600 mt-1">Tap any caption to copy it</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Captions will appear here after comparison.</p>
            )}
          </div>

          <button
            onClick={() => {
              setFileA(null); setFileB(null); setPreviewA(null); setPreviewB(null); setResult(null)
              setCaptionsA([]); setCaptionsB([]); setCaptionError('')
            }}
            className="btn-secondary w-full"
          >
            Compare Another Pair
          </button>
        </div>
      )}
    </div>
  )
}
