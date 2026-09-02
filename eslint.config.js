const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  { ignores: ['android/**', 'ios/**', 'dist/**', 'coverage/**', 'scripts/**'] },
  expoConfig,
  {
    rules: {
      'no-console': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
]);
