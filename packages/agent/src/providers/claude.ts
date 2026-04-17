import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'
import { TENNIS_COACH_SYSTEM_PROMPT } from './systemPrompt.js'

// Default client using server-configured key (may be empty if server runs in BYOK-only mode)
const defaultClient = new Anthropic({ apiKey: config.claude.apiKey || 'placeholder' })

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]  // base64 jpeg strings
}

export async function chatWithClaude(messages: ChatMessage[], apiKey?: string): Promise<string> {
  const client = apiKey ? new Anthropic({ apiKey }) : defaultClient
  const formatted: Anthropic.MessageParam[] = messages.map((msg) => {
    if (msg.role === 'user' && msg.images && msg.images.length > 0) {
      return {
        role: 'user',
        content: [
          ...msg.images.map((b64): Anthropic.ImageBlockParam => ({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: b64,
            },
          })),
          { type: 'text', text: msg.content },
        ],
      }
    }
    return { role: msg.role, content: msg.content }
  })

  const response = await client.messages.create({
    model: config.claude.model,
    max_tokens: 2048,
    system: TENNIS_COACH_SYSTEM_PROMPT,
    messages: formatted,
  })

  return (response.content[0] as Anthropic.TextBlock).text
}
