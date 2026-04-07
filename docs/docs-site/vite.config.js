import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        guide:    resolve(__dirname, 'guide.html'),
        hardware: resolve(__dirname, 'hardware.html'),
        console:  resolve(__dirname, 'console.html'),
      },
    },
  },
})
