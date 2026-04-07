import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const workspaceEnv = loadEnv(mode, path.resolve(__dirname, '../..'), '')
  const appEnv = loadEnv(mode, __dirname, '')
  const env = { ...workspaceEnv, ...appEnv }
  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      // API keys must never be bundled into the frontend — proxy through the backend
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:18790',
          changeOrigin: true,
        },
        '/health': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:18790',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          home: path.resolve(__dirname, 'index.html'),
          app: path.resolve(__dirname, 'app/index.html'),
          android: path.resolve(__dirname, 'android/index.html'),
          gateway: path.resolve(__dirname, 'gateway/index.html'),
          runtime: path.resolve(__dirname, 'runtime/index.html'),
          oreMiner: path.resolve(__dirname, 'ore-miner/index.html'),
          telegram: path.resolve(__dirname, 'telegram/index.html'),
          commands: path.resolve(__dirname, 'commands.html'),
        },
      },
    },
  }
})
