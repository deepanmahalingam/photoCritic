import { useState } from 'react'
import ImageUpload from '../components/ImageUpload'
import CircularRating from '../components/CircularRating'
import SkeletonLoader from '../components/SkeletonLoader'
import { critiquePhoto } from '../lib/ai'
import { addToHistory } from '../lib/storage'
import { useAuth } from '../context/AuthContext'

export default function Critique() {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSelect = (f) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')

    try {
      const critique = await critiquePhoto(file)
      setResult(critique)

      if (user) {
        addToHistory({
          type: 'single',
          rating: critique.overall_rating,
          summary: critique.summary,
          thumbnail: preview,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const categories = result
    ? [
        { label: 'Composition', value: result.composition },
        { label: 'Lighting', value: result.lighting },
        { label: 'Color', value: result.color_balance },
        { label: 'Technical', value: result.technical_quality },
        { label: 'Artistic', value: result.artistic_quality },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Photo Critique</h1>
        <p className="text-sm text-gray-400 mt-1">Upload a photo to receive intelligent feedback describing your shot.</p>
      </div>

      <ImageUpload onSelect={handleSelect} preview={preview} label="Upload your photo" />

      {file && !loading && !result && (
        <button onClick={handleAnalyze} className="btn-primary w-full flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
          Analyze Photo
        </button>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-brand-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-400">Analyzing your photo using smart vision engine...</span>
          </div>
          <SkeletonLoader type="critique" />
        </div>
      )}

      {error && (
        <div className="glass-card p-4 border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={handleAnalyze} className="text-sm text-brand-400 hover:text-brand-300 mt-2">
            Try again
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in">
          <div className="glass-card p-6 flex flex-col items-center">
            <CircularRating rating={result.overall_rating} size={140} label="Overall Score" />
            <p className="text-sm text-gray-300 mt-4 text-center max-w-md leading-relaxed">{result.summary}</p>
          </div>

          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {categories.map((cat) => (
              <div key={cat.label} className="glass-card p-3 flex flex-col items-center">
                <CircularRating rating={cat.value} size={56} strokeWidth={4} />
                <span className="text-[10px] text-gray-400 font-medium mt-2 uppercase tracking-wider">{cat.label}</span>
              </div>
            ))}
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              Detailed Feedback
            </h3>
            <div className="space-y-4">
              {result.feedback.map((point, i) => (
                <p key={i} className="text-sm text-gray-300 leading-relaxed pl-4 border-l-2 border-brand-600/30">
                  {point}
                </p>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setFile(null); setPreview(null); setResult(null) }}
            className="btn-secondary w-full"
          >
            Analyze Another Photo
          </button>
        </div>
      )}
    </div>
  )
}
