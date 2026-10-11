import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist', '.ssr', 'node_modules', 'qa-output']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {globals: {...globals.browser, ...globals.node}},
  },
);
