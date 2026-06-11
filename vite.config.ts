import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Defense-in-depth against XSS from rendered LLM output. Everything the
// packaged app needs is bundled ('self' over file://) except the Google
// Fonts stylesheet in index.html. Injected at build time only — the dev
// server needs inline scripts (react-refresh preamble) and the HMR
// websocket, which a strict CSP would break.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
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
    // Order matters: longer/more specific aliases must come first so they win
    // before the generic '@' alias matches. Vite walks aliases in order.
    //
    // The '@/components' and '@/lib' aliases are transitional. Phase 3 ports
    // pages out of /app verbatim and they still import shared UI/lib code via
    // '@/components/...' and '@/lib/...'. Phase 4 moves these into the renderer
    // tree and these legacy aliases can be removed.
    alias: [
      // next/* shims — legacy components imported from `components/` still
      // call `useRouter`/`usePathname` from next/navigation and `<Link href>`
      // from next/link. These would crash at render time without a Next
      // runtime. Aliasing to tiny react-router-based shims keeps the
      // components transferable unchanged through Phase 3. Phase 4 rewrites
      // components and removes these aliases.
      {
        find: 'next/navigation',
        replacement: path.resolve(__dirname, './src/renderer/shims/next-navigation.ts'),
      },
      {
        find: 'next/link',
        replacement: path.resolve(__dirname, './src/renderer/shims/next-link.tsx'),
      },
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
