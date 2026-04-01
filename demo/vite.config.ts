import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve zeroflow from the parent package source
      'zeroflow': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
