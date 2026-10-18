import { expect, test } from '@playwright/test'

import { expectAccessible } from './helpers.ts'

test('Config: five taps on the heading show the developer links, five more hide them', async ({ page }) => {
  await page.goto('/#/config')
  const heading = page.getByRole('heading', { level: 1, name: 'Config' })
  const developer = page.getByRole('region', { name: 'Developer' })
  await expect(developer).toHaveCount(0)

  for (let i = 0; i < 4; i++) await heading.click()
  await expect(developer).toHaveCount(0)
  await heading.click()
  await expect(developer).toBeVisible()
  await expect(developer.getByRole('link', { name: /github repository/i })).toHaveAttribute('href', 'https://github.com/mrmikkl/board-a-licious')
  await expect(developer.getByRole('link', { name: /cloudflare/i }).first()).toHaveAttribute('href', /dash\.cloudflare\.com/)
  await expect(developer.getByRole('link', { name: /neon/i })).toHaveAttribute('href', /console\.neon\.tech/)
  await expectAccessible(page)

  // stays shown on this device
  await page.reload()
  await expect(developer).toBeVisible()

  for (let i = 0; i < 5; i++) await page.getByRole('heading', { level: 1, name: 'Config' }).click()
  await expect(developer).toHaveCount(0)
})
