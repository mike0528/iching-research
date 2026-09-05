import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function goTo(page: Page, hash: string) {
  await page.goto(`/${hash}`)
}

test.describe('觀象核心使用流程', () => {
  test('首頁、逐步揲蓍、Undo、自動完成與結果頁', async ({ page }) => {
    await goTo(page, '#/')
    await expect(page.getByRole('heading', { name: /先觀其象/ })).toBeVisible()

    await page.getByRole('button', { name: /開始揲蓍法/ }).click()
    await expect(page.getByText(/也可以在此直接選擇「六爻全部一次產生」/)).toBeVisible()
    await page.getByRole('textbox', { name: /這次想研究的問題/ }).fill('E2E 測試問題')
    await page.getByRole('button', { name: /開始第 1 爻/ }).click()
    await expect(page).toHaveURL(/#\/cast$/)

    for (const operation of ['分二', '掛一', '揲四', '歸奇']) {
      await page.getByRole('button', { name: new RegExp(`執行${operation}`) }).click()
    }
    await expect(page.getByRole('button', { name: '完成本變', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '完成本變', exact: true }).click()
    await expect(page.getByText(/1／6 爻/)).toBeVisible()

    await page.getByRole('button', { name: /返回上一步/ }).click()
    await expect(page.getByRole('button', { name: '完成本變', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '完成本變', exact: true }).click()

    for (let index = 0; index < 18 && await page.getByRole('button', { name: /查看卦象結果/ }).count() === 0; index += 1) {
      await page.getByRole('button', { name: '自動完成本變', exact: true }).click()
    }
    await page.getByRole('button', { name: /查看卦象結果/ }).click()

    await expect(page).toHaveURL(/#\/result$/)
    await expect(page.getByText('STRUCTURE / 01').first()).toBeVisible()
    await expect(page.getByText('TEXT / 02')).toBeVisible()
    await expect(page.getByText('E2E 測試問題')).toBeVisible()

    const changingCards = page.locator('.changing-card')
    for (let index = 0; index < await changingCards.count(); index += 1) {
      await expect(changingCards.nth(index).locator('h3', { hasText: '本卦爻辭' })).toBeVisible()
      await expect(changingCards.nth(index).locator('h3', { hasText: '小象' })).toBeVisible()
      await expect(changingCards.nth(index).locator('h3', { hasText: '注' })).toBeVisible()
    }

    await page.getByRole('button', { name: /重新起卦/ }).click()
    await expect(page).toHaveURL(/#\/setup$/)
    await page.getByRole('textbox', { name: /這次想研究的問題/ }).fill('E2E 快速完成')
    await page.getByRole('button', { name: '六爻全部一次產生', exact: true }).click()
    await expect(page).toHaveURL(/#\/cast$/)
    await expect(page.getByRole('button', { name: /查看卦象結果/ })).toBeVisible()
    await expect(page.locator('.mini-lines .line-position')).toHaveText(['上', '5', '4', '3', '2', '初'])
  })

  test('六十四卦索引、詳細頁與前後卦導覽', async ({ page }) => {
    await goTo(page, '#/hexagrams')
    await expect(page.getByRole('heading', { name: /六十四卦/ })).toBeVisible()
    await expect(page.locator('.hexagram-tile')).toHaveCount(64)
    await page.getByRole('textbox', { name: /搜尋卦序、卦名、上下卦或卦象/ }).fill('雷風')
    await expect(page.locator('.hexagram-tile')).toHaveCount(1)
    await expect(page.locator('.hexagram-tile')).toContainText('恒')
    await page.getByRole('textbox', { name: /搜尋卦序、卦名、上下卦或卦象/ }).fill('')

    await page.locator('.hexagram-tile').first().click()
    await expect(page).toHaveURL(/#\/hexagrams\/1$/)
    await expect(page.getByRole('heading', { name: '乾卦，由象入門。' })).toBeVisible()
    await expect(page.locator('.detail-line-card')).toHaveCount(6)
    await expect(page.locator('.detail-line-card h3')).toHaveText(['初九', '九二', '九三', '九四', '九五', '上九'])
    await expect(page.locator('.detail-line-copy strong', { hasText: '小象' })).toHaveCount(6)

    await page.getByRole('button', { name: /2\. 坤卦/ }).click()
    await expect(page).toHaveURL(/#\/hexagrams\/2$/)
    await expect(page.getByRole('heading', { name: '坤卦，由象入門。' })).toBeVisible()

    await goTo(page, '#/hexagrams/57')
    await expect(page.getByRole('heading', { name: '巽卦，由象入門。' })).toBeVisible()
    await expect(page.getByText('風上風下 · 上卦 巽／下卦 巽')).toBeVisible()
    await goTo(page, '#/hexagrams/58')
    await expect(page.getByRole('heading', { name: '兌卦，由象入門。' })).toBeVisible()
    await expect(page.getByText('澤上澤下 · 上卦 兌／下卦 兌')).toBeVisible()
    await goTo(page, '#/hexagrams/64')
    await expect(page.getByRole('button', { name: /已是最後一卦/ })).toBeDisabled()
  })

  test('易理研究室選卦、結構篩選與結果跳轉', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await goTo(page, '#/research')
    await expect(page.getByRole('heading', { name: /易理研究室/ })).toBeVisible()
    await expect(page.locator('.research-match-card')).toHaveCount(64)

    await page.locator('#research-hexagram').selectOption('63')
    await page.locator('#research-line').selectOption('2')
    await expect(page.locator('.research-selector-summary')).toContainText('既濟卦')
    await page.locator('select[aria-label="下卦條件"]').selectOption('坎')
    await expect(page.locator('.research-match-card')).toHaveCount(8)
    await page.locator('select[aria-label="下卦條件"]').selectOption('')
    await page.locator('select[aria-label="上卦條件"]').selectOption('坎')
    await expect(page.locator('.research-match-card')).toHaveCount(8)
    await page.locator('input[type="checkbox"]').first().uncheck()
    await expect(page.locator('.research-match-card')).toHaveCount(48)

    await page.evaluate(() => {
      const change = { initialStalks: 49, leftStalks: 24, rightStalks: 25, rightAfterHangingOne: 24, leftRemainder: 3, rightRemainder: 4, overCount: 8, remainingStalks: 41 }
      const line = { value: 9, polarity: 'yang', isChanging: true, changes: [change, change, change] }
      sessionStorage.setItem('iching-research:cast-state', JSON.stringify({ stalks: 0, lineIndex: 6, changeIndex: 3, stage: -1, activeChange: null, lineChanges: [], completedLines: [line, line, line, line, line, line], lastCompletedLine: line, completed: true, history: [] }))
    })
    await page.reload()
    await goTo(page, '#/result')
    await expect(page.locator('.changing-card')).toHaveCount(6)
    await page.getByRole('button', { name: '研究此爻 ↗' }).first().click()
    await expect(page).toHaveURL(/#\/research\?hexagram=1&line=1&changed=2&value=9$/)
    await expect(page.locator('.research-selected').getByRole('heading', { name: '乾卦 · 初九' })).toBeVisible()
    await expect(page.locator('.research-context')).toContainText('之卦：第 2 卦 坤卦')
  })

  test('資料校訂頁搜尋小象與手機寬度', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await goTo(page, '#/review')
    await expect(page.getByRole('heading', { name: /逐爻校訂/ })).toBeVisible()
    await expect(page.locator('textarea[id^="review-text-"]')).toHaveCount(384)
    await expect(page.locator('textarea[id^="review-xiaoxiang-"]')).toHaveCount(384)
    await expect(page.locator('textarea[id^="review-commentary-"]')).toHaveCount(384)
    await expect(page.locator('.review-hexagram')).toHaveCount(64)
    await expect(page.locator('.review-hexagram').first().locator('.review-hexagram-header h2')).toHaveText('乾卦')
    await expect(page.locator('.review-hexagram').first().locator('.review-record h3')).toHaveText(['初九', '九二', '九三', '九四', '九五', '上九'])

    await page.getByRole('textbox', { name: /搜尋卦序、卦名、上下卦、爻辭、小象或注/ }).fill('城復于隍')
    await expect(page.locator('.review-record')).toHaveCount(1)
    await expect(page.locator('textarea[id="review-xiaoxiang-11-6"]')).toHaveValue('城復于隍，其命亂也。')

    await page.getByRole('textbox', { name: /搜尋卦序、卦名、上下卦、爻辭、小象或注/ }).fill('')
    await expect(page.locator('.review-record')).toHaveCount(384)
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(375)

    await goTo(page, '#/setup')
    await expect(page.locator('.setup-actions .button')).toHaveCount(2)
    await expect(page.locator('.setup-actions')).toHaveCSS('flex-direction', 'row')
    for (const button of await page.locator('.setup-actions .button').all()) {
      await expect(button).toHaveCSS('min-height', '40px')
    }
    const setupButtonBoxes = await page.locator('.setup-actions .button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON()))
    expect(setupButtonBoxes[0].y).toBe(setupButtonBoxes[1].y)
    await page.getByRole('button', { name: /開始第 1 爻/ }).click()
    const operationBox = await page.locator('.operation-panel').boundingBox()
    const asideBox = await page.locator('.cast-aside').boundingBox()
    expect(asideBox?.y).toBeGreaterThan(operationBox?.y ?? 0)
  })
})
