import express from 'express'
import cors from 'cors'
import { config, validateConfig } from './config.js'
import analyzeRouter from './routes/analyze.js'
import authRouter from './routes/auth.js'

validateConfig()

const app = express()

// ── Origin whitelist ──────────────────────────────────────────────────
// Set ALLOWED_ORIGINS in .env as comma-separated URLs, e.g.:
//   ALLOWED_ORIGINS=https://tennis-coach.pages.dev,http://localhost:5173
// If the variable is empty, all origins are allowed (dev fallback).
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin header (curl, Postman, server-to-server)
    // only when no whitelist is configured
    if (!origin) return cb(null, allowedOrigins.length === 0)
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true)
    }
    cb(new Error(`Origin ${origin} not allowed`))
  },
}))

app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: config.provider,
    model: config.provider === 'claude' ? config.claude.model : config.openai.model,
  })
})

app.use('/api/auth', authRouter)
app.use('/api', analyzeRouter)

app.listen(config.port, () => {
  console.log(`🎾 Tennis Coach Agent running on http://localhost:${config.port}`)
  console.log(`   Provider: ${config.provider.toUpperCase()}`)
  console.log(`   Model:    ${config.provider === 'claude' ? config.claude.model : config.openai.model}`)
})

export { app }
