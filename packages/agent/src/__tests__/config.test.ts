import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('config validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when claude provider has no API key', async () => {
    process.env.AI_PROVIDER = 'claude'
    process.env.CLAUDE_API_KEY = ''

    // Re-import to pick up env changes
    const { validateConfig } = await import('../config.js')
    expect(() => validateConfig()).toThrow('CLAUDE_API_KEY')
  })

  it('throws when openai provider has no API key', async () => {
    process.env.AI_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = ''

    const { validateConfig } = await import('../config.js')
    expect(() => validateConfig()).toThrow('OPENAI_API_KEY')
  })
})
