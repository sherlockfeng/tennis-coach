import { Router, Response } from 'express'
import pool from '../db.js'
import { requireAuth, type AuthRequest } from '../middleware/authMiddleware.js'

const router = Router()
router.use(requireAuth)

// GET /api/profile/technique
router.get('/technique', async (req: AuthRequest, res: Response) => {
  const r = await pool.query(
    'SELECT strengths, weaknesses, style_tags, updated_at FROM technique_profile WHERE user_id = $1',
    [req.userId],
  )
  res.json(r.rows[0] ?? { strengths: [], weaknesses: [], style_tags: [], updated_at: null })
})

export default router
