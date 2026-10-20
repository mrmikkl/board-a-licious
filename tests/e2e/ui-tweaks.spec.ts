import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, openMenu, unique } from './helpers.ts'

/** A touch drag on an element, as a finger would do it. */
async function pull(page: Page, selector: string, dy: number, steps = 6) {
  await page.evaluate(
    ({ selector, dy, steps }) => {
      const el = document.querySelector(selector)!
      const box = el.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y0 = box.top + 10
      const touch = (y: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
      const fire = (type: string, y: number) =>
        el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch(y)], changedTouches: [touch(y)] }))
      fire('touchstart', y0)
      for (let i = 1; i <= steps; i++) fire('touchmove', y0 + (dy * i) / steps)
      fire('touchend', y0 + dy)
    },
    { selector, dy, steps },
  )
}

test('game details close when pulled down, stay on a short pull', async ({ page }) => {
  await fakeBgg(page)
  const name = unique('Pull')
  await page.goto('/#/add/collection')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await page.getByRole('button', { name: /^add game$/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
  await page.getByRole('button', { name: 'Add to collection' }).click()
  await page.getByRole('region', { name: /not yet marked/i }).getByRole('button', { name: /cascadia/i }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await pull(page, '.sheet-grip', 30)
  await expect(sheet).toBeVisible()
  await pull(page, '.sheet-grip', 180)
  await expect(sheet).toBeHidden()
})

test('Config: sound is switched here and nowhere else, and stays switched', async ({ page }) => {
  await page.goto('/#/config')
  await expect(page.getByRole('heading', { level: 1, name: 'Config' })).toBeVisible()
  await openMenu(page)
  await expect(page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Config' })).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('Escape')
  const sw = page.getByRole('switch', { name: /sound and vibration/i })
  await expect(sw).toBeChecked()
  await sw.uncheck()
  // wait until the choice is in the device's database before reloading
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise(resolve => {
            const open = indexedDB.open('board-a-licious-you@example.com')
            open.onsuccess = () => {
              const get = open.result.transaction('meta').objectStore('meta').get('soundOn')
              get.onsuccess = () => resolve(get.result)
            }
          }),
      ),
    )
    .toBe(false)
  await page.reload()
  await expect(page.getByRole('switch', { name: /sound and vibration/i })).not.toBeChecked()
  await page.getByRole('switch', { name: /sound and vibration/i }).check()
  await page.goto('/#/collections')
  await expect(page.getByRole('button', { name: /^sound (on|off)$/i })).toHaveCount(0)
  await expect(page.getByText('soon')).toHaveCount(0)
  await page.goto('/#/config')
  // sections: (F002 share hint, in a browser tab) | sound | introduction | share and backup
  await expect(page.locator('main hr.separator')).toHaveCount(3)
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Share and backup' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Share and backup' })).toBeVisible()
  await openMenu(page)
  await expect(page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Config' })).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '#/config')
})
