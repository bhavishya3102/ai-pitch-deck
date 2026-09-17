import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Send API calls to the Express backend so the browser sees one origin (no CORS setup needed)
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
