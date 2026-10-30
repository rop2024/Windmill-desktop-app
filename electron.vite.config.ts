import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const alias = {
  '@pgn': path.resolve('src/pgn'),
  '@openings': path.resolve('src/openings'),
  '@stats': path.resolve('src/renderer/stats')
}

export default defineConfig({
  main: {
    build: {
      outDir: '.electron/main',
      rollupOptions: {
        external: ['better-sqlite3']
      }
    },
    resolve: {
      alias: {
        '@main': path.resolve('src/main'),
        '@shared': path.resolve('src/shared'),
        ...alias
      }
    }
  },
  preload: {
    build: {
      outDir: '.electron/preload',
      rollupOptions: {
        output: {
          entryFileNames: 'index.cjs',
          format: 'cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@preload': path.resolve('src/preload'),
        '@shared': path.resolve('src/shared'),
        ...alias
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': path.resolve('src/renderer'),
        '@shared': path.resolve('src/shared'),
        ...alias
      }
    },
    plugins: [react()]
  }
})
