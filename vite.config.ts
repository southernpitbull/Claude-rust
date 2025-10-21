import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/main.ts'),
        tui: resolve(__dirname, 'src/tui/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    sourcemap: true,
    brotliSize: true,
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@bindings': resolve(__dirname, 'bindings'),
      '@plugins': resolve(__dirname, 'plugins'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  },
  optimizeDeps: {
    include: [
      'commander',
      'blessed',
      'chalk',
      'ora',
      'figlet',
      'gradient-string',
      'cli-table3',
      'inquirer',
      'rxjs',
      'lodash',
      'uuid',
      'dayjs',
    ],
  },
});