import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function pwaHead(): Plugin {
  return {
    name: 'goodies-pwa-head',
    transformIndexHtml(html) {
      if (html.includes('apple-mobile-web-app-title')) return html
      const tags = `
    <meta name="description" content="Goodies admin panel" />
    <meta name="theme-color" content="#f8fafc" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Goodies" />
    <link rel="icon" type="image/png" href="/pwa-192.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />`
      return html.replace('</head>', `${tags}\n  </head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    pwaHead(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['goodies.webp', 'fab.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Goodies Panel',
        short_name: 'Goodies',
        description: 'Goodies admin panel',
        theme_color: '#f8fafc',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // Main bundle is about 4.4MB; the default 2MB precache limit would drop it.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
