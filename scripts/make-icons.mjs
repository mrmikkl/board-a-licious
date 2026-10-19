// Builds public/icons/ from the Board-a-licious icon set (specs/003-navigation-rework research R6).
// Run once when the source icons change: `node scripts/make-icons.mjs`, then commit public/icons/.
// Uses the Chromium that Playwright installs for the tests, so no image library is needed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { chromium } from '@playwright/test'

const source = 'specs/003-navigation-rework/design/icons'
const hexagon = `${source}/Hexagon Icons/hex-gradient-colour.png`
const favicon = `${source}/Favicons/favicon-color.png`
const out = 'public/icons'
const ink = '#0D0F1F'

// name, source, width, height, background (null = transparent), share of the canvas the icon fills
const icons = [
  ['logo.png', hexagon, 120, null, null, 1],
  ['icon-192.png', hexagon, 192, 192, null, 1],
  ['icon-512.png', hexagon, 512, 512, null, 1],
  // maskable: Android may crop to a circle; the icon stays inside the central safe zone
  ['icon-maskable-512.png', hexagon, 512, 512, ink, 0.72],
  // iOS ignores transparency and would show black corners
  ['apple-touch-icon.png', hexagon, 180, 180, ink, 0.86],
  ['favicon.png', favicon, 48, 48, null, 1],
]

const browser = await chromium.launch()
const page = await browser.newPage()
mkdirSync(out, { recursive: true })
for (const [name, file, width, height, background, share] of icons) {
  const data = `data:image/png;base64,${readFileSync(file).toString('base64')}`
  const png = await page.evaluate(
    async ({ data, width, height, background, share }) => {
      const img = new Image()
      img.src = data
      await img.decode()
      // trim the transparent margin around the icon
      const scan = document.createElement('canvas')
      scan.width = img.width
      scan.height = img.height
      const sg = scan.getContext('2d')
      sg.drawImage(img, 0, 0)
      const px = sg.getImageData(0, 0, img.width, img.height).data
      let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
          if (px[(y * img.width + x) * 4 + 3] > 16) {
            x0 = Math.min(x0, x)
            x1 = Math.max(x1, x)
            y0 = Math.min(y0, y)
            y1 = Math.max(y1, y)
          }
      const w = x1 - x0 + 1, h = y1 - y0 + 1
      const W = width, H = height ?? Math.round((width * h) / w)
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const g = canvas.getContext('2d')
      if (background) {
        g.fillStyle = background
        g.fillRect(0, 0, W, H)
      }
      const scale = Math.min((W * share) / w, (H * share) / h)
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, x0, y0, w, h, (W - w * scale) / 2, (H - h * scale) / 2, w * scale, h * scale)
      return canvas.toDataURL('image/png')
    },
    { data, width, height, background, share },
  )
  writeFileSync(`${out}/${name}`, Buffer.from(png.split(',')[1], 'base64'))
  console.log(`${out}/${name}`)
}
await browser.close()
