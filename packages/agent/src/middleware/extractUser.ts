import { Request } from 'express'
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../config.js'

export function extractUserId(req: Request): number | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as { userId: number }
    return payload.userId
  } catch {
    return null
  }
}

export function extractSessionId(req: Request): number | null {
  const h = req.headers['x-session-id']
  if (!h) return null
  const n = Number(h)
  return Number.isFinite(n) && n > 0 ? n : null
}
