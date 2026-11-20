import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // A non-opaque origin is required for jsdom to expose localStorage.
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    setupFiles: ['./src/test/setup.ts'],
    // Required for @testing-library/react's automatic DOM cleanup, which
    // registers itself via a global afterEach.
    globals: true,
    include: ['src/**/*.test.{js,ts,tsx}'],
    // AppleDouble metadata files macOS scatters on exFAT volumes ("._foo.test.ts")
    // match the include glob but aren't parseable source.
    exclude: ['**/node_modules/**', '**/._*'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
});
