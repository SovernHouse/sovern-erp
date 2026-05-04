import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Use esbuild minifier (default; explicit for clarity).
    minify: 'esbuild',
  },
  define: {
    'process.env': {},
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
    // Strip console.* and debugger from production bundles.
    // 122 console calls in src/ as of 2026-05-04 leaked internal state to
    // end users and bloated the bundle. Dev mode keeps them for debugging.
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  optimizeDeps: {
    esbuild: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}))
