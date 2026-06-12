import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Defense-in-depth against XSS from rendered LLM output. Everything the
// packaged app needs is bundled ('self' over file://) — fonts included,
// via @fontsource. Injected at build time only — the dev server needs
// inline scripts (react-refresh preamble) and the HMR websocket, which a
// strict CSP would break.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function injectCsp(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), injectCsp()],
  base: './',
  resolve: {
    // Everything lives under src/renderer now (the legacy root-level lib/ and
    // components/ trees and the next/* shims were folded in post-migration).
    alias: [{ find: '@', replacement: path.resolve(__dirname, './src/renderer') }],
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
