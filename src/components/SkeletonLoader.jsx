export default function SkeletonLoader({ type = 'critique' }) {
  if (type === 'critique') {
    return (
      <div className="glass-card p-6 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-white/[0.06]" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-white/[0.06] rounded w-1/3" />
            <div className="h-3 bg-white/[0.06] rounded w-2/3" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.06] rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-white/[0.06] rounded" style={{ width: `${85 - i * 12}%` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-4 animate-pulse">
      <div className="aspect-[4/3] bg-white/[0.06] rounded-xl mb-3" />
      <div className="h-3 bg-white/[0.06] rounded w-2/3 mb-2" />
      <div className="h-3 bg-white/[0.06] rounded w-1/2" />
    </div>
  )
}
