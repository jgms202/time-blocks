import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The port stays fixed because saved data belongs to this exact address.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
  server: { port: 5183, strictPort: true },
  preview: { port: 5183, strictPort: true },
})
