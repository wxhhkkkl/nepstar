import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const stableReportImages = new Set([
  'ai-longevity-consult-chat-design.png',
  'ai-longevity-doctor-avatar.png',
  'calcium-loss-health-management-plan.png',
  'sleep-health-management-plan.png',
  'longevity-report-v2-mobile.png',
])

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 取数层默认打同源 /api/v1，本地开发没有同源后端，转发到 uvicorn。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => stableReportImages.has(assetInfo.name || '')
          ? 'assets/[name][extname]'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.spec.js'],
    exclude: ['tests/e2e/**'],
  },
})
