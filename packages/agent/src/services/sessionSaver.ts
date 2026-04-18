import pool from '../db.js'
import { uploadFrames } from './storage.js'
import type { ChatOptions } from './aiProvider.js'

export async function getOrCreateSession(
  userId: number,
  sessionId: number | null,
  type: string,
  title: string,
): Promise<number> {
  if (sessionId) {
    const r = await pool.query(
      'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId],
    )
    if (r.rows.length > 0) return sessionId
  }
  const now = Date.now()
  const r = await pool.query(
    'INSERT INTO sessions (user_id, type, title, created_at, updated_at) VALUES ($1,$2,$3,$4,$4) RETURNING id',
    [userId, type, title, now],
  )
  return r.rows[0].id as number
}

export async function saveMessage(
  sessionId: number,
  role: string,
  content: string,
  frameUrls: string[] = [],
): Promise<number> {
  const r = await pool.query(
    'INSERT INTO messages (session_id, role, content, frame_urls, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [sessionId, role, content, frameUrls, Date.now()],
  )
  return r.rows[0].id as number
}

export async function touchSession(sessionId: number) {
  await pool.query('UPDATE sessions SET updated_at = $1 WHERE id = $2', [Date.now(), sessionId])
}

// Fire-and-forget: save messages + upload frames + update frame_urls
export function backgroundSave(params: {
  userId: number
  sessionId: number
  userContent: string
  assistantContent: string
  frames: string[]
  chatOptions: ChatOptions
  extractTechnique: (content: string, opts: ChatOptions) => Promise<void>
}) {
  const { userId, sessionId, userContent, assistantContent, frames, chatOptions, extractTechnique } = params
  ;(async () => {
    const msgId = await saveMessage(sessionId, 'user', userContent)
    await saveMessage(sessionId, 'assistant', assistantContent)
    await touchSession(sessionId)

    if (frames.length > 0) {
      const urls = await uploadFrames(userId, sessionId, frames)
      if (urls.length > 0) {
        await pool.query('UPDATE messages SET frame_urls = $1 WHERE id = $2', [urls, msgId])
      }
    }

    if (assistantContent.length > 50) {
      extractTechnique(assistantContent, chatOptions).catch(() => {})
    }
  })().catch(e => console.error('[backgroundSave]', e))
}
