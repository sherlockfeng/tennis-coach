import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../config.js'

export interface AuthRequest extends Request {
  userId?: number
  userEmail?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, jwtSecret) as { userId: number; email: string }
    req.userId = payload.userId
    req.userEmail = payload.email
    next()
  } catch {
    return res.status(401).json({ error: 'Token 无效或已过期，请重新登录' })
  }
}
