import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fixed (not Vite's auto-increment-on-conflict default) — the backend's
  // CORS_ORIGINS allowlist is pinned to this exact origin.
  server: { port: 5174, strictPort: true },
})
