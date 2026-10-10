import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// アプリのアイコン。assets/app-icon/ のファイルを中身を変えずに /icons/ に置く
const APP_ICON_DIR = new URL('./assets/app-icon/', import.meta.url);
const APP_ICONS: Record<string, string> = {
  'apple-touch-icon.png': 'image/png',
  'icon-192.png': 'image/png',
  'icon-512.png': 'image/png',
  'icon.svg': 'image/svg+xml',
};
// アイコンを差し替えたら上げる(iPhoneが古いアイコンを覚えていても読み直させるため)
const ICON_VERSION = '2';

function appIcons(): Plugin {
  return {
    name: 'futari-app-icons',
    // 開発中(npm run dev)は /icons/... で直接返す
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.match(/^\/icons\/([^?]+)/)?.[1];
        if (!name || !(name in APP_ICONS)) return next();
        res.setHeader('Content-Type', APP_ICONS[name]);
        res.end(readFileSync(new URL(name, APP_ICON_DIR)));
      });
    },
    // ビルドでは dist/icons/ にそのまま書き出す
    generateBundle() {
      for (const name of Object.keys(APP_ICONS)) {
        this.emitFile({ type: 'asset', fileName: `icons/${name}`, source: readFileSync(new URL(name, APP_ICON_DIR)) });
      }
    },
    // index.html のアイコンのアドレスにも同じ版を付ける
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%ICON_VERSION%', ICON_VERSION),
    },
  };
}

export default defineConfig({
  plugins: [
    preact(),
    appIcons(),
    VitePWA({
      registerType: 'autoUpdate',
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
          { src: `/icons/icon-192.png?v=${ICON_VERSION}`, sizes: '192x192', type: 'image/png' },
          { src: `/icons/icon-512.png?v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png' },
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
