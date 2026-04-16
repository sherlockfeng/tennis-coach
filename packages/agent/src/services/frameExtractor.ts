import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface FrameExtractionOptions {
  videoPath: string
  startSec: number
  endSec: number
  fps: number
}

export interface ExtractionResult {
  frames: string[]   // base64 jpeg strings
  frameCount: number
  tmpDir: string
}

export async function extractFrames(opts: FrameExtractionOptions): Promise<ExtractionResult> {
  const { videoPath, startSec, endSec, fps } = opts
  const duration = endSec - startSec

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tennis-frames-'))
  const outputPattern = path.join(tmpDir, 'frame-%04d.jpg')

  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(startSec)
      .duration(duration)
      .outputOptions([
        `-vf fps=${fps}`,
        '-q:v 3',          // JPEG quality (1=best, 31=worst)
        '-vframes 50',     // cap at 50 frames max
      ])
      .output(outputPattern)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })

  const files = (await fs.readdir(tmpDir))
    .filter((f) => f.endsWith('.jpg'))
    .sort()

  const frames = await Promise.all(
    files.map(async (f) => {
      const buf = await fs.readFile(path.join(tmpDir, f))
      return buf.toString('base64')
    })
  )

  return { frames, frameCount: frames.length, tmpDir }
}

export async function cleanupTmpDir(tmpDir: string): Promise<void> {
  await fs.rm(tmpDir, { recursive: true, force: true })
}
