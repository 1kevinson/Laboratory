import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    open: true,
    port: 5173,
  },
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
})
