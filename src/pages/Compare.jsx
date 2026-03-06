import { useState } from 'react'
import ImageUpload from '../components/ImageUpload'
import CircularRating from '../components/CircularRating'
import SkeletonLoader from '../components/SkeletonLoader'
import ApiKeyModal from '../components/ApiKeyModal'
import { comparePhotos } from '../lib/ai'
import { getSettings, addToHistory } from '../lib/storage'
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
  const [showSettings, setShowSettings] = useState(false)

  const handleSelectA = (f) => {
    setFileA(f)
    setPreviewA(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }

  const handleSelectB = (f) => {
    setFileB(f)
    setPreviewB(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }

  const handleCompare = async () => {
    const settings = getSettings()
    if (!settings.apiKey) {
      setShowSettings(true)
      return
    }

    setLoading(true)
    setError('')

    try {
      const comparison = await comparePhotos(fileA, fileB, settings.apiKey, settings.provider)
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
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
      <p className="text-xs text-gray-400 text-center mb-3">{data.summary}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { l: 'Composition', v: data.composition },
          { l: 'Lighting', v: data.lighting },
          { l: 'Color', v: data.color_balance },
          { l: 'Technical', v: data.technical_quality },
        ].map((c) => (
          <div key={c.l} className="bg-white/[0.04] rounded-lg p-2 flex justify-between">
            <span className="text-gray-500">{c.l}</span>
            <span className="font-semibold">{c.v}/10</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compare & Contrast</h1>
        <p className="text-sm text-gray-400 mt-1">Upload two photos to find out which one is better.</p>
      </div>

      <div className="flex items-center justify-end">
        <button onClick={() => setShowSettings(true)} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          AI Settings
        </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SkeletonLoader type="critique" />
          <SkeletonLoader type="critique" />
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
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-brand-400">Verdict: </span>
              {result.reason}
            </p>
          </div>

          <button
            onClick={() => {
              setFileA(null)
              setFileB(null)
              setPreviewA(null)
              setPreviewB(null)
              setResult(null)
            }}
            className="btn-secondary w-full"
          >
            Compare Another Pair
          </button>
        </div>
      )}

      {showSettings && <ApiKeyModal onClose={() => setShowSettings(false)} onSave={() => {}} />}
    </div>
  )
}
