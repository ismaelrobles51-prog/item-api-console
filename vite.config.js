import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const managedPreviewHosts = ['.e2b.dev', '.e2b.app']

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: managedPreviewHosts,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: managedPreviewHosts,
  },
})
