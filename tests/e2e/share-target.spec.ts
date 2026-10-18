import { expect, test } from '@playwright/test'

/** F002: sharing a BoardGameGeek page into the app (contracts/share-target.md). */
const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'
const shareUrl = (params: Record<string, string>) => `/share-target?${new URLSearchParams(params)}`

test('a share lands on #/shared once; Back and reload do not share again (T004)', async ({ page }) => {
  await page.goto('/#/collections')
  await page.goto(shareUrl({ text: `Cascadia ${CASCADIA}` }))
  await expect(page).toHaveURL(/\/#\/shared\?/)
  expect(new URL(page.url()).pathname).toBe('/')
  const params = new URLSearchParams(new URL(page.url()).hash.split('?')[1])
  expect(params.get('text')).toBe(`Cascadia ${CASCADIA}`)
  // the entry URL is replaced, so it is not in the history
  await page.goBack()
  await expect(page).not.toHaveURL(/share-target/)
  // a reload stays on the same in-app route
  await page.goForward()
  await page.reload()
  await expect(page).toHaveURL(/\/#\/shared\?/)
})
