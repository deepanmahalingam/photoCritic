import { useState } from 'react'
import ImageUpload from '../components/ImageUpload'
import CircularRating from '../components/CircularRating'
import SkeletonLoader from '../components/SkeletonLoader'
import { critiquePhoto, generateSmartCaptions, getGeminiKey, saveGeminiKey } from '../lib/ai'
import { addToHistory } from '../lib/storage'
import { useAuth } from '../context/AuthContext'

export default function Critique() {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Caption state
  const [captions, setCaptions] = useState([])
  const [isSmartCaptions, setIsSmartCaptions] = useState(false)
  const [captionsLoading, setCaptionsLoading] = useState(false)
  const [copied, setCopied] = useState(-1)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyInput, setKeyInput] = useState('')

  // Share state
  const [shareToast, setShareToast] = useState('')

  const handleSelect = (f) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setCaptions([])
    setIsSmartCaptions(false)
    setError('')
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')
    setCaptions([])
    setIsSmartCaptions(false)

    try {
      const critique = await critiquePhoto(file)
      setResult(critique)
      setCaptions(critique.captions || [])

      if (user) {
        addToHistory({
          type: 'single',
          rating: critique.overall_rating,
          summary: critique.summary,
          thumbnail: preview,
        })
      }

      // If Gemini key exists, silently upgrade captions
      const key = getGeminiKey()
      if (key) {
        upgradeToSmart(file, key)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const upgradeToSmart = async (photoFile, key) => {
    setCaptionsLoading(true)
    try {
      const smart = await generateSmartCaptions(photoFile, key)
      if (smart.length > 0) {
        setCaptions(smart)
        setIsSmartCaptions(true)
      }
    } catch {
      // Silently fail — offline captions remain
    } finally {
      setCaptionsLoading(false)
    }
  }

  const handleSaveKey = () => {
    if (!keyInput.trim()) return
    saveGeminiKey(keyInput)
    setKeyInput('')
    setShowKeyInput(false)
    if (result && file) {
      upgradeToSmart(file, keyInput.trim())
    }
  }

  const handleCopy = (text, idx) => {
    navigator.clipboard?.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(-1), 1500)
  }

  const handleShareInstagram = async () => {
    if (!file || captions.length === 0) return
    const caption = captions[0]

    // Try Web Share API (works on mobile — opens native share sheet)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption })
        setShareToast('Shared successfully!')
        setTimeout(() => setShareToast(''), 3000)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setShareToast('Share cancelled')
          setTimeout(() => setShareToast(''), 2000)
        }
      }
      return
    }

    // Desktop fallback — download image + copy caption
    try {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name || 'photo.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      await navigator.clipboard?.writeText(caption)
      setShareToast('Image downloaded & caption copied — open Instagram to post!')
      setTimeout(() => setShareToast(''), 4000)
    } catch {
      setShareToast('Could not share — try saving the image manually')
      setTimeout(() => setShareToast(''), 3000)
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

          {/* Caption Suggestions */}
          {captions.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                Caption Suggestions
                {captionsLoading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-brand-400 ml-1" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isSmartCaptions && !captionsLoading && (
                  <span className="text-[10px] text-brand-400/70 font-normal ml-auto">&#x2728; Smart</span>
                )}
              </h3>
              <div className="space-y-3">
                {captions.map((caption, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-white/[0.04] transition-colors"
                    onClick={() => handleCopy(caption, i)}
                    title="Click to copy"
                  >
                    <span className="text-brand-400 text-sm font-mono mt-0.5 shrink-0">{i + 1}.</span>
                    <p className="text-sm text-gray-300 leading-relaxed italic flex-1">
                      &ldquo;{caption}&rdquo;
                    </p>
                    {copied === i ? (
                      <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-gray-600">Tap any caption to copy it</p>
                  {!isSmartCaptions && !getGeminiKey() && !showKeyInput && (
                    <button
                      onClick={() => setShowKeyInput(true)}
                      className="text-xs text-brand-400/70 hover:text-brand-400 transition-colors"
                    >
                      &#x2728; Get precise captions
                    </button>
                  )}
                </div>
              </div>

              {/* Inline key setup — step-by-step guide */}
              {showKeyInput && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
                  <div className="bg-brand-500/[0.08] border border-brand-500/20 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-brand-400 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                      Get AI-Powered Captions — Free &amp; One-Time Setup
                    </p>
                    <ol className="space-y-2 text-xs text-gray-400">
                      <li className="flex gap-2">
                        <span className="text-brand-400 font-bold shrink-0">1.</span>
                        <span>
                          Go to{' '}
                          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 underline font-medium">
                            Google AI Studio
                          </a>
                          {' '}and sign in with your Google account
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand-400 font-bold shrink-0">2.</span>
                        <span>Click <span className="text-white font-medium">"Create API Key"</span> — it's completely free, no credit card needed</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand-400 font-bold shrink-0">3.</span>
                        <span>Copy the key and paste it below — we'll save it locally in your browser. You only need to do this once!</span>
                      </li>
                    </ol>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                      placeholder="Paste your API key here"
                      className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                    <button onClick={handleSaveKey} className="btn-primary px-4 py-2 text-xs">
                      Save
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 text-center">Your key stays on your device — never sent to any server except Google's API</p>
                </div>
              )}
            </div>
          )}

          {/* Share to Instagram */}
          {captions.length > 0 && (
            <button
              onClick={handleShareInstagram}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all duration-200 ease-out hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #833AB4, #C13584, #E1306C, #F77737, #FCAF45)' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              Share to Instagram
            </button>
          )}

          {/* Share toast notification */}
          {shareToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2 max-w-[90vw]">
              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {shareToast}
            </div>
          )}

          <button
            onClick={() => { setFile(null); setPreview(null); setResult(null); setCaptions([]); setIsSmartCaptions(false); setShowKeyInput(false); setShareToast('') }}
            className="btn-secondary w-full"
          >
            Analyze Another Photo
          </button>
        </div>
      )}
    </div>
  )
}
