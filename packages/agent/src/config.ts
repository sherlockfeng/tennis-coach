import './load-env.js'

export type AIProvider = 'claude' | 'openai'

export const config = {
  port: Number(process.env.PORT ?? 3001),
  provider: (process.env.AI_PROVIDER ?? 'claude') as AIProvider,

  claude: {
    apiKey: process.env.CLAUDE_API_KEY ?? '',
    model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-5',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  },
}

export function validateConfig() {
  // In BYOK mode (BYOK_ONLY=true) server keys are optional — users supply their own.
  // In normal mode at least one key must be present.
  if (process.env.BYOK_ONLY === 'true') return

  if (config.provider === 'claude' && !config.claude.apiKey) {
    throw new Error('CLAUDE_API_KEY is required when AI_PROVIDER=claude (set BYOK_ONLY=true to skip)')
  }
  if (config.provider === 'openai' && !config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai (set BYOK_ONLY=true to skip)')
  }
}
