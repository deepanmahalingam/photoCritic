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
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Photo Critique</h1>
        <p className="text-sm text-gray-400 mt-1">Upload a photo to receive instant feedback on your shot.</p>
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

      {loading && <SkeletonLoader type="critique" />}

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
            <p className="text-sm text-gray-300 mt-4 text-center max-w-sm">{result.summary}</p>
          </div>

          <div className="grid grid-cols-4 gap-3">
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              Feedback
            </h3>
            <ul className="space-y-3">
              {result.feedback.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-300">
                  <span className="w-5 h-5 rounded-full bg-brand-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-brand-400">{i + 1}</span>
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => {
              setFile(null)
              setPreview(null)
              setResult(null)
            }}
            className="btn-secondary w-full"
          >
            Analyze Another Photo
          </button>
        </div>
      )}
    </div>
  )
}
