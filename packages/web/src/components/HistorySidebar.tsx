import axios from 'axios'
import { useEffect, useState } from 'react'
import { TRANSLATIONS, type Lang } from '../i18n.js'

interface Session {
  id: number
  type: 'chat' | 'analyze' | 'compare'
  title: string
  created_at: number
  updated_at: number
}

interface DbMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  frame_urls: string[]
  created_at: number
}

interface TechniqueProfile {
  strengths: string[]
  weaknesses: string[]
  style_tags: string[]
  updated_at: number | null
}

export interface LoadedSession {
  sessionId: number
  messages: DbMessage[]
}

const TYPE_ICON: Record<string, string> = {
  chat: '💬',
  analyze: '📹',
  compare: '📊',
}

function formatDate(ts: number, t: { yesterday: string; daysAgo: (n: number) => string }) {
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - ts) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return t.yesterday
  if (diffDays < 7) return t.daysAgo(diffDays)
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
}

export default function HistorySidebar({
  api,
  authToken,
  onLoad,
  onClose,
  currentSessionId,
  lang,
}: {
  api: ReturnType<typeof axios.create>
  authToken: string
  onLoad: (s: LoadedSession) => void
  onClose: () => void
  currentSessionId: number | null
  lang: Lang
}) {
  const t = TRANSLATIONS[lang]
  const [sessions, setSessions] = useState<Session[]>([])
  const [profile, setProfile] = useState<TechniqueProfile | null>(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const headers = { Authorization: `Bearer ${authToken}` }

  useEffect(() => {
    api.get<{ sessions: Session[] }>('/api/sessions', { headers })
      .then(r => setSessions(r.data.sessions))
      .catch(() => {})
    api.get<TechniqueProfile>('/api/profile/technique', { headers })
      .then(r => setProfile(r.data))
      .catch(() => {})
  }, [])

  const loadSession = async (id: number) => {
    setLoadingId(id)
    try {
      const r = await api.get<{ session: Session; messages: DbMessage[] }>(
        `/api/sessions/${id}`, { headers }
      )
      onLoad({ sessionId: id, messages: r.data.messages })
    } catch {
    } finally {
      setLoadingId(null)
    }
  }

  const deleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.delete(`/api/sessions/${id}`, { headers }).catch(() => {})
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const hasTags = profile && (
    profile.strengths.length + profile.weaknesses.length + profile.style_tags.length > 0
  )

  return (
    <div className="w-72 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-bold text-white">{t.historyTitle}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Technique Profile */}
        {hasTags && (
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs font-semibold text-gray-400 mb-2">{t.myProfile}</p>
            {profile!.strengths.length > 0 && (
              <div className="mb-1.5">
                <p className="text-[10px] text-green-500 mb-1">{t.strengths}</p>
                <div className="flex flex-wrap gap-1">
                  {profile!.strengths.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px]
                      bg-green-900/40 text-green-300 border border-green-800">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile!.weaknesses.length > 0 && (
              <div className="mb-1.5">
                <p className="text-[10px] text-yellow-500 mb-1">{t.weaknesses}</p>
                <div className="flex flex-wrap gap-1">
                  {profile!.weaknesses.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px]
                      bg-yellow-900/40 text-yellow-300 border border-yellow-800">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile!.style_tags.length > 0 && (
              <div>
                <p className="text-[10px] text-blue-500 mb-1">{t.styleTags}</p>
                <div className="flex flex-wrap gap-1">
                  {profile!.style_tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px]
                      bg-blue-900/40 text-blue-300 border border-blue-800">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session list */}
        <div className="py-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8">{t.noHistory}</p>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left
                  hover:bg-gray-800 transition-colors group
                  ${currentSessionId === s.id ? 'bg-gray-800' : ''}`}>
                <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[s.type] ?? '💬'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate leading-tight">
                    {loadingId === s.id ? t.loading : s.title || t.untitled}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{formatDate(s.updated_at, t)}</p>
                </div>
                <button
                  onClick={e => deleteSession(s.id, e)}
                  className="shrink-0 text-gray-700 hover:text-red-400 opacity-0
                    group-hover:opacity-100 transition-opacity text-sm mt-0.5">
                  ×
                </button>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
