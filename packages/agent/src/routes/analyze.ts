import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import os from 'os'
import { extractFrames, cleanupTmpDir } from '../services/frameExtractor.js'
import { chat, type ChatMessage, type ChatOptions } from '../services/aiProvider.js'
import { config, type AIProvider } from '../config.js'
import { extractUserId, extractSessionId } from '../middleware/extractUser.js'
import { getOrCreateSession, backgroundSave } from '../services/sessionSaver.js'
import { extractAndSaveTechnique } from '../services/techniqueExtractor.js'

const router = Router()

/**
 * Resolve per-request AI credentials.
 *
 * Priority: request header > server env key
 *
 * Headers:
 *   X-API-Key      — user's own API key (BYOK)
 *   X-AI-Provider  — "claude" | "openai"  (optional, defaults to server config)
 *
 * Returns null when no key is available at all (caller should respond 401).
 */
function resolveChat(req: Request): ChatOptions | null {
  const headerKey      = (req.headers['x-api-key']      as string | undefined)?.trim() || undefined
  const headerProvider = (req.headers['x-ai-provider']  as string | undefined)?.trim() as AIProvider | undefined
  const rawCoachStyle  = (req.headers['x-coach-style']  as string | undefined)?.trim()
  const coachStyle     = rawCoachStyle ? decodeURIComponent(rawCoachStyle) : undefined

  const provider = headerProvider ?? config.provider
  const apiKey   = headerKey ?? (provider === 'claude' ? config.claude.apiKey : config.openai.apiKey)

  if (!apiKey) return null
  return { provider, apiKey: headerKey, coachStyle }
}

// Multer: store uploads in temp dir
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
                     'image/jpeg', 'image/png', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

// ─── POST /api/analyze ──────────────────────────────────────────────
// Video upload → extract frames → AI analysis
// Body (multipart): video, startSec, endSec, fps, history (JSON)
router.post('/analyze', upload.single('video'), async (req: Request, res: Response) => {
  let tmpDir: string | null = null

  try {
    const chatOptions = resolveChat(req)
    if (!chatOptions) return res.status(401).json({ error: '请先在设置中填写 API Key' })

    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' })
    }

    const startSec = Number(req.body.startSec ?? 0)
    const endSec = Number(req.body.endSec ?? 10)
    const fps = Number(req.body.fps ?? 2)
    const history: ChatMessage[] = req.body.history ? JSON.parse(req.body.history) : []

    // Extract frames
    const extraction = await extractFrames({
      videoPath: req.file.path,
      startSec,
      endSec,
      fps,
    })
    tmpDir = extraction.tmpDir

    // Build user message with all frames
    const userMsg: ChatMessage = {
      role: 'user',
      images: extraction.frames,
      content: `请分析这 ${extraction.frameCount} 帧连续视频截图（从第 ${startSec} 秒到第 ${endSec} 秒，以 ${fps} fps 提取）。
请按照你的专业分析流程：整体印象 → 分阶段拆解 → 优点 → 问题 → 针对性练习建议。
如果看到击球动作，重点分析姿势、挥拍轨迹、击球点和随挥完成度。`,
    }

    const messages: ChatMessage[] = [...history, userMsg]
    const analysis = await chat(messages, chatOptions)

    const userId = extractUserId(req)
    let sessionId: number | null = null
    if (userId) {
      const title = `视频分析 ${new Date().toLocaleDateString('zh-CN')}`
      sessionId = await getOrCreateSession(userId, extractSessionId(req), 'analyze', title).catch(() => null)
    }

    res.json({
      frames: extraction.frames,
      frameCount: extraction.frameCount,
      analysis,
      provider: config.provider,
      sessionId,
      updatedHistory: [
        ...history,
        userMsg,
        { role: 'assistant', content: analysis },
      ],
    })

    if (userId && sessionId) {
      backgroundSave({
        userId, sessionId,
        userContent: `视频分析 第${startSec}s~${endSec}s，${fps}fps`,
        assistantContent: analysis,
        frames: extraction.frames,
        chatOptions,
        extractTechnique: (c, o) => extractAndSaveTechnique(c, o, userId),
      })
    }
  } catch (err: unknown) {
    console.error('[/analyze]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  } finally {
    if (tmpDir) await cleanupTmpDir(tmpDir)
    if (req.file) {
      import('fs').then(fs => fs.unlink(req.file!.path, () => {}))
    }
  }
})

// ─── POST /api/chat ──────────────────────────────────────────────────
// Text-only or image conversation with the tennis coach
// Body (JSON): { messages: ChatMessage[] }
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const chatOptions = resolveChat(req)
    if (!chatOptions) return res.status(401).json({ error: '请先在设置中填写 API Key' })

    const { messages } = req.body as { messages: ChatMessage[] }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' })
    }

    const reply = await chat(messages, chatOptions)

    const userId = extractUserId(req)
    let sessionId: number | null = null
    if (userId) {
      const firstMsg = (messages[0]?.content ?? '对话').slice(0, 30)
      sessionId = await getOrCreateSession(userId, extractSessionId(req), 'chat', firstMsg).catch(() => null)
    }

    res.json({ reply, provider: config.provider, sessionId })

    if (userId && sessionId) {
      backgroundSave({
        userId, sessionId,
        userContent: messages[messages.length - 1]?.content ?? '',
        assistantContent: reply,
        frames: [],
        chatOptions,
        extractTechnique: () => Promise.resolve(),
      })
    }
  } catch (err: unknown) {
    console.error('[/chat]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── POST /api/chat/image ─────────────────────────────────────────────
// Chat with multiple image uploads (for still photo analysis)
// Body (multipart): images[] (up to 10), text, history (JSON)
const uploadImage = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'))
  },
})

router.post('/chat/image', uploadImage.array('images', 10), async (req: Request, res: Response) => {
  const files = (req.files ?? []) as Express.Multer.File[]
  try {
    const chatOptions = resolveChat(req)
    if (!chatOptions) return res.status(401).json({ error: '请先在设置中填写 API Key' })

    if (files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' })
    }

    const text = req.body.text ??
      (files.length > 1 ? '请分析这些图片中的网球动作。' : '请分析这张图片中的网球动作。')
    const history: ChatMessage[] = req.body.history ? JSON.parse(req.body.history) : []

    const { readFile } = await import('fs/promises')
    const b64List = await Promise.all(
      files.map(async (f) => (await readFile(f.path)).toString('base64'))
    )

    const userMsg: ChatMessage = {
      role: 'user',
      images: b64List,
      content: text,
    }

    const messages: ChatMessage[] = [...history, userMsg]
    const reply = await chat(messages, chatOptions)

    const userId = extractUserId(req)
    let sessionId: number | null = null
    if (userId) {
      sessionId = await getOrCreateSession(userId, extractSessionId(req), 'chat', `图片分析 ${new Date().toLocaleDateString('zh-CN')}`).catch(() => null)
    }

    res.json({
      reply,
      provider: config.provider,
      sessionId,
      updatedHistory: [...history, userMsg, { role: 'assistant', content: reply }],
    })

    if (userId && sessionId) {
      backgroundSave({
        userId, sessionId,
        userContent: userMsg.content,
        assistantContent: reply,
        frames: b64List,
        chatOptions,
        extractTechnique: (c, o) => extractAndSaveTechnique(c, o, userId),
      })
    }
  } catch (err: unknown) {
    console.error('[/chat/image]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  } finally {
    // Clean up all uploaded temp files
    const { unlink } = await import('fs/promises')
    await Promise.allSettled(files.map((f) => unlink(f.path)))
  }
})

// ─── POST /api/compare ───────────────────────────────────────────────
// Two-video comparison OR user video vs pro player
//
// Mode A — 两段视频对比:
//   multipart fields: videoA, videoB, startSecA, endSecA, fpsA,
//                     startSecB, endSecB, fpsB, history
//
// Mode B — 与职业球员对比:
//   multipart fields: videoA, startSecA, endSecA, fpsA,
//                     playerName (string), history
//
// Mode C — 推荐相似球员:
//   multipart fields: videoA, startSecA, endSecA, fpsA,
//                     recommendStyle: "true", history

const uploadCompare = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
    cb(null, allowed.includes(file.mimetype))
  },
})

// 职业球员列表（供前端展示选项）
export const PRO_PLAYERS = [
  { id: 'federer',   name: '费德勒 (Roger Federer)',   style: '全面型，单手反手大师，网前技术精湛' },
  { id: 'nadal',     name: '纳达尔 (Rafael Nadal)',     style: '重上旋底线型，超强体能与防守反击' },
  { id: 'djokovic',  name: '德约科维奇 (Novak Djokovic)', style: '全场型，防守最强，双手反手稳定' },
  { id: 'murray',    name: '穆雷 (Andy Murray)',        style: '防守反击型，切削犀利，大局观强' },
  { id: 'alcaraz',   name: '阿尔卡拉斯 (Carlos Alcaraz)', style: '全能进攻型，移动速度顶级，放短球细腻' },
  { id: 'sinner',    name: '辛纳 (Jannik Sinner)',      style: '底线进攻型，正反手均衡，发球强力' },
  { id: 'swiatek',   name: '斯瓦泰克 (Iga Swiatek)',    style: '重上旋正手，高弹跳球处理能力出色' },
  { id: 'williams',  name: '小威廉姆斯 (Serena Williams)', style: '力量型，发球威力与正手攻击性兼备' },
] as const

router.get('/compare/players', (_req, res) => {
  res.json({ players: PRO_PLAYERS })
})

router.post(
  '/compare',
  uploadCompare.fields([
    { name: 'videoA', maxCount: 1 },
    { name: 'videoB', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const tmpDirs: string[] = []
    const uploadedFiles: string[] = []

    try {
      const chatOptions = resolveChat(req)
      if (!chatOptions) return res.status(401).json({ error: '请先在设置中填写 API Key' })

      const files = req.files as Record<string, Express.Multer.File[]>
      const fileA = files?.videoA?.[0]
      const fileB = files?.videoB?.[0]

      if (!fileA) {
        return res.status(400).json({ error: 'videoA is required' })
      }
      if (fileA) uploadedFiles.push(fileA.path)
      if (fileB) uploadedFiles.push(fileB.path)

      const startSecA = Number(req.body.startSecA ?? 0)
      const endSecA   = Number(req.body.endSecA   ?? 10)
      const fpsA      = Number(req.body.fpsA      ?? 2)
      const startSecB = Number(req.body.startSecB ?? 0)
      const endSecB   = Number(req.body.endSecB   ?? 10)
      const fpsB      = Number(req.body.fpsB      ?? 2)
      const playerName    = (req.body.playerName    ?? '') as string
      const recommendStyle = req.body.recommendStyle === 'true'
      const history: ChatMessage[] = req.body.history ? JSON.parse(req.body.history) : []

      // Extract frames from video A (always)
      const extractionA = await extractFrames({
        videoPath: fileA.path, startSec: startSecA, endSec: endSecA, fps: fpsA,
      })
      tmpDirs.push(extractionA.tmpDir)

      // Determine mode and build prompt
      let userMsg: ChatMessage

      if (fileB) {
        // ── Mode A: two-video comparison ──
        const extractionB = await extractFrames({
          videoPath: fileB.path, startSec: startSecB, endSec: endSecB, fps: fpsB,
        })
        tmpDirs.push(extractionB.tmpDir)

        userMsg = {
          role: 'user',
          images: [...extractionA.frames, ...extractionB.frames],
          content: `我上传了两段视频进行对比分析。
**视频 A**（前 ${extractionA.frameCount} 帧，第 ${startSecA}s~${endSecA}s）
**视频 B**（后 ${extractionB.frameCount} 帧，第 ${startSecB}s~${endSecB}s，从第 ${extractionA.frameCount + 1} 张图开始）

请对比分析这两段视频中的击球动作：
1. 分别描述 A 和 B 的动作特点
2. 明确指出 B 相比 A 有哪些进步
3. B 中还存在哪些需要继续改进的问题
4. 给出下一步的针对性练习建议`,
        }
      } else if (recommendStyle) {
        // ── Mode C: recommend similar pro player ──
        userMsg = {
          role: 'user',
          images: extractionA.frames,
          content: `请分析我的击球风格，然后推荐最相似的职业球员供我参考学习。

分析这 ${extractionA.frameCount} 帧（第 ${startSecA}s~${endSecA}s），请：
1. 总结我的打法风格特征（正手、步法、节奏等）
2. 推荐 1~2 位风格最相似的职业球员，并解释相似之处
3. 推荐参考这位球员的哪些技术细节来提升自己
4. 指出我目前和该球员最大的差距在哪里`,
        }
      } else {
        // ── Mode B: compare with specific pro player ──
        const player = PRO_PLAYERS.find(p => p.id === playerName || p.name.includes(playerName))
        const playerDesc = player
          ? `${player.name}（${player.style}）`
          : playerName || '费德勒'

        userMsg = {
          role: 'user',
          images: extractionA.frames,
          content: `请将我的击球动作与职业球员 ${playerDesc} 进行对比分析。

分析这 ${extractionA.frameCount} 帧（第 ${startSecA}s~${endSecA}s），请：
1. 描述我当前动作的主要特征
2. 介绍 ${playerDesc} 该动作的标准技术要点
3. 逐一对比：我和 ${playerDesc} 在姿势/轨迹/击球点/随挥上的具体差异
4. 给出 2~3 个可以向 ${playerDesc} 风格靠近的针对性练习`,
        }
      }

      const messages: ChatMessage[] = [...history, userMsg]
      const analysis = await chat(messages, chatOptions)

      const userId = extractUserId(req)
      const mode = fileB ? 'two-video' : recommendStyle ? 'recommend' : 'pro-player'
      const titleMap: Record<string, string> = {
        'two-video': `视频对比 ${new Date().toLocaleDateString('zh-CN')}`,
        'recommend': `风格推荐 ${new Date().toLocaleDateString('zh-CN')}`,
        'pro-player': `与${playerName || '球员'}对比 ${new Date().toLocaleDateString('zh-CN')}`,
      }
      let sessionId: number | null = null
      if (userId) {
        sessionId = await getOrCreateSession(userId, extractSessionId(req), 'compare', titleMap[mode]).catch(() => null)
      }

      res.json({
        analysis,
        framesA: extractionA.frames,
        framesB: [],
        provider: config.provider,
        mode,
        sessionId,
        updatedHistory: [
          ...history,
          { role: 'user' as const,      content: userMsg.content },
          { role: 'assistant' as const, content: analysis },
        ],
      })

      if (userId && sessionId) {
        backgroundSave({
          userId, sessionId,
          userContent: userMsg.content.slice(0, 100),
          assistantContent: analysis,
          frames: extractionA.frames,
          chatOptions,
          extractTechnique: (c, o) => extractAndSaveTechnique(c, o, userId),
        })
      }
    } catch (err: unknown) {
      console.error('[/compare]', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      await Promise.allSettled(tmpDirs.map(cleanupTmpDir))
      const { unlink } = await import('fs/promises')
      await Promise.allSettled(uploadedFiles.map((f) => unlink(f)))
    }
  }
)

export default router
