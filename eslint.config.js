import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ['.next/**', '.next-dev/**', 'node_modules/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
  {
    files: ['jest.setup.js'],
    rules: {
      // Jest setup files must use CommonJS
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['next-env.d.ts'],
    rules: {
      // Next.js auto-generates this file with triple-slash references
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
];

export default eslintConfig;
