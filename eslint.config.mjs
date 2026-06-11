// Flat ESLint config. Three environments live in this repo:
//   - Renderer + lib + legacy components: TypeScript/React in Chromium
//   - Electron main process (src/main): CommonJS under Node
//   - Build/config/e2e scripts: ESM or TS under Node
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'release/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      '.superpowers/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // JSON parsing and the lenient coercers use `any` by design.
      '@typescript-eslint/no-explicit-any': 'off',
    },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Electron main process and build scripts: CommonJS under Node.
    files: ['src/main/**/*.js', 'src/shared/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Vitest test files for the main process are ESM.
    files: ['src/main/**/*.test.js', 'src/shared/**/*.test.js'],
    languageOptions: { globals: globals.node, sourceType: 'module' },
  },
  prettier
);
