import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/rmq': {
        target: 'https://b-f621c9a2-f7b9-4725-8fe3-1e3ebf69aa6e.mq.us-east-1.on.aws',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/rmq/, '/api'),
        headers: {
          authorization: 'Basic bXFhZG1pbjpBU0hUSkdGejBkM0VFTHNO',
        },
      },
    },
  },
})
