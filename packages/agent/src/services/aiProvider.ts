import { config, type AIProvider } from '../config.js'
import { chatWithClaude, type ChatMessage } from '../providers/claude.js'
import { chatWithOpenAI } from '../providers/openai.js'

export type { ChatMessage }

export interface ChatOptions {
  /** Override the server-default provider for this request */
  provider?: AIProvider
  /** User-supplied API key (BYOK). Takes precedence over server key. */
  apiKey?: string
  /** User's personal coach style preference, appended to the system prompt */
  coachStyle?: string
}

export async function chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  const provider   = options?.provider   ?? config.provider
  const apiKey     = options?.apiKey
  const coachStyle = options?.coachStyle

  if (provider === 'claude') {
    return chatWithClaude(messages, apiKey, coachStyle)
  }
  return chatWithOpenAI(messages, apiKey, coachStyle)
}
