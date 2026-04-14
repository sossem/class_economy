import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/class_economy/', /* <--- 여기에 선생님의 Github 저장소 이름을 적어주세요! */
})