import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Cố định cổng: địa chỉ quay về sau khi đăng nhập Google (KEYCLOAK_REDIRECT_URI) trỏ vào 5173.
  server: { port: 5173, strictPort: true },
})
