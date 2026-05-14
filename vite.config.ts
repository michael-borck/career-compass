import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    // Order matters: longer/more specific aliases must come first so they win
    // before the generic '@' alias matches. Vite walks aliases in order.
    //
    // The '@/components' and '@/lib' aliases are transitional. Phase 3 ports
    // pages out of /app verbatim and they still import shared UI/lib code via
    // '@/components/...' and '@/lib/...'. Phase 4 moves these into the renderer
    // tree and these legacy aliases can be removed.
    alias: [
      {
        find: /^@\/components\/(.*)$/,
        replacement: path.resolve(__dirname, './components') + '/$1',
      },
      {
        find: /^@\/lib\/(.*)$/,
        replacement: path.resolve(__dirname, './lib') + '/$1',
      },
      { find: '@', replacement: path.resolve(__dirname, './src/renderer') },
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});
