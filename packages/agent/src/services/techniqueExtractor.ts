import pool from '../db.js'
import { chat, type ChatOptions } from './aiProvider.js'

interface Tags { strengths: string[]; weaknesses: string[]; styleTags: string[] }

export async function extractAndSaveTechnique(content: string, opts: ChatOptions, userId: number) {
  const prompt = `根据以下网球技术分析，提取技术标签。只返回JSON，不要其他文字。
格式：{"strengths":["优点"],"weaknesses":["问题"],"styleTags":["风格"]}
每个数组最多3个元素，每个标签最多8个汉字。
分析内容：${content.slice(0, 600)}`

  const raw = await chat([{ role: 'user', content: prompt }], opts)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return

  const tags: Tags = JSON.parse(match[0])
  const strengths = (tags.strengths ?? []).slice(0, 3)
  const weaknesses = (tags.weaknesses ?? []).slice(0, 3)
  const styleTags = (tags.styleTags ?? []).slice(0, 3)

  await pool.query(
    `INSERT INTO technique_profile (user_id, strengths, weaknesses, style_tags, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       strengths  = ARRAY(SELECT DISTINCT unnest(technique_profile.strengths  || EXCLUDED.strengths)  LIMIT 15),
       weaknesses = ARRAY(SELECT DISTINCT unnest(technique_profile.weaknesses || EXCLUDED.weaknesses) LIMIT 15),
       style_tags = ARRAY(SELECT DISTINCT unnest(technique_profile.style_tags || EXCLUDED.style_tags) LIMIT 10),
       updated_at = EXCLUDED.updated_at`,
    [userId, strengths, weaknesses, styleTags, Date.now()],
  )
}
