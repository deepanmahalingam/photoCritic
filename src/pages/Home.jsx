import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col items-center text-center pt-8 sm:pt-16">
      {/* Hero */}
      <div className="w-20 h-20 rounded-2xl bg-brand-600/20 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
        </svg>
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
        Photo<span className="text-brand-400">Critic</span>
      </h1>
      <p className="mt-4 text-gray-400 max-w-md text-lg leading-relaxed">
        Get professional AI-powered feedback on your photography. Improve your skills, one shot at a time.
      </p>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 w-full max-w-lg">
        <NavLink to="/critique" className="glass-card p-6 text-left hover:bg-white/[0.06] transition-all group">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center mb-4 group-hover:bg-brand-600/30 transition-colors">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white">Single Critique</h3>
          <p className="text-sm text-gray-400 mt-1">Upload a photo and get detailed AI feedback with a 1-10 rating.</p>
        </NavLink>

        <NavLink to="/compare" className="glass-card p-6 text-left hover:bg-white/[0.06] transition-all group">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center mb-4 group-hover:bg-purple-600/30 transition-colors">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <h3 className="font-semibold text-white">Compare & Contrast</h3>
          <p className="text-sm text-gray-400 mt-1">Put two photos head-to-head and find the winner.</p>
        </NavLink>
      </div>

      {/* Features */}
      <div className="mt-16 w-full max-w-lg">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">How it works</h2>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Upload', desc: 'Choose a photo from your camera roll or drag-and-drop.' },
            { step: '2', title: 'Analyze', desc: 'AI evaluates composition, lighting, color, and technical quality.' },
            { step: '3', title: 'Improve', desc: 'Get actionable feedback and a score to track your progress.' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4 text-left">
              <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-brand-400">{item.step}</span>
              </div>
              <div>
                <h3 className="font-medium text-white">{item.title}</h3>
                <p className="text-sm text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!user && (
        <div className="mt-12">
          <NavLink to="/login" className="btn-primary inline-flex items-center gap-2">
            Get Started
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </NavLink>
        </div>
      )}
    </div>
  )
}
