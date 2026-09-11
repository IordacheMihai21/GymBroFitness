const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Reanimated shared values are intentionally mutable (`.value = ...`); the
    // React Compiler's immutability check doesn't recognize that escape hatch.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
]);
