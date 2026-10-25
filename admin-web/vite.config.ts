import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const pkg = (p: string) => fileURLToPath(new URL(`../packages/${p}`, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // 契约与业务规则来自仓库根目录 packages/，与后端共用同一份源码
      { find: /^@\/contracts$/, replacement: pkg('contracts/index.ts') },
      { find: /^@\/domain\//, replacement: pkg('domain/') },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:3100' },
  },
})
