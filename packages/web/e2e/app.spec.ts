import { test, expect } from '@playwright/test'

// ─── Layout & Initial State ──────────────────────────────────────────

test('shows header with coach title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'AI 网球教练' })).toBeVisible()
})

test('shows welcome message from coach on load', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/你好！我是你的 AI 网球教练/)).toBeVisible()
})

test('shows input bar with all buttons', async ({ page }) => {
  await page.goto('/')
  // Image upload button
  await expect(page.locator('button[title="上传图片"]')).toBeVisible()
  // Video upload button
  await expect(page.locator('button[title="上传视频"]')).toBeVisible()
  // Text input
  await expect(page.locator('textarea')).toBeVisible()
  // Send button
  await expect(page.locator('button').last()).toBeVisible()
})

// ─── Chat Interaction ────────────────────────────────────────────────

test('send button is disabled when input is empty', async ({ page }) => {
  await page.goto('/')
  const sendBtn = page.locator('button').last()
  await expect(sendBtn).toBeDisabled()
})

test('send button enables when text is typed', async ({ page }) => {
  await page.goto('/')
  const textarea = page.locator('textarea')
  await textarea.fill('正手老是出界怎么办？')
  const sendBtn = page.locator('button').last()
  await expect(sendBtn).toBeEnabled()
})

test('user message appears in chat after typing and pressing Enter', async ({ page }) => {
  // Mock the API to avoid real network calls
  await page.route('/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: '测试教练回复', provider: 'claude' }),
    })
  })

  await page.goto('/')
  const textarea = page.locator('textarea')
  await textarea.fill('正手老是出界怎么办？')
  await textarea.press('Enter')

  await expect(page.getByText('正手老是出界怎么办？')).toBeVisible()
})

test('assistant reply appears after sending message', async ({ page }) => {
  await page.route('/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: '你的正手挥拍轨迹偏平，试试增加上旋！', provider: 'claude' }),
    })
  })

  await page.goto('/')
  await page.locator('textarea').fill('正手老是出界')
  await page.locator('textarea').press('Enter')

  await expect(page.getByText('你的正手挥拍轨迹偏平，试试增加上旋！')).toBeVisible({ timeout: 10_000 })
})

// ─── Video Panel ─────────────────────────────────────────────────────

test('clicking video button toggles the video panel', async ({ page }) => {
  await page.goto('/')
  const videoBtn = page.locator('button[title="上传视频"]')

  // Panel not visible initially
  await expect(page.getByText('单段分析')).not.toBeVisible()

  // Click to open
  await videoBtn.click()
  await expect(page.getByText('单段分析')).toBeVisible()

  // Click to close
  await videoBtn.click()
  await expect(page.getByText('单段分析')).not.toBeVisible()
})

// ─── New Conversation ────────────────────────────────────────────────

test('新对话 button resets the chat', async ({ page }) => {
  await page.route('/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'AI回复', provider: 'claude' }),
    })
  })

  await page.goto('/')
  await page.locator('textarea').fill('测试消息')
  await page.locator('textarea').press('Enter')
  await page.getByText('测试消息').waitFor()

  // Reset
  await page.getByText('新对话').click()
  await expect(page.getByText('测试消息')).not.toBeVisible()
  await expect(page.getByText(/新对话开始了/)).toBeVisible()
})
