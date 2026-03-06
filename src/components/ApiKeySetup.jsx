import { useState } from 'react'
import { getApiKey, saveApiKey } from '../lib/ai'

export default function ApiKeySetup({ onReady }) {
  const [key, setKey] = useState(getApiKey())
  const [editing, setEditing] = useState(!getApiKey())

  const handleSave = () => {
    if (!key.trim()) return
    saveApiKey(key.trim())
    setEditing(false)
    onReady?.()
  }

  // Key is already saved — show compact status
  if (!editing && getApiKey()) {
    return (
      <div className="flex items-center justify-between glass-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-400">Gemini AI connected</span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Change key
        </button>
      </div>
    )
  }

  // First time or editing — show setup
  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
          <h3 className="font-semibold text-sm">Connect Gemini AI</h3>
        </div>
        <p className="text-xs text-gray-500">
          Paste your free Google Gemini API key for content-aware photo feedback.
          {' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 underline"
          >
            Get a free key here
          </a>
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          className="input-field flex-1 !py-2.5 text-sm"
          placeholder="AIza..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button onClick={handleSave} disabled={!key.trim()} className="btn-primary !py-2.5 !px-5 text-sm">
          Save
        </button>
      </div>

      <p className="text-[10px] text-gray-600">
        Stored locally in your browser. Never sent anywhere except directly to Google's API.
      </p>
    </div>
  )
}
