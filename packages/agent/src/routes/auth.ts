import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'
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

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists) {
    return res.status(409).json({ error: '该邮箱已注册' })
  }

  const hash = await bcrypt.hash(password, 10)
  const stmt = db.prepare(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)'
  )
  const result = stmt.run(email.toLowerCase(), hash, Date.now())
  const userId = result.lastInsertRowid as number

  res.status(201).json({
    token: signToken(userId, email),
    user: { id: userId, email, apiKey: '', apiProvider: 'claude' },
  })
})

// ─── POST /api/auth/login ────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' })
  }

  const user = db.prepare(
    'SELECT id, email, password_hash, api_key, api_provider FROM users WHERE email = ?'
  ).get(email.toLowerCase()) as {
    id: number; email: string; password_hash: string
    api_key: string; api_provider: string
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
    user: { id: user.id, email: user.email, apiKey: user.api_key, apiProvider: user.api_provider },
  })
})

// ─── GET /api/auth/me ────────────────────────────────────────────────
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = db.prepare(
    'SELECT id, email, api_key, api_provider FROM users WHERE id = ?'
  ).get(req.userId) as {
    id: number; email: string; api_key: string; api_provider: string
  } | undefined

  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  res.json({ id: user.id, email: user.email, apiKey: user.api_key, apiProvider: user.api_provider })
})

// ─── PUT /api/auth/api-token ─────────────────────────────────────────
router.put('/api-token', requireAuth, (req: AuthRequest, res: Response) => {
  const { apiKey, apiProvider } = req.body as { apiKey?: string; apiProvider?: string }

  const provider = apiProvider === 'openai' ? 'openai' : 'claude'
  const key = (apiKey ?? '').trim()

  db.prepare(
    'UPDATE users SET api_key = ?, api_provider = ? WHERE id = ?'
  ).run(key, provider, req.userId)

  res.json({ ok: true })
})

export default router
