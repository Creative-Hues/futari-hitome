import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'ふたりひとめ',
        short_name: 'ふたりひとめ',
        description: 'あみぐるみのどうぶつと一緒に編む、目数・段数カウンター',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf7f2',
        theme_color: '#fbf7f2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // アプリ本体と絵はすべて最初に保存。フォントは日本語で大きいので、使った分だけ保存する
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\.woff2?$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 300 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
