import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db.js'
import { jwtSecret } from '../config.js'
import { requireAuth, type AuthRequest } from '../middleware/authMiddleware.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function signToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, jwtSecret, { expiresIn: '30d' })
}

// ─── POST /api/auth/register ─────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' })
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码至少需要 6 位' })
  }

  const normalized = email.toLowerCase()
  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [normalized])
  if (exists.rows.length > 0) {
    return res.status(409).json({ error: '该邮箱已注册' })
  }

  const hash = await bcrypt.hash(password, 10)
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, $3) RETURNING id',
    [normalized, hash, Date.now()]
  )
  const userId: number = result.rows[0].id

  res.status(201).json({
    token: signToken(userId, normalized),
    user: { id: userId, email: normalized, apiKey: '', apiProvider: 'claude', coachStyle: '' },
  })
})

// ─── POST /api/auth/login ────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' })
  }

  const result = await pool.query(
    'SELECT id, email, password_hash, api_key, api_provider, coach_style FROM users WHERE email = $1',
    [email.toLowerCase()]
  )
  const user = result.rows[0] as {
    id: number; email: string; password_hash: string
    api_key: string; api_provider: string; coach_style: string
  } | undefined

  if (!user) {
    return res.status(401).json({ error: '邮箱或密码错误' })
  }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    return res.status(401).json({ error: '邮箱或密码错误' })
  }

  res.json({
    token: signToken(user.id, user.email),
    user: {
      id: user.id, email: user.email,
      apiKey: user.api_key, apiProvider: user.api_provider,
      coachStyle: user.coach_style,
    },
  })
})

// ─── GET /api/auth/me ────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    'SELECT id, email, api_key, api_provider, coach_style FROM users WHERE id = $1',
    [req.userId]
  )
  const user = result.rows[0]

  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  res.json({
    id: user.id, email: user.email,
    apiKey: user.api_key, apiProvider: user.api_provider,
    coachStyle: user.coach_style,
  })
})

// ─── PUT /api/auth/api-token ─────────────────────────────────────────
router.put('/api-token', requireAuth, async (req: AuthRequest, res: Response) => {
  const { apiKey, apiProvider } = req.body as { apiKey?: string; apiProvider?: string }

  const provider = apiProvider === 'openai' ? 'openai' : 'claude'
  const key = (apiKey ?? '').trim()

  await pool.query(
    'UPDATE users SET api_key = $1, api_provider = $2 WHERE id = $3',
    [key, provider, req.userId]
  )

  res.json({ ok: true })
})

// ─── PUT /api/auth/coach-style ────────────────────────────────────────
router.put('/coach-style', requireAuth, async (req: AuthRequest, res: Response) => {
  const { coachStyle } = req.body as { coachStyle?: string }
  await pool.query(
    'UPDATE users SET coach_style = $1 WHERE id = $2',
    [(coachStyle ?? '').trim(), req.userId]
  )
  res.json({ ok: true })
})

export default router
