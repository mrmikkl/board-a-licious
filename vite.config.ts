import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      // the manifest sits behind Cloudflare Access: fetch it with the sign-in cookie, or Chrome gets the
      // login page instead and never sees share_target (F002)
      useCredentials: true,
      manifest: {
        name: 'Board-a-licious',
        short_name: 'Board-a-licious',
        description: 'Collect, mark and hunt BoardGameGeek games for SPIEL Essen.',
        theme_color: '#0D0F1F',
        background_color: '#0D0F1F',
        display: 'standalone',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        // F002: the installed app appears in Android's share menu; a share opens /share-target?title&text&url
        share_target: { action: '/share-target', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
      },
      workbox: {
        // app shell and self-hosted fonts are precached; /api is never cached by the service worker
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
