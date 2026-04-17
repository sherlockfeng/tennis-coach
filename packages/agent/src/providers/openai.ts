import OpenAI from 'openai'
import { config } from '../config.js'
import { TENNIS_COACH_SYSTEM_PROMPT } from './systemPrompt.js'
import type { ChatMessage } from './claude.js'

// Default client using server-configured key (may be empty if server runs in BYOK-only mode)
const defaultClient = new OpenAI({ apiKey: config.openai.apiKey || 'placeholder' })

export async function chatWithOpenAI(messages: ChatMessage[], apiKey?: string): Promise<string> {
  const client = apiKey ? new OpenAI({ apiKey }) : defaultClient
  const formatted: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: TENNIS_COACH_SYSTEM_PROMPT },
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
    max_tokens: 2048,
    messages: formatted,
  })

  return res.choices[0]?.message?.content ?? ''
}
