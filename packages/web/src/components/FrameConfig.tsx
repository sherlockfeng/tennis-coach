import { FrameSettings } from '../App'

interface Props {
  settings: FrameSettings
  onChange: (s: FrameSettings) => void
  frameCount: number
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="text-white font-medium">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-green-500"
      />
    </div>
  )
}

export default function FrameConfig({ settings, onChange, frameCount }: Props) {
  const { startSec, endSec, fps, videoDuration } = settings

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        帧提取设置
      </h2>

      <div className="bg-gray-900 rounded-xl p-4 space-y-4">
        <Slider
          label="开始时间"
          value={startSec}
          min={0}
          max={Math.max(0, endSec - 1)}
          step={1}
          unit="秒"
          onChange={(v) => onChange({ ...settings, startSec: v })}
        />

        <Slider
          label="结束时间"
          value={endSec}
          min={startSec + 1}
          max={videoDuration}
          step={1}
          unit="秒"
          onChange={(v) => onChange({ ...settings, endSec: v })}
        />

        <Slider
          label="每秒提取帧数"
          value={fps}
          min={0.5}
          max={5}
          step={0.5}
          unit="fps"
          onChange={(v) => onChange({ ...settings, fps: v })}
        />

        <div className="border-t border-gray-800 pt-3 flex justify-between text-xs">
          <span className="text-gray-500">
            时间段：{endSec - startSec} 秒
          </span>
          <span className="text-green-400 font-semibold">
            共提取 {frameCount} 帧
          </span>
        </div>
      </div>

      {frameCount > 20 && (
        <p className="text-xs text-yellow-500">
          ⚠️ 帧数较多，分析耗时会增加，建议控制在 20 帧以内
        </p>
      )}
    </div>
  )
}
