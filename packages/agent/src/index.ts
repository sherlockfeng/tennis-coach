import express from 'express'
import cors from 'cors'
import { config, validateConfig } from './config.js'
import analyzeRouter from './routes/analyze.js'

validateConfig()

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: config.provider,
    model: config.provider === 'claude' ? config.claude.model : config.openai.model,
  })
})

app.use('/api', analyzeRouter)

app.listen(config.port, () => {
  console.log(`🎾 Tennis Coach Agent running on http://localhost:${config.port}`)
  console.log(`   Provider: ${config.provider.toUpperCase()}`)
  console.log(`   Model:    ${config.provider === 'claude' ? config.claude.model : config.openai.model}`)
})

export { app }
