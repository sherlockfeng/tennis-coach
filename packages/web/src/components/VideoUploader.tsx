import { useRef, useState } from 'react'

interface Props {
  videoFile: File | null
  onFileChange: (file: File) => void
  onDurationDetected: (duration: number) => void
}

export default function VideoUploader({ videoFile, onFileChange, onDurationDetected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('video/')) return
    onFileChange(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        上传视频
      </h2>

      {!videoFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center
            cursor-pointer hover:border-green-600 hover:bg-green-950/20 transition-colors"
        >
          <div className="text-4xl mb-2">🎬</div>
          <p className="text-sm text-gray-400">拖拽视频文件到此处</p>
          <p className="text-xs text-gray-600 mt-1">或点击选择 MP4 / MOV / AVI</p>
        </div>
      ) : (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={previewUrl ?? undefined}
            className="w-full rounded-lg bg-black"
            controls
            onLoadedMetadata={() => {
              if (videoRef.current) {
                onDurationDetected(Math.floor(videoRef.current.duration))
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 truncate">{videoFile.name}</span>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs text-green-400 hover:text-green-300 shrink-0 ml-2"
            >
              更换
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
    </div>
  )
}
