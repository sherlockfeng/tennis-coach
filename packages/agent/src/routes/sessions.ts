import { Router, Response } from 'express'
import pool from '../db.js'
import { requireAuth, type AuthRequest } from '../middleware/authMiddleware.js'

const router = Router()
router.use(requireAuth)

// GET /api/sessions — list user's sessions (newest first)
router.get('/', async (req: AuthRequest, res: Response) => {
  const r = await pool.query(
    `SELECT id, type, title, created_at, updated_at
     FROM sessions WHERE user_id = $1
     ORDER BY updated_at DESC LIMIT 50`,
    [req.userId],
  )
  res.json({ sessions: r.rows })
})

// GET /api/sessions/:id — session detail with messages
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const sid = Number(req.params.id)
  const sr = await pool.query(
    'SELECT id, type, title, created_at FROM sessions WHERE id = $1 AND user_id = $2',
    [sid, req.userId],
  )
  if (sr.rows.length === 0) return res.status(404).json({ error: '记录不存在' })

  const mr = await pool.query(
    'SELECT id, role, content, frame_urls, created_at FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sid],
  )
  res.json({ session: sr.rows[0], messages: mr.rows })
})

// DELETE /api/sessions/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await pool.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [
    Number(req.params.id),
    req.userId,
  ])
  res.json({ ok: true })
})

export default router
