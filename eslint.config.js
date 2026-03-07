const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['.webpack/**', 'node_modules/**', 'out/**', 'dist/**'] },
  js.configs.recommended,
  {
    files: ['src/main/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: 'readonly',
        MAIN_WINDOW_WEBPACK_ENTRY: 'readonly',
      },
    },
  },
  {
    files: ['src/renderer.js', 'src/renderer/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },
  {
    files: ['src/preload.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/__tests__/**/*.js', '**/__mocks__/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
  },
];
