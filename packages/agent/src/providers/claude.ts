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

function buildSystemPrompt(coachStyle?: string, language?: string) {
  let prompt = TENNIS_COACH_SYSTEM_PROMPT

  if (language === 'en') {
    prompt += '\n\n## Language Requirement\nYou MUST respond in English only, regardless of the language the user writes in.'
  } else if (language === 'zh') {
    prompt += '\n\n## 语言要求\n无论用户用什么语言提问，你都必须用中文回复。'
  }

  if (coachStyle?.trim()) {
    prompt += `\n\n## 个性化教学风格要求\n\n${coachStyle.trim()}\n\n请严格按照以上风格要求与学员互动，这是学员本人设置的偏好。`
  }

  return prompt
}

export async function chatWithClaude(messages: ChatMessage[], apiKey?: string, coachStyle?: string, language?: string): Promise<string> {
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
    max_tokens: 4096,
    system: buildSystemPrompt(coachStyle, language),
    messages: formatted,
  })

  return (response.content[0] as Anthropic.TextBlock).text
}
