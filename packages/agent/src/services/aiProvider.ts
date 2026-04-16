import { config } from '../config.js'
import { chatWithClaude, type ChatMessage } from '../providers/claude.js'
import { chatWithOpenAI } from '../providers/openai.js'

export type { ChatMessage }

export async function chat(messages: ChatMessage[]): Promise<string> {
  if (config.provider === 'claude') {
    return chatWithClaude(messages)
  }
  return chatWithOpenAI(messages)
}
