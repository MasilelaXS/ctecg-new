const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  { ignores: ['android/**', 'ios/**', 'dist/**', 'coverage/**', 'scripts/**'] },
  expoConfig,
  {
    rules: {
      'no-console': 'warn',
      'react/no-unescaped-entities': 'off',
      // React Compiler is not enabled. Keep its stricter migration checks visible
      // without turning an SDK upgrade into a high-risk cross-screen refactor.
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
