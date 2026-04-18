import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import HistorySidebar, { type LoadedSession } from './components/HistorySidebar.js'
import { TRANSLATIONS, detectLang, type Lang } from './i18n.js'

// In production VITE_API_BASE points to the Render backend URL.
// In development it's empty, so requests go through the Vite proxy.
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE ?? '' })

// ─── Types ───────────────────────────────────────────────────────────

interface UserSettings {
  provider: 'claude' | 'openai'
  apiKey: string
}

interface AuthUser {
  id: number
  email: string
  apiKey: string
  apiProvider: 'claude' | 'openai'
  coachStyle: string
}

const COACH_PRESETS = [
  { id: 'balanced', instruction: '' },
  { id: 'strict',   instruction: '请以严厉风格执教：直接指出所有问题，不要过多鼓励，像对待职业球员一样严格要求，要求学员做到更好。' },
  { id: 'question', instruction: '请以启发式风格执教：多用问题引导学员自己思考（如"你觉得这里的击球点应该在哪里？"），少直接给答案，帮助学员建立自主分析能力。' },
  { id: 'detail',   instruction: '请以细节深度风格执教：深入分析每个技术细节，每个动作阶段都要详细拆解，不放过任何可以改进的点，提供更多技术深度。' },
  { id: 'custom',   instruction: '' },
] as const

type CoachPresetId = typeof COACH_PRESETS[number]['id']

const SETTINGS_KEY = 'tc_user_settings'
const AUTH_KEY = 'tc_auth'

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw) as UserSettings
  } catch {}
  return { provider: 'claude', apiKey: '' }
}

function saveSettings(s: UserSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

function loadAuth(): { token: string; user: AuthUser } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }))
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
}

// ─── LoginModal ──────────────────────────────────────────────────────

function LoginModal({
  onClose,
  onSuccess,
  lang,
}: {
  onClose: () => void
  onSuccess: (token: string, user: AuthUser) => void
  lang: Lang
}) {
  const t = TRANSLATIONS[lang]
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await api.post<{ token: string; user: AuthUser }>(endpoint, { email, password })
      onSuccess(res.data.token, res.data.user)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.error ?? err.message) : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            {mode === 'login' ? t.loginTitle : t.registerTitle}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">×</button>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          {mode === 'login' ? t.loginDesc : t.registerDesc}
        </p>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100
              placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t.passwordPlaceholder}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100
              placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || !email || !password}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-500
            disabled:bg-gray-700 disabled:text-gray-500 transition-colors">
          {loading ? t.submitting : mode === 'login' ? t.loginBtn : t.registerBtn}
        </button>

        <button
          onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
          className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {mode === 'login' ? t.switchToRegister : t.switchToLogin}
        </button>
      </div>
    </div>
  )
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  frames?: string[]
  isAnalysis?: boolean
}

export interface FrameSettings {
  startSec: number
  endSec: number
  fps: number
  videoDuration: number
}

export interface AnalysisResult {
  provider: string
  frameCount: number
  frames: string[]
  analysis: string
}

interface ProPlayer {
  id: string
  name: string
  style: string
}

type PanelMode = 'analyze' | 'compare' | 'pro'

// ─── Sub-components ──────────────────────────────────────────────────

function MessageBubble({ msg, lang }: { msg: ChatMessage; lang: Lang }) {
  const t = TRANSLATIONS[lang]
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0
        ${isUser ? 'bg-green-700' : 'bg-gray-700'}`}>
        {isUser ? '👤' : '🎾'}
      </div>
      <div className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {msg.images && msg.images.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.images.map((img, i) => (
              <img key={i} src={`data:image/jpeg;base64,${img}`}
                className="h-24 w-auto rounded-lg object-cover border border-gray-700" />
            ))}
          </div>
        )}
        {msg.frames && msg.frames.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">{t.framesExtracted(msg.frames.length)}</p>
            <div className="flex flex-wrap gap-1">
              {msg.frames.map((f, i) => {
                const src = f.startsWith('http') ? f : `data:image/jpeg;base64,${f}`
                return <img key={i} src={src}
                  className="h-16 w-auto rounded border border-gray-700 object-cover" />
              })}
            </div>
          </div>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isUser ? 'bg-green-700 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
          {isUser ? msg.content : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
                h2: ({ children }) => <p className="font-bold mb-1">{children}</p>,
                h3: ({ children }) => <p className="font-semibold mb-0.5">{children}</p>,
                p:  ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                hr: () => <hr className="border-gray-600 my-2" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-green-500 pl-3 text-gray-300 my-1">{children}</blockquote>
                ),
                code: ({ children }) => (
                  <code className="bg-gray-700 rounded px-1 text-xs font-mono">{children}</code>
                ),
              }}>
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}

function FrameSlider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number
  step: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="text-white font-medium">{value} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-green-500" />
    </div>
  )
}

function VideoSlot({
  label, file, preview, onSelect, onClear, onDrop, settings, onSettingsChange, videoRef, lang,
}: {
  label: string
  file: File | null
  preview: string | null
  onSelect: () => void
  onClear: () => void
  onDrop: (file: File) => void
  settings: FrameSettings
  onSettingsChange: (s: FrameSettings) => void
  videoRef: React.RefObject<HTMLVideoElement>
  lang: Lang
}) {
  const t = TRANSLATIONS[lang]
  const [dragging, setDragging] = useState(false)
  const frameCount = Math.max(1, Math.floor((settings.endSec - settings.startSec) * settings.fps))

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) onDrop(f)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400">{label}</p>
      {!file ? (
        <div
          onClick={onSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
            ${dragging
              ? 'border-green-400 bg-green-950/40'
              : 'border-gray-700 hover:border-green-500 hover:bg-green-950/20'}`}>
          <div className="text-xl mb-1">{dragging ? '🎬' : '📁'}</div>
          <p className="text-xs text-gray-400">{dragging ? t.dropHint : t.clickOrDrop}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-base">🎞️</span>
            <span className="text-xs text-gray-200 flex-1 truncate">{file.name}</span>
            <button onClick={onClear} className="text-xs text-gray-500 hover:text-red-400">✕</button>
          </div>
          {preview && (
            <video ref={videoRef} src={preview} className="hidden"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  const d = Math.floor(videoRef.current.duration)
                  onSettingsChange({ ...settings, startSec: 0, endSec: d, videoDuration: d })
                }
              }} />
          )}
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <FrameSlider label={t.startSec} value={settings.startSec} min={0}
              max={Math.max(0, settings.videoDuration - 1)} step={1} unit={t.secUnit}
              onChange={(v) => onSettingsChange({
                ...settings, startSec: v,
                endSec: v >= settings.endSec ? Math.min(v + 1, settings.videoDuration) : settings.endSec,
              })} />
            <FrameSlider label={t.endSec} value={settings.endSec}
              min={settings.startSec + 1} max={settings.videoDuration} step={1} unit={t.secUnit}
              onChange={(v) => onSettingsChange({ ...settings, endSec: v })} />
            <FrameSlider label={t.fpsSetting} value={settings.fps} min={0.5} max={5} step={0.5} unit={t.fpsUnit}
              onChange={(v) => onSettingsChange({ ...settings, fps: v })} />
            <div className="text-right text-xs">
              <span className={frameCount > 20 ? 'text-yellow-400' : 'text-green-400'}>
                {t.framesExtracted(frameCount)}{frameCount > 20 ? ' ⚠️' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: FrameSettings = { startSec: 0, endSec: 10, fps: 2, videoDuration: 10 }

export default function App() {
  // ── Language ─────────────────────────────────────────────────────
  const [lang, setLang] = useState<Lang>(() => detectLang())
  const t = TRANSLATIONS[lang]

  const changeLang = (l: Lang) => {
    localStorage.setItem('tc_lang', l)
    setLang(l)
  }

  // ── Auth ────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState<string | null>(() => loadAuth()?.token ?? null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadAuth()?.user ?? null)
  const [showLogin, setShowLogin] = useState(false)

  const handleAuthSuccess = (token: string, user: AuthUser) => {
    saveAuth(token, user)
    setAuthToken(token)
    setAuthUser(user)
    setShowLogin(false)
    if (user.apiKey) {
      const s: UserSettings = { provider: user.apiProvider, apiKey: user.apiKey }
      saveSettings(s)
      setSettings(s)
      setDraftSettings(s)
    }
    if (user.coachStyle) setCoachStyle(user.coachStyle)
  }

  const handleLogout = () => {
    clearAuth()
    setAuthToken(null)
    setAuthUser(null)
  }

  // ── User settings (BYOK) ────────────────────────────────────────
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [draftSettings, setDraftSettings] = useState<UserSettings>(loadSettings)
  const [showKey, setShowKey] = useState(false)
  const [syncingToken, setSyncingToken] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [coachStyle, setCoachStyle] = useState(() => loadAuth()?.user.coachStyle ?? '')
  const [draftCoachPreset, setDraftCoachPreset] = useState<CoachPresetId>('balanced')
  const [draftCoachCustom, setDraftCoachCustom] = useState('')
  const [savingStyle, setSavingStyle] = useState(false)

  const syncTokenToAccount = async () => {
    if (!authToken) return
    setSyncingToken(true)
    setSyncMsg('')
    try {
      await api.put('/api/auth/api-token',
        { apiKey: draftSettings.apiKey, apiProvider: draftSettings.provider },
        { headers: { Authorization: `Bearer ${authToken}` } }
      )
      const updatedUser = { ...authUser!, apiKey: draftSettings.apiKey, apiProvider: draftSettings.provider }
      saveAuth(authToken, updatedUser)
      setAuthUser(updatedUser)
      setSyncMsg('已同步到账号')
    } catch {
      setSyncMsg('同步失败，请重试')
    } finally {
      setSyncingToken(false)
    }
  }

  // ── Session / History ──────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const saveCoachStyle = async () => {
    const instruction = draftCoachPreset === 'custom'
      ? draftCoachCustom.trim()
      : COACH_PRESETS.find(p => p.id === draftCoachPreset)?.instruction ?? ''
    setSavingStyle(true)
    try {
      await api.put('/api/auth/coach-style', { coachStyle: instruction },
        { headers: { Authorization: `Bearer ${authToken}` } })
      setCoachStyle(instruction)
      const updatedUser = { ...authUser!, coachStyle: instruction }
      saveAuth(authToken!, updatedUser)
      setAuthUser(updatedUser)
    } catch {}
    setSavingStyle(false)
  }

  // Build axios headers for every API call
  const apiHeaders = {
    ...(settings.apiKey ? { 'X-API-Key': settings.apiKey, 'X-AI-Provider': settings.provider } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(currentSessionId ? { 'X-Session-Id': String(currentSessionId) } : {}),
    ...(coachStyle ? { 'X-Coach-Style': encodeURIComponent(coachStyle) } : {}),
    'X-Language': lang,
  }

  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: t.welcomeMsg,
  }])
  const [apiHistory, setApiHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)

  // Panel
  const [showVideoPanel, setShowVideoPanel] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>('analyze')

  // Video A (single analysis / compare A / pro compare)
  const [videoA, setVideoA] = useState<File | null>(null)
  const [previewA, setPreviewA] = useState<string | null>(null)
  const [settingsA, setSettingsA] = useState<FrameSettings>(DEFAULT_SETTINGS)

  // Video B (compare only)
  const [videoB, setVideoB] = useState<File | null>(null)
  const [previewB, setPreviewB] = useState<string | null>(null)
  const [settingsB, setSettingsB] = useState<FrameSettings>(DEFAULT_SETTINGS)

  // Pro player
  const [proPlayers, setProPlayers] = useState<ProPlayer[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [recommendMode, setRecommendMode] = useState(false)

  // Images
  const [pendingImages, setPendingImages] = useState<{ file: File; b64: string }[]>([])

  const fileARef = useRef<HTMLInputElement>(null)
  const fileBRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Fetch pro players list on mount
  useEffect(() => {
    api.get<{ players: ProPlayer[] }>("/api/compare/players")
      .then(r => setProPlayers(r.data.players))
      .catch(() => {})
  }, [])

  const frameCountA = Math.max(1, Math.floor((settingsA.endSec - settingsA.startSec) * settingsA.fps))

  const addMessage = (msg: ChatMessage) => setMessages(prev => [...prev, msg])

  // ── Text / image chat ────────────────────────────────────────────
  const sendTextMessage = async () => {
    const text = inputText.trim()
    if (!text && pendingImages.length === 0) return
    setLoading(true)

    const snapshot = [...pendingImages]
    const userMsg: ChatMessage = {
      role: 'user',
      content: text || (snapshot.length > 1
        ? t.imageAnalysisPromptMulti(snapshot.length)
        : t.imageAnalysisPromptSingle),
      images: snapshot.map(p => p.b64),
    }
    addMessage(userMsg)
    setInputText('')
    setPendingImages([])

    try {
      let reply = ''
      let newHistory = [...apiHistory]

      if (snapshot.length > 0) {
        const fd = new FormData()
        snapshot.forEach(p => fd.append('images', p.file))
        fd.append('text', userMsg.content)
        fd.append('history', JSON.stringify(apiHistory))
        const res = await api.post('/api/chat/image', fd, {
          headers: { 'Content-Type': 'multipart/form-data', ...apiHeaders },
        })
        reply = res.data.reply
        newHistory = res.data.updatedHistory
        if (res.data.sessionId) setCurrentSessionId(res.data.sessionId)
      } else {
        const hist = [...apiHistory, { role: 'user' as const, content: text }]
        const res = await api.post('/api/chat', { messages: hist }, { headers: apiHeaders })
        reply = res.data.reply
        newHistory = [...hist, { role: 'assistant' as const, content: reply }]
        if (res.data.sessionId) setCurrentSessionId(res.data.sessionId)
      }

      setApiHistory(newHistory)
      addMessage({ role: 'assistant', content: reply })
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.error ?? err.message) : String(err)
      addMessage({ role: 'assistant', content: t.errorPrefix + msg })
    } finally {
      setLoading(false)
    }
  }

  // ── Single video analysis ────────────────────────────────────────
  const sendVideoAnalysis = async () => {
    if (!videoA) return
    setLoading(true)
    setShowVideoPanel(false)

    addMessage({ role: 'user', content: t.videoAnalysisMsg(settingsA.startSec, settingsA.endSec, settingsA.fps, frameCountA) })

    try {
      const fd = new FormData()
      fd.append('video', videoA)
      fd.append('startSec', String(settingsA.startSec))
      fd.append('endSec', String(settingsA.endSec))
      fd.append('fps', String(settingsA.fps))
      fd.append('history', JSON.stringify(apiHistory))

      const res = await api.post('/api/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data', ...apiHeaders }, timeout: 120_000,
      })

      addMessage({ role: 'assistant', content: res.data.analysis, frames: res.data.frames, isAnalysis: true })
      setApiHistory(res.data.updatedHistory)
      if (res.data.sessionId) setCurrentSessionId(res.data.sessionId)
      setVideoA(null); setPreviewA(null)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.error ?? err.message) : String(err)
      addMessage({ role: 'assistant', content: t.analysisFailed + msg })
    } finally {
      setLoading(false)
    }
  }

  // ── Video comparison ─────────────────────────────────────────────
  const sendComparison = async () => {
    if (!videoA) return
    setLoading(true)
    setShowVideoPanel(false)

    const modeLabel = panelMode === 'compare'
      ? t.panelCompare
      : recommendMode
        ? t.recommendStyle
        : t.submitVsPlayer(selectedPlayer)

    addMessage({ role: 'user', content: modeLabel })

    try {
      const fd = new FormData()
      fd.append('videoA', videoA)
      fd.append('startSecA', String(settingsA.startSec))
      fd.append('endSecA', String(settingsA.endSec))
      fd.append('fpsA', String(settingsA.fps))

      if (panelMode === 'compare' && videoB) {
        fd.append('videoB', videoB)
        fd.append('startSecB', String(settingsB.startSec))
        fd.append('endSecB', String(settingsB.endSec))
        fd.append('fpsB', String(settingsB.fps))
      } else if (panelMode === 'pro') {
        if (recommendMode) {
          fd.append('recommendStyle', 'true')
        } else {
          fd.append('playerName', selectedPlayer)
        }
      }

      fd.append('history', JSON.stringify(apiHistory))

      const res = await api.post('/api/compare', fd, {
        headers: { 'Content-Type': 'multipart/form-data', ...apiHeaders }, timeout: 180_000,
      })

      addMessage({ role: 'assistant', content: res.data.analysis, frames: res.data.framesA, isAnalysis: true })
      setApiHistory(res.data.updatedHistory)
      if (res.data.sessionId) setCurrentSessionId(res.data.sessionId)
      setVideoA(null); setPreviewA(null); setVideoB(null); setPreviewB(null)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.error ?? err.message) : String(err)
      addMessage({ role: 'assistant', content: t.compareFailed + msg })
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const b64 = (e.target?.result as string).split(',')[1]
      setPendingImages(prev => [...prev, { file, b64 }])
    }
    reader.readAsDataURL(file)
  }

  const canSubmitPanel = panelMode === 'analyze'
    ? !!videoA
    : panelMode === 'compare'
      ? !!videoA && !!videoB
      : !!videoA

  const submitPanel = panelMode === 'analyze' ? sendVideoAnalysis : sendComparison

  const submitLabel = () => {
    if (!canSubmitPanel) return panelMode === 'compare' ? t.needBothVideos : t.noVideoYet
    if (loading) return t.analyzing
    if (panelMode === 'analyze') return t.submitAnalyze(frameCountA)
    if (panelMode === 'compare') return t.submitCompare
    return recommendMode ? t.submitRecommend : t.submitVsPlayer(selectedPlayer)
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      {/* Auth modal */}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={handleAuthSuccess} lang={lang} />
      )}

      {/* History sidebar */}
      {showHistory && authToken && (
        <HistorySidebar
          api={api}
          authToken={authToken}
          currentSessionId={currentSessionId}
          onClose={() => setShowHistory(false)}
          lang={lang}
          onLoad={(loaded: LoadedSession) => {
            setCurrentSessionId(loaded.sessionId)
            setShowHistory(false)
            const chatMsgs: ChatMessage[] = loaded.messages.map(m => ({
              role: m.role,
              content: m.content,
              frames: m.frame_urls.length > 0 ? m.frame_urls : undefined,
            }))
            setMessages(chatMsgs)
            setApiHistory(loaded.messages.map(m => ({ role: m.role, content: m.content })))
          }}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center gap-3 shrink-0">
        <span className="text-xl">🎾</span>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white">{t.appTitle}</h1>
          <p className="text-xs text-gray-500">{t.appSubtitle}</p>
        </div>
        <button
          onClick={() => {
            setMessages([{ role: 'assistant', content: t.newChatStarted }])
            setApiHistory([])
            setCurrentSessionId(null)
          }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {t.newChat}
        </button>

        {/* History button — only when logged in */}
        {authUser && (
          <button
            onClick={() => setShowHistory(v => !v)}
            title={t.historyTitle}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors
              ${showHistory ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>
            🕐
          </button>
        )}

        {/* Auth button */}
        {authUser ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 max-w-[100px] truncate" title={authUser.email}>
              {authUser.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors">
              {t.logout}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            className="text-xs text-gray-400 hover:text-green-400 transition-colors px-2 py-1
              rounded-lg bg-gray-800 hover:bg-gray-700">
            {t.login}
          </button>
        )}

        <button
          onClick={() => {
            setDraftSettings({ ...settings }); setSyncMsg('')
            const matched = COACH_PRESETS.find(p => p.instruction === coachStyle && p.id !== 'custom')
            setDraftCoachPreset(matched ? matched.id : coachStyle ? 'custom' : 'balanced')
            setDraftCoachCustom(coachStyle)
            setShowSettings(true)
          }}
          title={t.settingsTitle}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors
            ${settings.apiKey ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>
          ⚙️
        </button>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{t.settingsTitle}</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-300 text-lg">×</button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">{t.keyLocalNote}</p>

            {/* Language */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">{t.languageSection}</p>
              <div className="flex gap-2">
                {(['zh', 'en'] as const).map(l => (
                  <button key={l} onClick={() => changeLang(l)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                      ${lang === l
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                    {l === 'zh' ? '🇨🇳 中文' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">{t.aiProvider}</p>
              <div className="flex gap-2">
                {(['claude', 'openai'] as const).map(p => (
                  <button key={p} onClick={() => setDraftSettings(d => ({ ...d, provider: p }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                      ${draftSettings.provider === p
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                    {p === 'claude' ? '🤖 Claude' : '🧠 OpenAI'}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key input */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">
                {t.apiKeyLabel(draftSettings.provider)}
              </p>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={draftSettings.apiKey}
                  onChange={e => setDraftSettings(d => ({ ...d, apiKey: e.target.value }))}
                  placeholder={draftSettings.provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100
                    placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-600 font-mono"
                />
                <button onClick={() => setShowKey(v => !v)}
                  className="px-3 rounded-lg bg-gray-800 text-gray-400 hover:text-gray-200 text-sm">
                  {showKey ? t.hideKey : t.showKey}
                </button>
              </div>
              {draftSettings.apiKey && (
                <p className="text-xs text-green-500">{t.keyFilled}</p>
              )}
              {!draftSettings.apiKey && (
                <p className="text-xs text-yellow-600">{t.keyEmpty}</p>
              )}
            </div>

            {/* Coach style (shown only when logged in) */}
            {authUser && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium">{t.coachStyleSection}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {COACH_PRESETS.map(p => {
                    const labelKey = `preset${p.id.charAt(0).toUpperCase() + p.id.slice(1)}` as keyof typeof t
                    return (
                      <button key={p.id}
                        onClick={() => setDraftCoachPreset(p.id)}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-colors
                          ${draftCoachPreset === p.id
                            ? 'bg-green-700 text-white'
                            : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                        {t[labelKey] as string}
                      </button>
                    )
                  })}
                </div>
                {draftCoachPreset === 'custom' && (
                  <textarea
                    value={draftCoachCustom}
                    onChange={e => setDraftCoachCustom(e.target.value)}
                    placeholder={t.coachStylePlaceholder}
                    rows={3}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-100
                      placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-green-600"
                  />
                )}
                <button
                  onClick={saveCoachStyle}
                  disabled={savingStyle}
                  className="w-full py-2 rounded-xl text-xs font-medium bg-gray-800
                    text-gray-300 hover:text-green-400 hover:bg-gray-700 disabled:opacity-50 transition-colors">
                  {savingStyle ? t.saving : t.saveStyle}
                </button>
              </div>
            )}

            {/* Sync to account (shown only when logged in) */}
            {authUser && (
              <div className="space-y-1.5">
                <button
                  onClick={syncTokenToAccount}
                  disabled={syncingToken}
                  className="w-full py-2 rounded-xl text-xs font-medium bg-gray-800
                    text-gray-300 hover:text-green-400 hover:bg-gray-700 disabled:opacity-50 transition-colors">
                  {syncingToken ? t.syncing : t.syncKey}
                </button>
                {syncMsg && (
                  <p className={`text-xs text-center ${syncMsg.includes('失败') || syncMsg.toLowerCase().includes('fail') ? 'text-red-400' : 'text-green-400'}`}>
                    {syncMsg}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDraftSettings(d => ({ ...d, apiKey: '' }))}
                className="flex-1 py-2 rounded-xl text-xs text-gray-500 hover:text-red-400 bg-gray-800 transition-colors">
                {t.clearKey}
              </button>
              <button
                onClick={() => {
                  saveSettings(draftSettings)
                  setSettings(draftSettings)
                  setShowSettings(false)
                }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors">
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} lang={lang} />)}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">🎾</div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-green-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending images */}
      {pendingImages.length > 0 && (
        <div className="px-4 py-2 flex gap-2 border-t border-gray-800">
          {pendingImages.map((p, i) => (
            <div key={i} className="relative">
              <img src={`data:image/jpeg;base64,${p.b64}`} className="h-16 w-auto rounded border border-gray-700" />
              <button onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-xs text-white flex items-center justify-center">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Video Panel */}
      {showVideoPanel && (
        <div className="border-t border-gray-800 bg-gray-900 p-4 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Panel header + mode tabs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {([
                { id: 'analyze', label: t.panelAnalyze },
                { id: 'compare', label: t.panelCompare },
                { id: 'pro',     label: t.panelPro },
              ] as { id: PanelMode; label: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPanelMode(tab.id)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors
                    ${panelMode === tab.id
                      ? 'bg-green-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowVideoPanel(false)}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none ml-2">×</button>
          </div>

          {/* ── Mode: single analysis ── */}
          {panelMode === 'analyze' && (
            <VideoSlot
              label={t.videoSlotSingle}
              file={videoA} preview={previewA}
              onSelect={() => fileARef.current?.click()}
              onClear={() => { setVideoA(null); setPreviewA(null) }}
              onDrop={f => { setVideoA(f); setPreviewA(URL.createObjectURL(f)) }}
              settings={settingsA} onSettingsChange={setSettingsA}
              videoRef={videoRefA} lang={lang}
            />
          )}

          {/* ── Mode: two-video compare ── */}
          {panelMode === 'compare' && (
            <div className="grid grid-cols-2 gap-4">
              <VideoSlot
                label={t.videoSlotA}
                file={videoA} preview={previewA}
                onSelect={() => fileARef.current?.click()}
                onClear={() => { setVideoA(null); setPreviewA(null) }}
                onDrop={f => { setVideoA(f); setPreviewA(URL.createObjectURL(f)) }}
                settings={settingsA} onSettingsChange={setSettingsA}
                videoRef={videoRefA} lang={lang}
              />
              <VideoSlot
                label={t.videoSlotB}
                file={videoB} preview={previewB}
                onSelect={() => fileBRef.current?.click()}
                onClear={() => { setVideoB(null); setPreviewB(null) }}
                onDrop={f => { setVideoB(f); setPreviewB(URL.createObjectURL(f)) }}
                settings={settingsB} onSettingsChange={setSettingsB}
                videoRef={videoRefB} lang={lang}
              />
            </div>
          )}

          {/* ── Mode: pro player compare ── */}
          {panelMode === 'pro' && (
            <div className="space-y-4">
              <VideoSlot
                label={t.videoSlotPro}
                file={videoA} preview={previewA}
                onSelect={() => fileARef.current?.click()}
                onClear={() => { setVideoA(null); setPreviewA(null) }}
                onDrop={f => { setVideoA(f); setPreviewA(URL.createObjectURL(f)) }}
                settings={settingsA} onSettingsChange={setSettingsA}
                videoRef={videoRefA} lang={lang}
              />

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400">{t.compareMethod}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRecommendMode(false)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                      ${!recommendMode ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                    {t.selectPlayer}
                  </button>
                  <button
                    onClick={() => setRecommendMode(true)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                      ${recommendMode ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                    {t.recommendStyle}
                  </button>
                </div>

                {!recommendMode && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {proPlayers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlayer(p.id)}
                          className={`text-left px-3 py-2 rounded-lg text-xs transition-colors border
                            ${selectedPlayer === p.id
                              ? 'border-green-500 bg-green-900/40 text-white'
                              : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}>
                          <div className="font-medium">{p.name.split(' (')[0]}</div>
                          <div className="text-gray-500 text-[10px] mt-0.5 leading-tight">{p.style}</div>
                        </button>
                      ))}
                    </div>
                    {selectedPlayer === '' && (
                      <p className="text-xs text-yellow-500">请选择一位球员</p>
                    )}
                  </div>
                )}

                {recommendMode && (
                  <p className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
                    AI 将分析你的打法特征，推荐最相似的职业球员供你参考学习。
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={submitPanel}
            disabled={!canSubmitPanel || loading || (panelMode === 'pro' && !recommendMode && !selectedPlayer)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors
              bg-green-600 hover:bg-green-500
              disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
            {submitLabel()}
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-gray-800 px-4 py-3 flex gap-2 items-end shrink-0">
        <button onClick={() => imageInputRef.current?.click()}
          className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center
            text-gray-400 hover:text-white transition-colors shrink-0" title="上传图片">
          🖼️
        </button>
        <button
          onClick={() => setShowVideoPanel(v => !v)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0
            ${showVideoPanel ? 'bg-green-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'}`}
          title="上传视频">
          🎬
        </button>

        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage() } }}
          placeholder={t.inputPlaceholder}
          rows={1}
          className="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-100
            placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-green-600
            min-h-[38px] max-h-32 overflow-y-auto"
          onInput={e => {
            const el = e.target as HTMLTextAreaElement
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 128) + 'px'
          }}
        />

        <button
          onClick={sendTextMessage}
          disabled={loading || (!inputText.trim() && pendingImages.length === 0)}
          className="w-9 h-9 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700
            disabled:text-gray-500 flex items-center justify-center transition-colors shrink-0">
          ➤
        </button>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileARef} type="file" accept="video/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]; if (!f) return
          setVideoA(f); setPreviewA(URL.createObjectURL(f))
          setShowVideoPanel(true)
          e.target.value = ''
        }} />
      <input ref={fileBRef} type="file" accept="video/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]; if (!f) return
          setVideoB(f); setPreviewB(URL.createObjectURL(f))
          e.target.value = ''
        }} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { Array.from(e.target.files ?? []).forEach(handleImageSelect); e.target.value = '' }} />
    </div>
  )
}
