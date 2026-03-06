import { useEffect, useState } from 'react'

const ratingColor = (r) => {
  if (r >= 8) return '#22c55e'
  if (r >= 6) return '#eab308'
  if (r >= 4) return '#f97316'
  return '#ef4444'
}

export default function CircularRating({ rating, size = 120, strokeWidth = 8, label }) {
  const [progress, setProgress] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const color = ratingColor(rating)

  useEffect(() => {
    const timer = setTimeout(() => setProgress(rating / 10), 100)
    return () => clearTimeout(timer)
  }, [rating])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="circle-progress">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {rating}
          </span>
        </div>
      </div>
      {label && <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>}
    </div>
  )
}
