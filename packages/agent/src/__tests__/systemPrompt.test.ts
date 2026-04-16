import { describe, it, expect } from 'vitest'
import { TENNIS_COACH_SYSTEM_PROMPT } from '../providers/systemPrompt.js'

describe('TENNIS_COACH_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof TENNIS_COACH_SYSTEM_PROMPT).toBe('string')
    expect(TENNIS_COACH_SYSTEM_PROMPT.length).toBeGreaterThan(100)
  })

  it('contains key professional knowledge sections', () => {
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('费德勒')
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('纳达尔')
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('德约科维奇')
  })

  it('includes racket and string recommendation guidance', () => {
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('球拍')
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('球线')
  })

  it('covers all major shot types', () => {
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('正手')
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('反手')
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('发球')
    expect(TENNIS_COACH_SYSTEM_PROMPT).toContain('截击')
  })
})
