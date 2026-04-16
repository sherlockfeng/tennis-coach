import { AnalysisResult } from '../App'

interface Props {
  result: AnalysisResult | null
  loading: boolean
}

export default function AnalysisPanel({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
        <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">正在提取帧并分析动作…</p>
        <p className="text-xs text-gray-600">AI 教练正在逐帧查看你的动作</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
        <span className="text-6xl">🎾</span>
        <p className="text-sm">上传视频并配置参数后，点击「开始分析」</p>
        <p className="text-xs">AI 教练将逐帧分析你的击球动作</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Meta */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <span className="bg-green-900/50 text-green-300 px-2 py-0.5 rounded text-xs font-medium">
          {result.provider.toUpperCase()}
        </span>
        <span>分析了 {result.frameCount} 帧</span>
      </div>

      {/* Frame thumbnails */}
      {result.frames.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            提取的帧
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.frames.map((frame, i) => (
              <img
                key={i}
                src={`data:image/jpeg;base64,${frame}`}
                alt={`frame-${i}`}
                className="h-20 w-auto rounded-lg border border-gray-800 object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {/* Analysis */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          教练分析报告
        </h3>
        <div className="prose prose-invert prose-sm max-w-none bg-gray-900 rounded-xl p-5 leading-relaxed whitespace-pre-wrap text-gray-200 text-sm">
          {result.analysis}
        </div>
      </div>
    </div>
  )
}
