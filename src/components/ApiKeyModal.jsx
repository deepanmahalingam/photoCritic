import { useState } from 'react'
import { getSettings, saveSettings } from '../lib/storage'

export default function ApiKeyModal({ onClose, onSave }) {
  const settings = getSettings()
  const [provider, setProvider] = useState(settings.provider || 'openai')
  const [apiKey, setApiKey] = useState(settings.apiKey || '')

  const handleSave = () => {
    saveSettings({ provider, apiKey })
    onSave?.({ provider, apiKey })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold">AI Settings</h2>
          <p className="text-sm text-gray-400 mt-1">Configure your Vision AI provider to analyze photos.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
            <div className="flex gap-2">
              {['openai', 'gemini'].map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    provider === p
                      ? 'bg-brand-600 text-white'
                      : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
                  }`}
                >
                  {p === 'openai' ? 'OpenAI GPT-4o' : 'Gemini 1.5 Pro'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
            <input
              type="password"
              className="input-field"
              placeholder={provider === 'openai' ? 'sk-...' : 'AI...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-2">
              Your key is stored locally in your browser and never sent to our servers.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!apiKey.trim()} className="btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
