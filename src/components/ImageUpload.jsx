import { useCallback, useRef, useState } from 'react'

export default function ImageUpload({ onSelect, label = 'Upload Photo', preview, className = '' }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (file) => {
      if (file && file.type.startsWith('image/')) {
        onSelect(file)
      }
    },
    [onSelect]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      handleFile(file)
    },
    [handleFile]
  )

  return (
    <div
      className={`relative group cursor-pointer ${className}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {preview ? (
        <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-sm font-medium text-white">Change Photo</span>
          </div>
        </div>
      ) : (
        <div
          className={`glass-card border-dashed aspect-[4/3] flex flex-col items-center justify-center gap-3 transition-all
            ${dragOver ? 'border-brand-500 bg-brand-500/10' : 'hover:border-white/20 hover:bg-white/[0.06]'}`}
        >
          <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300">{label}</p>
            <p className="text-xs text-gray-500 mt-1">Drag & drop or tap to browse</p>
          </div>
        </div>
      )}
    </div>
  )
}
