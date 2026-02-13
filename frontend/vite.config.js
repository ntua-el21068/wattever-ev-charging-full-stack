import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      // Χρησιμοποίησε τα ίδια πιστοποιητικά που έφτιαξες για το backend
      key: fs.readFileSync(path.resolve(__dirname, '../api/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../api/cert.pem')),
    },
    port: 5173,
  },
})