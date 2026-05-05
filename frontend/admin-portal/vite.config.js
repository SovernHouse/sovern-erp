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
    sourcemap: false,
    // Minification disabled: esbuild minifier caused 15+ min hangs on the
    // e2-micro VM during chunk rendering. The bundle is gzip-compressed by
    // nginx in transit, so skipping JS minification has negligible impact
    // on an internal ERP tool.
    minify: false,
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
