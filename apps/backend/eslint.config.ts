import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const config: Linter.FlatConfig[] = [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        node: true,
        es6: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
    ignores: ['node_modules/', 'dist/', '.env', '*.log', 'coverage/'],
    files: ['src/**/*.ts'],
  },
];

export default config;
