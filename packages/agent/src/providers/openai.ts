import OpenAI from 'openai'
import { config } from '../config.js'
import { TENNIS_COACH_SYSTEM_PROMPT } from './systemPrompt.js'
import type { ChatMessage } from './claude.js'

// Default client using server-configured key (may be empty if server runs in BYOK-only mode)
const defaultClient = new OpenAI({ apiKey: config.openai.apiKey || 'placeholder' })

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

export async function chatWithOpenAI(messages: ChatMessage[], apiKey?: string, coachStyle?: string, language?: string): Promise<string> {
  const client = apiKey ? new OpenAI({ apiKey }) : defaultClient
  const formatted: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(coachStyle, language) },
    ...messages.map((msg): OpenAI.ChatCompletionMessageParam => {
      if (msg.role === 'user' && msg.images && msg.images.length > 0) {
        return {
          role: 'user',
          content: [
            ...msg.images.map(
              (b64): OpenAI.ChatCompletionContentPartImage => ({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
              })
            ),
            { type: 'text', text: msg.content },
          ],
        }
      }
      return { role: msg.role, content: msg.content }
    }),
  ]

  const res = await client.chat.completions.create({
    model: config.openai.model,
    max_tokens: 4096,
    messages: formatted,
  })

  return res.choices[0]?.message?.content ?? ''
}
