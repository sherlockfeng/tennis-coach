import { test, expect } from '@playwright/test'

const MOCK_USER = {
  id: 1,
  email: 'test@example.com',
  apiKey: '',
  apiProvider: 'claude' as const,
  coachStyle: '',
}

async function loginAs(page: import('@playwright/test').Page, coachStyle = '') {
  await page.addInitScript((user) => {
    localStorage.setItem('tc_auth', JSON.stringify({
      token: 'mock-token',
      user,
    }))
  }, { ...MOCK_USER, coachStyle })
}

// ─── Coach Style: Happy Path ──────────────────────────────────────────

test('settings modal shows coach style section when logged in', async ({ page }) => {
  await loginAs(page)
  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  await expect(page.getByText('教练风格')).toBeVisible()
  await expect(page.getByText('均衡型')).toBeVisible()
  await expect(page.getByText('严厉型')).toBeVisible()
  await expect(page.getByText('启发型')).toBeVisible()
  await expect(page.getByText('细节型')).toBeVisible()
  await expect(page.getByText('自定义')).toBeVisible()
})

test('coach style section is NOT shown when logged out', async ({ page }) => {
  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  await expect(page.getByText('教练风格')).not.toBeVisible()
})

test('clicking a preset highlights it', async ({ page }) => {
  await loginAs(page)
  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  const strictBtn = page.getByRole('button', { name: '严厉型' })
  await strictBtn.click()
  await expect(strictBtn).toHaveClass(/bg-green-700/)
})

test('selecting custom preset shows textarea', async ({ page }) => {
  await loginAs(page)
  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  await page.getByRole('button', { name: '自定义' }).click()
  await expect(page.locator('textarea[placeholder*="教练风格"]')).toBeVisible()
})

test('saved coach style is restored on page reload', async ({ page }) => {
  const style = '请以严厉风格执教：直接指出所有问题，不要过多鼓励，像对待职业球员一样严格要求，要求学员做到更好。'
  await loginAs(page, style)
  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  // 严厉型 preset should be auto-selected since its instruction matches
  const strictBtn = page.getByRole('button', { name: '严厉型' })
  await expect(strictBtn).toHaveClass(/bg-green-700/)
})

// ─── Coach Style: Save Flow ───────────────────────────────────────────

test('save style button calls PUT /api/auth/coach-style', async ({ page }) => {
  await loginAs(page)

  let capturedBody: unknown = null
  await page.route('/api/auth/coach-style', async (route) => {
    capturedBody = await route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  await page.getByRole('button', { name: '严厉型' }).click()
  await page.getByRole('button', { name: '保存风格偏好' }).click()
  await expect(page.getByText('保存风格偏好')).toBeVisible({ timeout: 3000 })

  expect(capturedBody).toMatchObject({ coachStyle: expect.stringContaining('严厉') })
})

test('custom coach style text is sent on save', async ({ page }) => {
  await loginAs(page)

  let capturedBody: unknown = null
  await page.route('/api/auth/coach-style', async (route) => {
    capturedBody = await route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  await page.getByRole('button', { name: '自定义' }).click()
  await page.locator('textarea[placeholder*="教练风格"]').fill('多用中文，简短有力')
  await page.getByRole('button', { name: '保存风格偏好' }).click()

  expect(capturedBody).toMatchObject({ coachStyle: '多用中文，简短有力' })
})

// ─── Coach Style: Edge Cases ──────────────────────────────────────────

test('balanced preset saves empty coachStyle string', async ({ page }) => {
  await loginAs(page, '严厉型指令')
  let capturedBody: unknown = null
  await page.route('/api/auth/coach-style', async (route) => {
    capturedBody = await route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  await page.getByRole('button', { name: '均衡型' }).click()
  await page.getByRole('button', { name: '保存风格偏好' }).click()

  expect(capturedBody).toMatchObject({ coachStyle: '' })
})

test('custom preset with blank text saves empty string', async ({ page }) => {
  await loginAs(page)
  let capturedBody: unknown = null
  await page.route('/api/auth/coach-style', async (route) => {
    capturedBody = await route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')
  await page.locator('button[title="API Key 设置"]').click()
  await page.getByRole('button', { name: '自定义' }).click()
  // leave textarea blank
  await page.getByRole('button', { name: '保存风格偏好' }).click()

  expect(capturedBody).toMatchObject({ coachStyle: '' })
})
