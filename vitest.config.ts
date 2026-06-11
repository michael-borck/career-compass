import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Required for @testing-library/react's automatic DOM cleanup, which
    // registers itself via a global afterEach.
    globals: true,
    include: ['lib/**/*.test.{ts,tsx}', 'src/**/*.test.{js,ts,tsx}', 'components/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      // Legacy components still import next/link + next/navigation; the same
      // shims vite.config.ts wires for the app build.
      'next/navigation': path.resolve(__dirname, './src/renderer/shims/next-navigation.ts'),
      'next/link': path.resolve(__dirname, './src/renderer/shims/next-link.tsx'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
