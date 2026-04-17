import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import type { Application } from 'express'

// Mock AI providers so tests don't hit real APIs
vi.mock('../services/aiProvider.js', () => ({
  chat: vi.fn().mockResolvedValue('这是来自 AI 教练的测试回复。'),
}))

// Mock ffmpeg frame extractor
vi.mock('../services/frameExtractor.js', () => ({
  extractFrames: vi.fn().mockResolvedValue({
    frames: ['base64framedata1', 'base64framedata2'],
    frameCount: 2,
    tmpDir: '/tmp/test-frames',
  }),
  cleanupTmpDir: vi.fn().mockResolvedValue(undefined),
}))

let app: Application

beforeAll(async () => {
  process.env.AI_PROVIDER = 'claude'
  process.env.CLAUDE_API_KEY = 'test-key'
  const mod = await import('../index.js')
  app = mod.app
})

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('POST /api/chat', () => {
  it('returns a reply for valid messages', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: '我的正手老是下网怎么办？' }] })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBeTruthy()
  })

  it('returns 400 for empty messages', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when messages field is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({})

    expect(res.status).toBe(400)
  })
})
