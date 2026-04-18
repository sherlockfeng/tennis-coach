const BUCKET = 'tennis-frames'

function supabaseBase() {
  return process.env.SUPABASE_URL
}
function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

function selectIndices(total: number, max: number): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i)
  const step = total / max
  return Array.from({ length: max }, (_, i) => Math.floor(i * step))
}

export async function uploadFrames(
  userId: number,
  sessionId: number,
  frames: string[],
): Promise<string[]> {
  const base = supabaseBase()
  const key = serviceKey()
  if (!base || !key || frames.length === 0) return []

  const urls: string[] = []
  const indices = selectIndices(frames.length, 8) // upload at most 8 key frames

  for (const i of indices) {
    try {
      const path = `${userId}/${sessionId}/${i}.jpg`
      const buf = Buffer.from(frames[i], 'base64')
      const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
        body: buf,
      })
      if (res.ok) {
        urls.push(`${base}/storage/v1/object/public/${BUCKET}/${path}`)
      }
    } catch {
      // skip failed frames silently
    }
  }

  return urls
}
