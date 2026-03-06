import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHistory, deleteFromHistory, clearHistory } from '../lib/storage'
import { NavLink } from 'react-router-dom'
import CircularRating from '../components/CircularRating'

export default function Gallery() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (user) setHistory(getHistory())
  }, [user])

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign in to view your gallery</h2>
        <p className="text-sm text-gray-400 mb-6">Your critique history is saved when you're logged in.</p>
        <NavLink to="/login" className="btn-primary">Sign In</NavLink>
      </div>
    )
  }

  const handleDelete = (id) => {
    setHistory(deleteFromHistory(id))
  }

  const handleClear = () => {
    clearHistory()
    setHistory([])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Gallery</h1>
          <p className="text-sm text-gray-400 mt-1">{user.email}</p>
        </div>
        {history.length > 0 && (
          <button onClick={handleClear} className="text-sm text-red-400 hover:text-red-300 transition-colors">
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          <p className="text-gray-400 mb-4">No critiques yet</p>
          <NavLink to="/critique" className="btn-primary text-sm">Start Your First Critique</NavLink>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="glass-card p-4">
              {entry.type === 'single' ? (
                <div className="flex items-center gap-4">
                  <CircularRating rating={entry.rating} size={48} strokeWidth={3} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 line-clamp-2">{entry.summary}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(entry.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleDelete(entry.id)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Comparison</span>
                    <button onClick={() => handleDelete(entry.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">A:</span>
                      <span className="font-semibold">{entry.ratingA}/10</span>
                    </div>
                    <span className="text-gray-600">vs</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">B:</span>
                      <span className="font-semibold">{entry.ratingB}/10</span>
                    </div>
                    <span className="ml-auto text-xs font-bold text-green-400">Winner: {entry.winner}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{entry.reason}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(entry.created_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
