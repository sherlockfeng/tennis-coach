import { test, expect } from '@playwright/test'

const MOCK_USER = {
  id: 1,
  email: 'test@example.com',
  apiKey: '',
  apiProvider: 'claude' as const,
  coachStyle: '',
}

async function loginAs(page: import('@playwright/test').Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('tc_auth', JSON.stringify({ token: 'mock-token', user }))
    localStorage.setItem('tc_lang', 'zh')
  }, MOCK_USER)
}

function makeFrameUrls(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `https://example.supabase.co/storage/v1/object/public/tennis-frames/1/42/${i}.jpg`
  )
}

// ─── History Frames: Happy Path ───────────────────────────────────────

test('history sidebar shows all frames when session has 25 frames', async ({ page }) => {
  const frameUrls = makeFrameUrls(25)

  await loginAs(page)
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessions: [{ id: 42, type: 'analyze', title: '正手分析', created_at: Date.now(), updated_at: Date.now() }],
      }),
    })
  })
  await page.route('/api/sessions/42', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        session: { id: 42, type: 'analyze', title: '正手分析', created_at: Date.now(), updated_at: Date.now() },
        messages: [
          {
            id: 1,
            role: 'user',
            content: '帮我分析正手',
            frame_urls: frameUrls,
            created_at: Date.now(),
          },
          {
            id: 2,
            role: 'assistant',
            content: '你的正手挥拍轨迹偏平',
            frame_urls: [],
            created_at: Date.now(),
          },
        ],
      }),
    })
  })
  await page.route('/api/profile/technique', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ strengths: [], weaknesses: [], style_tags: [], updated_at: null }) })
  })

  await page.goto('/')
  await page.locator('button[title="历史记录"]').click()
  await page.getByText('正手分析').click()

  // All 25 frames should be rendered as img elements
  const imgs = page.locator('img[src*="tennis-frames"]')
  await expect(imgs).toHaveCount(25, { timeout: 5000 })
})

test('history session with 0 frames shows no frame images', async ({ page }) => {
  await loginAs(page)
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessions: [{ id: 10, type: 'chat', title: '纯文字对话', created_at: Date.now(), updated_at: Date.now() }],
      }),
    })
  })
  await page.route('/api/sessions/10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        session: { id: 10, type: 'chat', title: '纯文字对话', created_at: Date.now(), updated_at: Date.now() },
        messages: [
          { id: 1, role: 'user', content: '怎么练发球', frame_urls: [], created_at: Date.now() },
          { id: 2, role: 'assistant', content: '先练抛球', frame_urls: [], created_at: Date.now() },
        ],
      }),
    })
  })
  await page.route('/api/profile/technique', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ strengths: [], weaknesses: [], style_tags: [], updated_at: null }) })
  })

  await page.goto('/')
  await page.locator('button[title="历史记录"]').click()
  await page.getByText('纯文字对话').click()

  const imgs = page.locator('img[src*="tennis-frames"]')
  await expect(imgs).toHaveCount(0)
})

// ─── History Frames: Edge Cases ───────────────────────────────────────

test('history sidebar is empty when no sessions exist', async ({ page }) => {
  await loginAs(page)
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessions: [] }),
    })
  })
  await page.route('/api/profile/technique', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ strengths: [], weaknesses: [], style_tags: [], updated_at: null }) })
  })

  await page.goto('/')
  await page.locator('button[title="历史记录"]').click()
  await expect(page.getByText('暂无历史记录')).toBeVisible()
})

test('deleting a session removes it from the list', async ({ page }) => {
  await loginAs(page)
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessions: [{ id: 5, type: 'chat', title: '待删除对话', created_at: Date.now(), updated_at: Date.now() }],
      }),
    })
  })
  await page.route('/api/sessions/5', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
  })
  await page.route('/api/profile/technique', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ strengths: [], weaknesses: [], style_tags: [], updated_at: null }) })
  })

  await page.goto('/')
  await page.locator('button[title="历史记录"]').click()
  await expect(page.getByText('待删除对话')).toBeVisible()

  // Hover to reveal delete button then click
  await page.getByText('待删除对话').hover()
  const deleteBtn = page.locator('button').filter({ hasText: '×' }).last()
  await deleteBtn.click()

  await expect(page.getByText('待删除对话')).not.toBeVisible()
})

// ─── History Frames: Adversarial ─────────────────────────────────────

test('session load failure shows no crash — chat stays intact', async ({ page }) => {
  await loginAs(page)
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessions: [{ id: 99, type: 'analyze', title: '损坏的记录', created_at: Date.now(), updated_at: Date.now() }],
      }),
    })
  })
  await page.route('/api/sessions/99', async (route) => {
    await route.fulfill({ status: 500, body: 'Internal Server Error' })
  })
  await page.route('/api/profile/technique', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ strengths: [], weaknesses: [], style_tags: [], updated_at: null }) })
  })

  await page.goto('/')
  await page.locator('button[title="历史记录"]').click()
  await page.getByText('损坏的记录').click()

  // App should not crash; welcome message still visible
  await expect(page.getByText(/你好！我是你的 AI 网球教练/)).toBeVisible()
})
