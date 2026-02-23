module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
  env: { node: true, es6: true },
  parser: '@typescript-eslint/parser', // Use TypeScript parser
  parserOptions: {
    ecmaVersion: 2021, // Set ecmaVersion to a modern version
    sourceType: 'module',
    project: './tsconfig.json', // Point to the TypeScript config file
  },
  extends: [
    'plugin:@typescript-eslint/recommended', // Add TypeScript recommended rules
    'plugin:prettier/recommended',
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
