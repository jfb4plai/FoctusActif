import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  content: [
    path.join(__dirname, './index.html'),
    path.join(__dirname, './src/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        plai: {
          teal: '#0a9370',
          orange: '#f97316',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
