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
    include: [
      'lib/**/*.test.{ts,tsx}',
      'src/**/*.test.{js,ts,tsx}',
      'components/**/*.test.tsx',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
